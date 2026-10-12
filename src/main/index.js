import { app, shell, Menu, ipcMain, BrowserWindow } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { startServer } from './server'
import { join } from 'path'

function createWindow() {
  // 创建浏览器窗口
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 1000,
    minHeight: 700,
    title: 'ModBox',
    show: false,          // 先隐藏窗口，等 ready-to-show 再显示，防止白屏
    frame: false,   // 去掉系统标题栏和边框
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false
    }
  })

  ipcMain.on('window-minimize', () => mainWindow.minimize())
  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.on('window-close', () => mainWindow.close())

  // 窗口先隐藏，等页面渲染完成后再显示，避免出现白屏闪烁
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // 这个作用是：页面上如果有链接点了要在新窗口打开，它就拦下来、用系统浏览器打开，而不是在软件里弹新窗口。
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

// Electron 初始化完成后，才能创建窗口
app.whenReady().then(() => {
  // 设置 Windows 应用 ID（任务栏图标分组用），以后打包可改成自己的
  electronApp.setAppUserModelId('com.electron')

  // 关闭系统菜单栏
  Menu.setApplicationMenu(null)

  // 开发时 F12 开关开发者工具，打包后禁用 Ctrl+R 刷新
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  startServer()
  createWindow()

  // macOS 特有：点 dock 图标且无窗口时，重新创建窗口
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 所有窗口关闭时退出软件（macOS 除外，macOS 习惯是窗口关了软件还在后台）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
