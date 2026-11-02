import { app, BrowserWindow } from 'electron'
import path from 'path'

const POSITIVE_INT = /^\d+$/

const toPositiveInt = (value) => {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!POSITIVE_INT.test(text)) return null
  const n = Number(text)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

export function parseNxmUrl(raw) {
  if (typeof raw !== 'string') return null
  const text = raw.trim()
  if (!text || text.length > 8192) return null

  let url
  try {
    url = new URL(text)
  } catch {
    return null
  }
  if (url.protocol.toLowerCase() !== 'nxm:') return null

  const domain = String(url.hostname || '').toLowerCase()
  if (!domain) return null

  const segments = url.pathname.split('/').filter(Boolean)
  const modsIndex = segments.findIndex((item) => item.toLowerCase() === 'mods')
  if (modsIndex < 0 || modsIndex + 1 >= segments.length) return null

  const modId = toPositiveInt(segments[modsIndex + 1])
  if (!modId) return null

  let fileId = null
  if (segments[modsIndex + 2]?.toLowerCase() === 'files') {
    fileId = toPositiveInt(segments[modsIndex + 3] || '')
  }
  if (!fileId) fileId = toPositiveInt(url.searchParams.get('file_id') || '')

  const key = String(url.searchParams.get('key') || '').trim()
  const expires = toPositiveInt(String(url.searchParams.get('expires') || ''))
  const authorization =
    key && key.length <= 2048 && expires
      ? {
          key,
          expires,
          userId: toPositiveInt(String(url.searchParams.get('user_id') || ''))
        }
      : null

  return { domain, modId, fileId: fileId || null, authorization }
}

export const isAuthorizationExpired = (
  authorization,
  nowSeconds = Math.floor(Date.now() / 1000)
) => {
  if (!authorization?.expires) return true
  return authorization.expires <= nowSeconds
}

export const findNxmArg = (argv) => {
  if (!Array.isArray(argv)) return null
  for (const arg of argv) {
    if (typeof arg !== 'string') continue
    const text = arg.trim().replace(/^"|"$/g, '')
    if (/^nxm:\/\//i.test(text)) return text
  }
  return null
}

// nxm:// 协议接管。
//
// 三条入口，最终都汇到同一个 handler：
//   1. 冷启动（Windows/Linux）：链接就在自己的 process.argv 里
//   2. 已经在跑（Windows/Linux）：第二个实例通过 second-instance 把 argv 递过来
//   3. macOS：open-url 事件，且可能早于 ready 触发

const SCHEME = 'nxm'

let handler = null
// handler 挂上之前收到的链接先存着，避免冷启动时丢事件
const pending = []

const dispatch = (url) => {
  if (!url) return
  if (!handler) {
    pending.push(url)
    return
  }
  try {
    // handler 是异步的，同步抛错和 Promise 拒绝都要挡住，否则会变成 unhandledRejection
    const result = handler(url)
    if (result && typeof result.catch === 'function') {
      result.catch((e) => console.warn('[nxm] 处理链接失败：', e?.message || e))
    }
  } catch (e) {
    console.warn('[nxm] 处理链接失败：', e.message)
  }
}

/**
 * 窗口建好后再接处理函数：此时 BrowserWindow 已存在，事件才送得到渲染进程。
 * 之前缓冲的链接会在这一刻补发。
 */
export const attachNxmHandler = (fn) => {
  handler = fn
  while (pending.length) {
    dispatch(pending.shift())
  }
}

const focusMainWindow = () => {
  const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
  if (!win) return
  // 托盘隐藏状态下 isVisible 为 false，必须 show 才能回来
  if (win.isMinimized()) win.restore()
  if (!win.isVisible()) win.show()
  win.focus()
}

const registerClient = () => {
  try {
    if (process.defaultApp && process.argv.length >= 2) {
      // 开发态：注册的是 electron.exe + 主进程脚本路径
      app.setAsDefaultProtocolClient(SCHEME, process.execPath, [path.resolve(process.argv[1])])
    } else {
      app.setAsDefaultProtocolClient(SCHEME)
    }
  } catch (e) {
    console.warn('[nxm] 协议注册失败：', e.message)
  }
}

/**
 * 必须在 app.whenReady() 之前调用（单实例锁要抢在 ready 前）。
 * @returns {boolean} 是否拿到单实例锁；false 表示已有实例在跑，本进程会退出
 */
export function setupNxmProtocol() {
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return false
  }

  // macOS：监听器要提前挂好，open-url 可能早于 ready
  app.on('open-url', (event, url) => {
    event.preventDefault()
    dispatch(url)
  })

  // Windows / Linux：第二个实例把链接带进 argv
  app.on('second-instance', (_event, argv) => {
    focusMainWindow()
    dispatch(findNxmArg(argv))
  })

  app.whenReady().then(() => {
    registerClient()
    // 冷启动：链接就在自己的 argv 里
    dispatch(findNxmArg(process.argv))
  })

  return true
}
