import { BrowserWindow, ipcMain, net, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { Readable, Transform } from 'stream'
import { pipeline } from 'stream/promises'
import { DOWNLOADS_DIR, REPO_DIR } from '../utils/paths.js'
import { isAuthorizationExpired, parseNxmUrl } from '../nxm/parse.js'
import { fetchDownloadLink, fetchModInfo } from '../nxm/nexusApi.js'
import {
  fileNameFromContentDisposition,
  resolveInitialFileName,
  sanitizeFileName,
  uniquePath
} from './fileName.js'
import { clearMarkOfTheWeb } from './unblock.js'

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

// ============================================================
// 文件名解析：实现在 ./fileName.js（纯函数，便于单独验证）
// ============================================================

// ============================================================
// 域名 → 本地游戏
// ============================================================

// 规则与 routes/nexus.js 的 gameDomain() 互为反向：game.json 里写 nexusDomain 就用它，
// 没写就退回目录名小写。你的仓库目录 BlackMythWukong 小写正好是 blackmythwukong。
const resolveGame = (domain) => {
  const target = String(domain || '').toLowerCase()
  let entries = []
  try {
    entries = fs.readdirSync(REPO_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())
  } catch {
    entries = []
  }

  for (const entry of entries) {
    try {
      const raw = fs.readFileSync(path.join(REPO_DIR, entry.name, 'game.json'), 'utf-8')
      const game = JSON.parse(raw)
      const gameDomain = String(game?.nexusDomain || entry.name || '').toLowerCase()
      if (gameDomain === target) {
        return { gameId: entry.name, gameName: game?.name || entry.name, unmatched: false }
      }
    } catch {
      // 读不了或坏掉的 game.json 直接跳过，不影响其它游戏
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
    401: 'N 网拒绝了这个直链（未授权），回网站重新点「Mod Manager Download」',
    403: '直链已失效或过期，回网站重新点「Mod Manager Download」',
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
  broadcast('download:state', toPublic(task))
  notify('error', message)
}

const dropTask = (task) => {
  try {
    fs.rmSync(task._tmpPath, { force: true })
  } catch {
    /* ignore */
  }
  tasks.delete(task.id)
  controllers.delete(task.id)
  broadcast('download:removed', task.id)
}

const run = async (task) => {
  const controller = new AbortController()
  controllers.set(task.id, { controller, cancelled: false })

  let res
  try {
    res = await net.fetch(task._url, { signal: controller.signal })
  } catch (e) {
    // 这里必须先清控制器：否则暂停/取消后 controllers 里留着旧条目，
    // resume 会一直以为「还在收尾」，任务再也点不动
    const entry = controllers.get(task.id)
    controllers.delete(task.id)

    if (entry?.cancelled) {
      dropTask(task)
      return
    }
    if (task.status === 'paused') return
    failTask(task, `下载失败：${e.message}`)
    return
  }

  if (!res.ok || !res.body) {
    failTask(task, mapCdnError(res.status))
    return
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

  const total = Number(res.headers.get('content-length')) || 0
  task.totalBytes = total

  let lastAt = Date.now()
  let lastBytes = 0
  let lastEmit = 0

  const meter = new Transform({
    transform(chunk, _enc, cb) {
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

  try {
    await pipeline(Readable.fromWeb(res.body), meter, fs.createWriteStream(task._tmpPath), {
      signal: controller.signal
    })

    // 先写 .part 再改名：避免下到一半的文件看起来是完整包
    fs.renameSync(task._tmpPath, task._finalPath)
    // 改名之后再清「网络来源」标记，保证落在磁盘上的就是干净文件
    if (clearMarkOfTheWeb(task._finalPath)) {
      console.log(`[download] 已清除网络来源标记：${task.fileName}`)
    }
    controllers.delete(task.id)
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
  } catch (e) {
    const entry = controllers.get(task.id)
    controllers.delete(task.id)

    if (entry?.cancelled) {
      dropTask(task)
      return
    }

    // 暂停是被 abort 打断的，不是错误：保留 .part，等「继续」从 0 重下
    if (e?.name === 'AbortError' || task.status === 'paused') {
      task.status = 'paused'
      task.speed = 0
      task.eta = null
      task.updatedAt = Date.now()
      broadcast('download:state', toPublic(task))
      return
    }

    failTask(task, `下载中断：${e.message}`)
  }
}

// ============================================================
// 对外动作
// ============================================================

/**
 * nxm 链接的总入口。任何失败都转成一条提示，不往外抛。
 */
export async function handleNxmUrl(rawUrl) {
  const parsed = parseNxmUrl(rawUrl)
  if (!parsed) {
    notify('error', '无法识别的 nxm 链接')
    return
  }
  // 只打域名和 ID，绝不打印 key（那是短时授权凭证）
  console.log(
    `[nxm] 收到链接：${parsed.domain} / mod ${parsed.modId} / file ${parsed.fileId ?? '?'}`
  )
  if (!parsed.authorization) {
    notify(
      'error',
      '这个链接没有下载授权（缺 key/expires），请在 N 网点一次「Mod Manager Download」'
    )
    return
  }
  if (!parsed.fileId) {
    notify('error', '这个链接里没有文件 ID，无法下载')
    return
  }
  if (isAuthorizationExpired(parsed.authorization)) {
    notify('error', '下载授权已过期，回 N 网重新点「Mod Manager Download」')
    return
  }

  pendingFocus = true
  broadcast('download:focus')
  notify('info', `正在解析链接：${parsed.domain} · 模组 ${parsed.modId}`)

  try {
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
      key: parsed.authorization.key,
      expires: parsed.authorization.expires
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
    run(task)
  } catch (e) {
    notify('error', e?.message || '开始下载失败')
  }
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
  controllers.get(id)?.controller.abort()
  return { ok: true }
}

const resume = (id) => {
  const task = tasks.get(id)
  if (!task) return { ok: false, error: '任务不存在' }
  if (task.status === 'downloading') return { ok: true }
  // 上一个流还没收尾时别再起一个
  if (controllers.has(id)) return { ok: false, error: '这个任务还在收尾，稍等一下' }

  // 从 0 重下：签名直链本身带 expires，续传大概率 403，行为可预期更重要
  try {
    fs.rmSync(task._tmpPath, { force: true })
  } catch {
    /* ignore */
  }
  task.status = 'downloading'
  task.downloadedBytes = 0
  task.progress = 0
  task.speed = 0
  task.eta = null
  task.error = ''
  task.updatedAt = Date.now()
  broadcast('download:state', toPublic(task))
  run(task)
  return { ok: true }
}

const cancel = (id) => {
  const task = tasks.get(id)
  if (!task) return { ok: false, error: '任务不存在' }

  const entry = controllers.get(id)
  if (entry) {
    // 交给 run() 的 catch 收尾，它能保证文件句柄先关掉
    entry.cancelled = true
    entry.controller.abort()
  } else {
    dropTask(task)
  }
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
  ipcMain.handle('download:cancel', withId(cancel))
  ipcMain.handle('download:remove', withId(cancel))
  ipcMain.handle('download:reveal', withId(reveal))
  ipcMain.handle('download:pause-all', () => pauseAll())
}
