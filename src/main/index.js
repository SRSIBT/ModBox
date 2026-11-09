import icon from '../../resources/icon.png?asset'
import fs from 'fs'
import { basename, join } from 'path'
import { startServer } from './server'
import { readSettings } from './stores/setting.js'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { app, shell, Menu, ipcMain, BrowserWindow, nativeTheme } from 'electron'

const CHROME_VERSION = process.versions.chrome || '131.0.0.0'
const UA_PLATFORM =
  process.platform === 'darwin'
    ? 'Macintosh; Intel Mac OS X 10_15_7'
    : process.platform === 'linux'
      ? 'X11; Linux x86_64'
      : 'Windows NT 10.0; Win64; x64'

app.userAgentFallback = `Mozilla/5.0 (${UA_PLATFORM}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled')

let mainWindow = null

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
      webSecurity: true,
    }
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

  startServer()
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Windows/Linux 关完窗口就退出，macOS 留在后台
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})