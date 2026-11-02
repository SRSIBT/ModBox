import { BrowserWindow, ipcMain, net, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { Readable, Transform } from 'stream'
import { pipeline } from 'stream/promises'
import { sanitizeFileName } from '../stores/file.js'
import { getGames } from '../stores/game.js'
import { importDownloaded } from '../stores/install.js'
import { isAuthorizationExpired, parseNxmUrl } from '../nexus/protocol.js'
import { fetchDownloadLink, fetchModInfo } from '../nexus/nexusApi.js'
import { getAuthStatus, loginNexus } from '../nexus/auth.js'
import { DOWNLOADS_DIR } from '../stores/paths.js'
import {
  ensureAria2,
  addDownload,
  tellStatus,
  pauseDownload,
  unpauseDownload,
  removeDownload,
  removeResult
} from './aria2.js'

// 已完成任务的历史记录，放在 data/downloads 下，重启后还能看到
const COMPLETED_FILE = path.join(DOWNLOADS_DIR, 'completed.json')

const isUsableFileName = (name) => {
  const base = String(name || '').trim()
  if (!base || /nexus/i.test(base)) return false
  return /^\.[A-Za-z0-9]{1,8}$/.test(path.extname(base))
}

const fileNameFromUrl = (rawUrl) => {
  try {
    const segments = new URL(rawUrl).pathname.split('/').filter(Boolean)
    const last = decodeURIComponent(segments.pop() || '')
    return isUsableFileName(last) ? last : ''
  } catch {
    return ''
  }
}

const fileNameFromContentDisposition = (header) => {
  if (!header) return ''
  const star = /filename\*\s*=\s*([^;]+)/i.exec(header)
  if (star) {
    const raw = star[1].trim().replace(/^["']|["']$/g, '')
    try {
      const name = decodeURIComponent(raw.includes("''") ? raw.split("''").pop() : raw)
      if (isUsableFileName(name)) return name
    } catch {
      /* 继续试普通 filename */
    }
  }

  const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(header)
  if (!plain) return ''
  const raw = (plain[1] || plain[2] || '').trim()
  try {
    const name = decodeURIComponent(raw)
    if (isUsableFileName(name)) return name
  } catch {
    if (isUsableFileName(raw)) return raw
  }
  return ''
}

const uniquePath = (dir, fileName) => {
  const ext = path.extname(fileName)
  const stem = fileName.slice(0, fileName.length - ext.length)
  let file = path.join(dir, fileName)
  let i = 1
  while (fs.existsSync(file)) {
    file = path.join(dir, `${stem} (${i})${ext}`)
    i += 1
  }
  return file
}

const resolveInitialFileName = ({ apiName, url, modName, modId, fileId }) => {
  const fallbackName = `${modName}-${modId}-${fileId}.zip`
  const fromApi = isUsableFileName(apiName) ? apiName : ''
  const resolved = fromApi || fileNameFromUrl(url)
  return {
    name: sanitizeFileName(resolved || fallbackName),
    needsHeader: !resolved,
    fallbackName
  }
}

// 下载任务表 + 流式下载 + 进度事件。
//
// 主进程是任务的唯一真源：渲染进程的动作全部转成 IPC 调过来，
// 状态再从事件推回去。任务只存内存，应用退出就清空（窗口关到托盘不影响）。

/** @type {Map<string, object>} id -> 内部任务对象（带 _ 前缀的字段不发给渲染进程） */
const tasks = new Map()
/** @type {Map<string, { controller: AbortController, cancelled: boolean }>} */
const controllers = new Map()

// 收到 nxm 链接时置位，等渲染进程下次 download:list 时取走，
// 免得窗口还没加载完就把 download:focus 事件丢了
let pendingFocus = false
let ipcReady = false

// aria2 缺失只提示一次，避免每次下载都刷日志
let aria2Warned = false

// 发给渲染进程的字段白名单：内部路径、直链、句柄一律不出去
const PUBLIC_FIELDS = [
  'id',
  'modName',
  'modId',
  'gameId',
  'gameName',
  'fileName',
  'status',
  'progress',
  'downloadedBytes',
  'totalBytes',
  'speed',
  'eta',
  'error',
  'addedAt',
  'updatedAt',
  'unmatched'
]

const toPublic = (task) => {
  const out = {}
  for (const key of PUBLIC_FIELDS) out[key] = task[key]
  return out
}

const progressPatch = (task) => ({
  id: task.id,
  downloadedBytes: task.downloadedBytes,
  totalBytes: task.totalBytes,
  progress: task.progress,
  speed: task.speed,
  eta: task.eta,
  updatedAt: task.updatedAt
})

const broadcast = (channel, payload) => {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    win.webContents.send(channel, payload)
  }
}

const notify = (level, message) => broadcast('download:notice', { level, message })

const readCompleted = () => {
  try {
    const data = JSON.parse(fs.readFileSync(COMPLETED_FILE, 'utf-8'))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

// 启动时把上次的已完成记录放回任务表，列表和「打开文件夹」都还能用
for (const record of readCompleted()) {
  if (!record?.id) continue
  const filePath =
    typeof record.path === 'string' && record.path
      ? record.path
      : path.join(DOWNLOADS_DIR, record.fileName || '')
  tasks.set(record.id, {
    ...record,
    status: 'completed',
    _finalPath: filePath,
    _tmpPath: `${filePath}.part`,
    _fallbackName: record.fileName || ''
  })
}

// 已完成任务写进 data/downloads/completed.json，只存公开字段和文件路径
const persistCompleted = () => {
  try {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true })
    const list = [...tasks.values()]
      .filter((task) => task.status === 'completed')
      .map((task) => ({
        ...toPublic(task),
        path: task._finalPath || path.join(DOWNLOADS_DIR, task.fileName || '')
      }))
    fs.writeFileSync(COMPLETED_FILE, JSON.stringify(list, null, 2), 'utf-8')
  } catch (e) {
    console.warn('[download] 写入已完成记录失败：', e.message)
  }
}

// 域名 → 本地游戏
// ============================================================

// N 网域名 → 本地游戏。域名全部来自 builtinGames.js，不再读本地游戏数据文件。
const resolveGame = (domain) => {
  const target = String(domain || '').toLowerCase()

  for (const game of getGames()) {
    const gameDomain = String(game.nexusDomain || game.id || '').toLowerCase()
    if (gameDomain === target) {
      return { gameId: game.id, gameName: game.name || game.id, unmatched: false }
    }
  }

  // 匹配不到也照下，标记 unmatched，前端不过滤它，否则会被「按激活游戏」藏掉
  return { gameId: target, gameName: target, unmatched: true }
}

// ============================================================
// 下载
// ============================================================

const mapCdnError = (status) => {
  const byStatus = {
    401: '直链需要授权（未登录或授权已过期）',
    403: '直链已失效或过期，回 N 网重新点一次下载',
    404: '直链指向的文件不存在了'
  }
  return byStatus[status] || `直链请求失败（HTTP ${status}）`
}

const failTask = (task, message) => {
  controllers.delete(task.id)
  task.status = 'failed'
  task.speed = 0
  task.eta = null
  task.error = message
  task.updatedAt = Date.now()
  // 失败不留半截文件：本版「继续」是从 0 重下，留着只会占空间
  try {
    fs.rmSync(task._tmpPath, { force: true })
  } catch {
    /* 文件不存在就算了 */
  }
  console.error(`[download] 失败：${task.fileName} — ${message}`)
  broadcast('download:state', toPublic(task))
  notify('error', message)
}

const removeTaskFiles = (task) => {
  const paths = new Set([
    task._tmpPath,
    task._finalPath,
    task._finalPath ? `${task._finalPath}.aria2` : ''
  ])
  for (const file of paths) {
    if (!file) continue
    try {
      fs.rmSync(file, { force: true })
    } catch {
      /* 文件可能已经被用户删了 */
    }
  }
}

const dropTask = (task, keepFile = false) => {
  if (!keepFile) removeTaskFiles(task)
  tasks.delete(task.id)
  controllers.delete(task.id)
  broadcast('download:removed', task.id)
  persistCompleted()
}

// 30 秒收不到任何数据就认为连接已经死了（代理断流时 TCP 不会报错，只会一直等）
const IDLE_TIMEOUT_MS = 30000
// 首次 + 两次续传重试
const MAX_ATTEMPTS = 3

const run = async (task) => {
  let attempt = 0

  while (attempt < MAX_ATTEMPTS) {
    attempt += 1

    const controller = new AbortController()
    controllers.set(task.id, { controller, cancelled: false })

    let stalled = false
    let lastDataAt = Date.now()
    let stallTimer = null

    const stopWatch = () => {
      if (stallTimer) clearInterval(stallTimer)
      stallTimer = null
    }

    try {
      // 已经落过盘的部分用 Range 续传（N 网 CDN 支持），省掉重下的流量
      const headers = { ...(task._headers || {}) }
      if (task.downloadedBytes > 0) headers.Range = `bytes=${task.downloadedBytes}-`

      // 网页下载用 webview 那个会话（带网页登录 cookie），nxm 用默认会话
      const res = task._ses
        ? await task._ses.fetch(task._url, { signal: controller.signal, headers })
        : await net.fetch(task._url, { signal: controller.signal, headers })

      if (!res.ok || !res.body) {
        controllers.delete(task.id)
        failTask(task, mapCdnError(res.status))
        return
      }

      // 206 = 接着上次写；200 = 服务端不理 Range，只能从头来
      const resuming = res.status === 206 && task.downloadedBytes > 0
      if (!resuming && task.downloadedBytes > 0) {
        task.downloadedBytes = 0
        task.progress = 0
      }

      // 接口 name 和直链都给不出带后缀的名字时，用响应头里的
      // content-disposition 换掉兜底名。这里必须赶在创建写入流之前改路径。
      if (task._needsHeaderName) {
        const fromHeader = fileNameFromContentDisposition(res.headers.get('content-disposition'))
        const finalName = sanitizeFileName(fromHeader || task._fallbackName)
        task.fileName = finalName
        task._finalPath = uniquePath(DOWNLOADS_DIR, finalName)
        task._tmpPath = `${task._finalPath}.part`
        task._needsHeaderName = false
        broadcast('download:state', toPublic(task))
      }

      const contentLength = Number(res.headers.get('content-length')) || 0
      const total = resuming ? task.downloadedBytes + contentLength : contentLength
      task.totalBytes = total

      let lastAt = Date.now()
      let lastBytes = task.downloadedBytes
      let lastEmit = 0

      const meter = new Transform({
        transform(chunk, _enc, cb) {
          lastDataAt = Date.now()
          task.downloadedBytes += chunk.length
          if (total > 0) task.progress = Math.min(100, (task.downloadedBytes / total) * 100)

          const now = Date.now()
          if (now - lastEmit >= 500) {
            const dt = (now - lastAt) / 1000
            task.speed = dt > 0 ? (task.downloadedBytes - lastBytes) / dt : 0
            task.eta =
              task.speed > 0 && total > 0
                ? Math.max(0, (total - task.downloadedBytes) / task.speed)
                : null
            task.updatedAt = now
            broadcast('download:progress', progressPatch(task))
            lastEmit = now
            lastAt = now
            lastBytes = task.downloadedBytes
          }
          cb(null, chunk)
        }
      })

      lastDataAt = Date.now()
      stallTimer = setInterval(() => {
        if (Date.now() - lastDataAt < IDLE_TIMEOUT_MS) return
        stallTimer = null
        stalled = true
        console.warn(`[download] ${IDLE_TIMEOUT_MS / 1000} 秒没有数据，判定连接卡死，准备续传`)
        controller.abort()
      }, 2000)

      await pipeline(
        Readable.fromWeb(res.body),
        meter,
        fs.createWriteStream(task._tmpPath, { flags: resuming ? 'a' : 'w' }),
        { signal: controller.signal }
      )

      stopWatch()
      controllers.delete(task.id)

      // 先写 .part 再改名，避免下到一半的文件看起来是完整的
      fs.renameSync(task._tmpPath, task._finalPath)

      task.status = 'completed'
      task.progress = 100
      if (total > 0) task.downloadedBytes = total
      task.speed = 0
      task.eta = null
      task.error = ''
      task.updatedAt = Date.now()
      broadcast('download:progress', progressPatch(task))
      broadcast('download:state', toPublic(task))
      notify('info', `下载完成：${task.fileName}`)
      persistCompleted()
      afterComplete(task)
      return
    } catch (e) {
      stopWatch()
      const entry = controllers.get(task.id)
      controllers.delete(task.id)

      if (entry?.cancelled) {
        dropTask(task)
        return
      }

      // 暂停是被 abort 打断的，不是错误：保留 .part，等「继续」再续
      if (e?.name === 'AbortError' && !stalled) {
        task.status = 'paused'
        task.speed = 0
        task.eta = null
        task.updatedAt = Date.now()
        broadcast('download:state', toPublic(task))
        return
      }
      if (task.status === 'paused') return

      // 卡死 / 断流：保留已下载的部分，下一轮用 Range 接着下
      if (attempt < MAX_ATTEMPTS) {
        console.warn(
          `[download] 第 ${attempt} 次中断（${stalled ? '连接卡死' : e.message}），已收 ${task.downloadedBytes} 字节，准备续传`
        )
        task.status = 'downloading'
        task.updatedAt = Date.now()
        continue
      }

      failTask(task, stalled ? '连接反复卡死，重试 3 次仍未完成' : `下载中断：${e.message}`)
      return
    }
  }
}

// 统一入口：优先交给 aria2（多连接独立 TCP，真正能叠加带宽），
// 找不到 aria2c.exe 或它起不来时，退回上面那套内置下载器。
const startTask = async (task) => {
  // 任务已经被取消/暂停掉了，别再起新的
  if (!tasks.has(task.id) || task.status !== 'downloading') return

  try {
    if (await ensureAria2()) {
      const headers = []
      for (const [key, value] of Object.entries(task._headers || {})) {
        headers.push(`${key}: ${value}`)
      }
      // 网页下载要带上网页登录态，CDN 有时会校验 cookie
      if (task._cookieHeader) headers.push(`Cookie: ${task._cookieHeader}`)

      task._gid = await addDownload({
        url: task._url,
        dir: DOWNLOADS_DIR,
        fileName: task.fileName,
        headers
      })
      broadcast('download:state', toPublic(task))
      trackAria2(task)
      return
    }
    // 只有首次提示就够：没装 aria2 不是错误，内置下载器照样能下
    if (!aria2Warned) {
      aria2Warned = true
      console.warn(
        '[download] 没找到 aria2c.exe，使用内置下载器（把 aria2c.exe 放到 data/bin/ 可启用 16 连接）'
      )
    }
  } catch (e) {
    console.warn('[download] aria2 启动下载失败，退回内置下载器：', e.message)
    task._gid = ''
  }

  run(task)
}

const afterComplete = (task) => {
  importDownloaded(task)
    .then((result) => {
      if (!result) return
      notify('info', `已自动导入：${result.name}`)
      broadcast('download:imported', { gameId: task.gameId, name: result.name })
    })
    .catch((e) => notify('error', `自动导入失败：${e.message}`))
}

// ---------- aria2 任务跟踪 ----------
const finishTask = (task, filePath) => {
  const finalPath = filePath || task._finalPath || ''
  task._finalPath = finalPath

  // aria2 正常结束会自己删控制文件，异常退出会留一个，顺手清掉
  if (finalPath) {
    try {
      fs.rmSync(`${finalPath}.aria2`, { force: true })
    } catch {
      /* 没有就算了 */
    }
  }

  task.status = 'completed'
  task.progress = 100
  if (task.totalBytes > 0) task.downloadedBytes = task.totalBytes
  task.speed = 0
  task.eta = null
  task.error = ''
  task.updatedAt = Date.now()
  broadcast('download:progress', progressPatch(task))
  broadcast('download:state', toPublic(task))
  notify('info', `下载完成：${task.fileName}`)
  persistCompleted()

  afterComplete(task)
}

const trackAria2 = (task) => {
  const timer = setInterval(async () => {
    if (!tasks.has(task.id) || !task._gid) {
      clearInterval(timer)
      return
    }

    let status
    try {
      status = await tellStatus(task._gid)
    } catch (e) {
      // gid 丢了（aria2 重启等）：退回内置下载器接着下
      clearInterval(timer)
      console.warn('[download] aria2 状态读取失败，改用内置下载器：', e.message)
      task._gid = ''
      if (tasks.has(task.id) && task.status === 'downloading') run(task)
      return
    }

    task.downloadedBytes = Number(status.completedLength) || 0
    task.totalBytes = Number(status.totalLength) || 0
    task.speed = Number(status.downloadSpeed) || 0
    task.progress =
      task.totalBytes > 0 ? Math.min(100, (task.downloadedBytes / task.totalBytes) * 100) : 0
    task.eta =
      task.speed > 0 && task.totalBytes > 0
        ? Math.max(0, (task.totalBytes - task.downloadedBytes) / task.speed)
        : null
    task.updatedAt = Date.now()
    broadcast('download:progress', progressPatch(task))

    if (status.status === 'complete') {
      clearInterval(timer)
      const doneGid = task._gid
      task._gid = ''
      // 清掉 aria2 里的结果记录，不然它会一直攒
      removeResult(doneGid).catch(() => {})
      const filePath = status.files?.[0]?.path || path.join(DOWNLOADS_DIR, task.fileName)
      finishTask(task, filePath)
      return
    }

    if (status.status === 'error') {
      clearInterval(timer)
      task._gid = ''
      failTask(task, `下载失败：${status.errorMessage || '未知错误'}`)
      return
    }

    if (status.status === 'removed') {
      clearInterval(timer)
      task._gid = ''
      tasks.delete(task.id)
      broadcast('download:removed', task.id)
    }
  }, 500)
}

// ============================================================
// 对外动作
// ============================================================

/**
 * nxm 链接的总入口。
 *
 * 鉴权走 OAuth Bearer：如果还没授权，会弹出一次 N 网授权窗口
 * （和 Mod下载 共用 persist:nexus 会话），授权成功后继续下载。
 */
export async function handleNxmUrl(rawUrl) {
  const parsed = parseNxmUrl(rawUrl)
  if (!parsed) {
    notify('error', '无法识别的 nxm 链接')
    return
  }

  if (!parsed.fileId) {
    notify('error', '这个链接里没有文件 ID，无法下载')
    return
  }
  if (parsed.authorization && isAuthorizationExpired(parsed.authorization)) {
    notify('error', '下载授权已过期，回 N 网重新点「Mod Manager Download」')
    return
  }

  try {
    if (!getAuthStatus().loggedIn) {
      notify('info', '首次自动下载需要授权 N 网，请在弹窗里登录并授权')
      await loginNexus()
    }

    pendingFocus = true
    broadcast('download:focus')
    notify('info', `正在解析链接：${parsed.domain} · 模组 ${parsed.modId}`)

    const game = resolveGame(parsed.domain)

    // 模组名拿不到不该阻断下载，退化成「Mod 12345」
    let modName = `Mod ${parsed.modId}`
    try {
      const info = await fetchModInfo(parsed.domain, parsed.modId)
      if (info.name) modName = info.name
    } catch (e) {
      console.warn('[nxm] 模组信息获取失败：', e.message)
    }

    const link = await fetchDownloadLink({
      domain: parsed.domain,
      modId: parsed.modId,
      fileId: parsed.fileId,
      key: parsed.authorization?.key || '',
      expires: parsed.authorization?.expires || ''
    })

    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true })

    // 三级优先级：接口 name → 直链 URL → 响应头 content-disposition（等拿到响应再定）
    const nameInfo = resolveInitialFileName({
      apiName: link.name,
      url: link.url,
      modName,
      modId: parsed.modId,
      fileId: parsed.fileId
    })
    const finalPath = uniquePath(DOWNLOADS_DIR, nameInfo.name)

    const task = {
      id: crypto.randomUUID(),
      modName,
      modId: parsed.modId,
      gameId: game.gameId,
      gameName: game.gameName,
      fileName: path.basename(finalPath),
      status: 'downloading',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      speed: 0,
      eta: null,
      error: '',
      addedAt: Date.now(),
      updatedAt: Date.now(),
      unmatched: game.unmatched,
      // 以下字段只在主进程用，toPublic 不会带出去
      _url: link.url,
      _tmpPath: `${finalPath}.part`,
      _finalPath: finalPath,
      // 名字只定到兜底值时，等响应头里的 content-disposition 再换一次
      _needsHeaderName: nameInfo.needsHeader,
      _fallbackName: nameInfo.fallbackName
    }

    tasks.set(task.id, task)
    broadcast('download:added', toPublic(task))
    startTask(task)
  } catch (e) {
    notify('error', e?.message || '开始下载失败')
  }
}

// ============================================================
// 内嵌网页里的普通下载
// ============================================================
// 不用 Electron 自带的下载器（DownloadItem）：它拿不到 Referer，失败了也拿不到
// HTTP 状态码，实测会「日志显示接住了、文件却一个字都没落地」。
// 这里改成自己下：用 webview 那个会话 fetch（带上网页登录态）+ 补 Referer，
// 然后复用 nxm 那条链路完全一样的流式写入和进度事件。
// 从模组页地址里取游戏域名：https://www.nexusmods.com/<domain>/mods/...
// 新版站点也有 /games/<domain>/... 这种写法，一并认
const domainFromPage = (pageUrl) => {
  try {
    const u = new URL(pageUrl)
    if (!/(^|\.)nexusmods\.com$/i.test(u.hostname)) return ''

    const segs = u.pathname.split('/').filter(Boolean)
    const first = (segs[0] || '').toLowerCase()
    if (first === 'games') return segs[1] || ''

    // 这些是站点自己的路径段，不是游戏域名
    const notGame = ['core', 'users', 'settings', 'search', 'login']
    if (!first || notGame.includes(first)) return ''
    return segs[0]
  } catch {
    return ''
  }
}

// 从模组页地址里取模组 ID：.../mods/1535
const modIdFromPage = (pageUrl) => {
  try {
    const matched = /\/mods\/(\d+)/i.exec(new URL(pageUrl).pathname)
    return matched ? matched[1] : ''
  } catch {
    return ''
  }
}

export async function handleBrowserDownload({ url, fileName, ses, pageUrl }) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true })

  const name = sanitizeFileName(fileName || fileNameFromUrl(url) || 'download.bin')
  const finalPath = uniquePath(DOWNLOADS_DIR, name)

  // 认得出游戏就挂到对应分组；认不出也标 unmatched，下载列表才不会把它藏起来
  const domain = domainFromPage(pageUrl)
  const game = domain ? resolveGame(domain) : { gameId: '', gameName: '', unmatched: true }

  // aria2 不走 Chromium，网页登录态得手动转成 Cookie 头带过去
  let cookieHeader = ''
  try {
    const cookies = ses ? await ses.cookies.get({ url }) : []
    cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
  } catch {
    cookieHeader = ''
  }

  const task = {
    id: crypto.randomUUID(),
    modName: name,
    modId: modIdFromPage(pageUrl),
    gameId: game.gameId,
    gameName: game.gameName,
    fileName: path.basename(finalPath),
    status: 'downloading',
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    speed: 0,
    eta: null,
    error: '',
    addedAt: Date.now(),
    updatedAt: Date.now(),
    unmatched: game.unmatched,
    // 只在主进程用，toPublic 不会带出去
    _url: url,
    _ses: ses,
    _headers: { Referer: 'https://www.nexusmods.com/', Accept: '*/*' },
    _cookieHeader: cookieHeader,
    _tmpPath: `${finalPath}.part`,
    _finalPath: finalPath,
    _needsHeaderName: false,
    _fallbackName: name
  }

  tasks.set(task.id, task)
  broadcast('download:added', toPublic(task))
  startTask(task)
}

// 内嵌网页用独立会话：登录态要持久化，所以必须带 persist: 前缀
export const NEXUS_PARTITION = 'persist:nexus'

// 同一个 session 只挂一次，避免重复监听导致一条下载建出两个任务
const attachedSessions = new WeakSet()

export function attachBrowserDownloads(ses) {
  if (!ses || attachedSessions.has(ses)) return
  attachedSessions.add(ses)

  ses.on('will-download', (event, item, contents) => {
    const url = item.getURL()
    const fileName = item.getFilename()
    // 下载是从哪个页面点出来的，就用那个页面判断属于哪个游戏
    const pageUrl = contents && !contents.isDestroyed() ? contents.getURL() : ''

    // 拦掉 Electron 的下载器，改由我们自己的下载链路来跑
    event.preventDefault()
    handleBrowserDownload({ url, fileName, ses, pageUrl }).catch((e) => {
      console.error('[download] 网页下载启动失败：', e.message)
      notify('error', `下载启动失败：${e.message}`)
    })
  })
}

const list = () => {
  const focus = pendingFocus
  pendingFocus = false
  return { tasks: [...tasks.values()].map(toPublic), focus }
}

const pause = (id) => {
  const task = tasks.get(id)
  if (!task) return { ok: false, error: '任务不存在' }
  if (task.status !== 'downloading') return { ok: false, error: '任务不在下载中' }

  // 先改状态再 abort：run() 的 catch 会据此判断这是暂停而不是失败
  task.status = 'paused'
  task.speed = 0
  task.eta = null
  task.updatedAt = Date.now()
  broadcast('download:state', toPublic(task))

  // aria2 的任务交给它自己暂停
  if (task._gid) {
    pauseDownload(task._gid).catch((e) => console.warn('[aria2] 暂停失败：', e.message))
    return { ok: true }
  }

  controllers.get(id)?.controller.abort()
  return { ok: true }
}

const resume = (id) => {
  const task = tasks.get(id)
  if (!task) return { ok: false, error: '任务不存在' }
  if (task.status === 'downloading') return { ok: true }

  // 上一个流还没收尾时别再起一个
  if (controllers.has(id)) return { ok: false, error: '这个任务还在收尾，稍等一下' }

  task.status = 'downloading'
  task.speed = 0
  task.eta = null
  task.error = ''
  task.updatedAt = Date.now()
  broadcast('download:state', toPublic(task))

  // aria2 的任务直接 unpause，gid 失效就重新提交
  if (task._gid) {
    unpauseDownload(task._gid).catch((e) => {
      console.warn('[aria2] 继续失败，重新提交任务：', e.message)
      task._gid = ''
      startTask(task)
    })
    return { ok: true }
  }

  // 有 .part 就接着下（run() 会带 Range 续传），没有就从 0 开始。
  // 直链过期时服务端会回 403，run() 会把原因报出来。
  let resumeFrom = 0
  try {
    if (fs.existsSync(task._tmpPath)) resumeFrom = fs.statSync(task._tmpPath).size
  } catch {
    resumeFrom = 0
  }

  task.downloadedBytes = resumeFrom
  task.progress = task.totalBytes > 0 ? Math.min(100, (resumeFrom / task.totalBytes) * 100) : 0
  startTask(task)
  return { ok: true }
}

const removeTask = async (id, removeFile = false) => {
  const task = tasks.get(id)
  if (!task) return { ok: false, error: '任务不存在' }

  // 已完成：勾了“同时删除文件”才动磁盘，否则只删记录
  if (task.status === 'completed') {
    dropTask(task, !removeFile)
    return { ok: true }
  }

  // 没完成的任务：先停掉下载，再把临时文件和可能已经落盘的文件删掉
  if (task._gid) {
    await removeDownload(task._gid).catch(() => {})
    task._gid = ''
  }

  const entry = controllers.get(id)
  if (entry) {
    // 交给 run() 的 catch 收尾，保证文件句柄先关掉
    entry.cancelled = true
    entry.controller.abort()
    return { ok: true }
  }

  dropTask(task)
  return { ok: true }
}

const pauseAll = () => {
  for (const task of tasks.values()) {
    if (task.status === 'downloading') pause(task.id)
  }
  return { ok: true }
}

// 打开所在文件夹：用系统文件管理器定位到该文件。
// 文件可能已经被用户删了，先 existsSync 再交给 shell，否则资源管理器会打开一个空目录。
const reveal = (id) => {
  const task = tasks.get(id)
  if (!task) return { ok: false, error: '任务不存在' }

  const target = task._finalPath || path.join(DOWNLOADS_DIR, task.fileName || '')
  if (!target || !fs.existsSync(target)) return { ok: false, error: '文件不存在' }

  shell.showItemInFolder(target)
  return { ok: true }
}

const safeId = (value) => (typeof value === 'string' && value ? value : '')

const withId = (fn) => (_event, rawId) => {
  const id = safeId(rawId)
  if (!id) return { ok: false, error: '无效的任务 id' }
  return fn(id)
}

export function registerDownloadIpc() {
  if (ipcReady) return
  ipcReady = true

  ipcMain.handle('download:list', () => list())
  ipcMain.handle('download:pause', withId(pause))
  ipcMain.handle('download:resume', withId(resume))
  ipcMain.handle('download:remove', (_event, rawId, removeFile) => {
    const id = safeId(rawId)
    if (!id) return { ok: false, error: '无效的任务 id' }
    return removeTask(id, Boolean(removeFile))
  })
  ipcMain.handle('download:reveal', withId(reveal))
  ipcMain.handle('download:pause-all', () => pauseAll())

  // 网页里的 nxm:// 链接由 preload 直接送进来，绕开 Chromium 的协议跳转。
  // 只接受 nxm 协议，避免渲染层借这个通道下载任意 URL。
  ipcMain.handle('download:nxm', async (_event, rawUrl) => {
    if (typeof rawUrl !== 'string' || !/^nxm:\/\//i.test(rawUrl)) {
      return { ok: false, error: '无效的 nxm 链接' }
    }
    await handleNxmUrl(rawUrl)
    return { ok: true }
  })
}
