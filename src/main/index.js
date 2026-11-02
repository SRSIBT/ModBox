import icon from '../../resources/icon.png?asset'
import fs from 'fs'
import { pathToFileURL } from 'url'
import { basename, join } from 'path'
import { startServer } from './server'
import { stopAria2 } from './download/aria2.js'
import { readSettings } from './stores/setting.js'
import { registerTranslateIpc } from './nexus/translate.js'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { attachNxmHandler, setupNxmProtocol } from './nexus/protocol.js'
import {
  app,
  shell,
  Menu,
  Tray,
  nativeImage,
  ipcMain,
  BrowserWindow,
  session,
  nativeTheme
} from 'electron'
import {
  handleNxmUrl,
  registerDownloadIpc,
  attachBrowserDownloads,
  NEXUS_PARTITION
} from './download/manager.js'

const CHROME_VERSION = process.versions.chrome || '131.0.0.0'
const UA_PLATFORM =
  process.platform === 'darwin'
    ? 'Macintosh; Intel Mac OS X 10_15_7'
    : process.platform === 'linux'
      ? 'X11; Linux x86_64'
      : 'Windows NT 10.0; Win64; x64'

app.userAgentFallback = `Mozilla/5.0 (${UA_PLATFORM}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled')

const NEXUS_HOST = /(^|\.)(nexusmods|nexus-cdn)\.com$/i
const ARCHIVE_PATH = /\.(7z|zip|rar|tar|gz|tgz|pak|exe|bin|dll)$/i

const hostOf = (url) => {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

const isNexusUrl = (url) => NEXUS_HOST.test(hostOf(url))

const isNxmUrl = (url) => /^nxm:\/\//i.test(url)

// 路径是压缩包，或者域名是纯文件 CDN，就按下载处理
const isDownloadUrl = (url) => {
  if (!/^https?:/i.test(url)) return false
  try {
    const u = new URL(url)
    return ARCHIVE_PATH.test(u.pathname) || /(^|\.)nexus-cdn\.com$/i.test(u.hostname)
  } catch {
    return false
  }
}

// 单实例和 nxm:// 必须在窗口创建前注册
const hasSingleInstance = setupNxmProtocol()

// 托盘对象要一直留着，否则会被回收
let tray = null
// 标记是否真的退出，避免关闭窗口时又被最小化到托盘
let isQuitting = false
let mainWindow = null

// 每次读最新设置，改完立即生效
function readMinimizeToTray() {
  return readSettings().minimizeToTray === true
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.show()
  mainWindow.focus()
}

function createTray() {
  if (tray) return
  const trayIcon = nativeImage.createFromPath(icon).resize({ width: 512, height: 512 })
  tray = new Tray(trayIcon)
  tray.setToolTip('ModBox')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示主界面', click: showMainWindow },
      {
        label: '退出',
        click: () => {
          // 必须先置标志，否则 close 拦截会把退出请求变成隐藏窗口
          isQuitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('click', showMainWindow)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 1000,
    minHeight: 700,
    title: 'ModBox',
    show: false, // 先隐藏窗口，等 ready-to-show 再显示，防止白屏
    frame: false, // 去掉系统标题栏和边框
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false,
      // 模组下载页是内嵌网页，必须开这个开关，否则 <webview> 只是一个空标签
      webviewTag: true
    }
  })

  // 点关闭时按设置决定是隐藏到托盘还是退出
  mainWindow.on('close', (e) => {
    if (isQuitting) return
    if (!readMinimizeToTray()) return
    e.preventDefault()
    mainWindow.hide()
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 页面里的新窗口链接交给系统浏览器
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 开发时加载 electron-vite 的开发服务器（带热更新），打包后加载本地 html 文件
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  if (!hasSingleInstance) return

  electronApp.setAppUserModelId('com.electron')
  Menu.setApplicationMenu(null)

  // 窗口按钮的 IPC 只注册一次
  ipcMain.on('window-minimize', () => mainWindow?.minimize())
  ipcMain.on('window-maximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.on('window-close', () => mainWindow?.close())

  nativeTheme.themeSource = readSettings().theme === 'dark' ? 'dark' : 'light'
  ipcMain.on('theme:set', (_event, theme) => {
    nativeTheme.themeSource = theme === 'dark' ? 'dark' : 'light'
  })

  // 判断拖进来的路径是文件还是文件夹
  ipcMain.handle('path:info', (_event, filePath) => {
    if (typeof filePath !== 'string' || !filePath) return null
    try {
      const stat = fs.statSync(filePath)
      return {
        path: filePath,
        name: basename(filePath),
        isDirectory: stat.isDirectory(),
        isFile: stat.isFile()
      }
    } catch {
      return null
    }
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 网页里的下载留在 app 内，站外链接才交给浏览器
  app.on('web-contents-created', (_e, contents) => {
    if (contents.getType() !== 'webview') return

    contents.on('will-navigate', (event, url) => {
      if (isNxmUrl(url)) {
        event.preventDefault()
        console.log('[webview] 拦到 nxm 链接，交给下载管理器')
        handleNxmUrl(url)
        return
      }
      if (!isDownloadUrl(url)) return
      console.log('[webview] 拦截到下载导航，改为下载：', url)
      event.preventDefault()
      contents.downloadURL(url)
    })

    contents.setWindowOpenHandler(({ url }) => {
      if (isNxmUrl(url)) {
        console.log('[webview] 新窗口是 nxm 链接，交给下载管理器')
        handleNxmUrl(url)
      } else if (isDownloadUrl(url)) {
        console.log('[webview] 新窗口是下载地址，改为下载：', url)
        contents.downloadURL(url)
      } else if (isNexusUrl(url)) {
        contents.loadURL(url)
      } else if (/^https?:/i.test(url)) {
        shell.openExternal(url)
      }
      return { action: 'deny' }
    })
  })

  startServer()
  registerDownloadIpc()
  registerTranslateIpc()

  // webview 的 preload 不参与打包，开发读源码，打包后读 resources
  const resolveWebviewPreload = () => {
    const candidates = [
      app.isPackaged ? join(process.resourcesPath, 'webview-preload.js') : '',
      join(app.getAppPath(), 'src/main/resources/webview-preload.js'),
      join(__dirname, '../../src/main/resources/webview-preload.js')
    ].filter(Boolean)

    const preloadFile = candidates.find((candidate) => fs.existsSync(candidate))
    if (!preloadFile) {
      console.warn('[webview] 找不到翻译 preload，已尝试：', candidates)
      return ''
    }

    return pathToFileURL(preloadFile).toString()
  }

  ipcMain.handle('webview:preload', () => resolveWebviewPreload())
  // 渲染层 preload 启动时同步拿一次：保证 <webview> 第一次创建就带上 preload，
  // 避免「先加载网页、后设置 preload」导致整页翻译和下载按钮不生效。
  ipcMain.on('webview:preload-sync', (event) => {
    event.returnValue = resolveWebviewPreload()
  })

  // 清掉 N 网登录/验证缓存，解决反复人机验证
  ipcMain.handle('nexus:clear-session', async () => {
    const ses = session.fromPartition(NEXUS_PARTITION)
    await ses.clearStorageData({
      storages: ['cookies', 'localstorage', 'cachestorage', 'indexdb', 'serviceworkers']
    })
    await ses.clearCache()
    return true
  })
  // 网页下载统一接到下载任务表
  attachBrowserDownloads(session.fromPartition(NEXUS_PARTITION))
  attachBrowserDownloads(session.defaultSession)
  createWindow()
  createTray()

  // 窗口建好后再接 nxm，冷启动链接会在这时补发
  attachNxmHandler(handleNxmUrl)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 真退出前先停掉 aria2
app.on('before-quit', () => {
  isQuitting = true
  stopAria2()
})

// 在你创建 BrowserWindow 的地方，或者在 app.whenReady() 之后统一挂：
app.on('browser-window-created', (event, window) => {
  window.webContents.setWebRTCIPHandlingPolicy('disable_non_proxied_udp')
})

// Windows/Linux 关完窗口就退出，macOS 留在后台
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
