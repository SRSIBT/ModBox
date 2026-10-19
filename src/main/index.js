import { app, shell, Menu, Tray, nativeImage, ipcMain, BrowserWindow } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { startServer } from './server'
import { join } from 'path'
import fs from 'fs'
import { SETTINGS_FILE } from './utils/paths.js'
import { attachNxmHandler, setupNxmProtocol } from './nxm/protocol.js'
import { handleNxmUrl, registerDownloadIpc } from './download/manager.js'

// 单实例 + nxm:// 协议注册：必须在 whenReady 之前完成，
// 否则第二个实例已经起来了，抢不到锁也接不到 second-instance
const hasSingleInstance = setupNxmProtocol()

// 托盘实例必须是模块级：放在 createWindow 里会被 GC 回收，托盘图标会莫名消失
let tray = null
// 真退出标志。没有它，托盘菜单的"退出"会被下面的 close 拦截挡住，软件永远关不掉
let isQuitting = false
let mainWindow = null

// 每次触发都读盘、不缓存：设置在渲染进程改完立刻生效，无需重启
function readMinimizeToTray() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')).minimizeToTray === true
  } catch {
    // 首次启动还没有 settings.json
    return false
  }
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
  // 左键单击托盘图标也恢复窗口，符合直觉
  tray.on('click', showMainWindow)
}

function createWindow() {
  // 创建浏览器窗口
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
      webSecurity: false
    }
  })

  // 「最小化到托盘」拦的是关闭按钮（×）：最小化按钮仍然只进任务栏。
  // 没有 isQuitting 判断的话，托盘里的"退出"会被这里挡住，软件永远关不掉。
  mainWindow.on('close', (e) => {
    if (isQuitting) return
    if (!readMinimizeToTray()) return
    e.preventDefault()
    mainWindow.hide()
  })

  // 窗口先隐藏，等页面渲染完成后再显示，避免出现白屏闪烁
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // 窗口真被关掉时清引用，避免托盘去操作已销毁的窗口
  mainWindow.on('closed', () => {
    mainWindow = null
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
  // 没抢到单实例锁：setupNxmProtocol 里已经调用 app.quit()，这里不再建窗口
  if (!hasSingleInstance) return

  // 设置 Windows 应用 ID（任务栏图标分组用），以后打包可改成自己的
  electronApp.setAppUserModelId('com.electron')

  // 关闭系统菜单栏
  Menu.setApplicationMenu(null)

  // 窗口控制 IPC 只注册一次。
  // 原先写在 createWindow 里，macOS 下 activate 二次调用会叠加同 channel 监听器，
  // 一次点击触发多次 close。
  ipcMain.on('window-minimize', () => mainWindow?.minimize())
  ipcMain.on('window-maximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.on('window-close', () => mainWindow?.close())

  // 开发时 F12 开关开发者工具，打包后禁用 Ctrl+R 刷新
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  startServer()
  registerDownloadIpc()
  createWindow()
  createTray()

  // 窗口建好后再接 nxm 处理：此时 BrowserWindow 已存在，
  // 冷启动时 args 里的链接能从缓冲区补发出来
  attachNxmHandler(handleNxmUrl)

  // macOS 特有：点 dock 图标且无窗口时，重新创建窗口
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 托盘里的"退出"走 app.quit()，这里必须先置标志，
// 否则会被 close 拦截变成"隐藏窗口"，软件关不掉
app.on('before-quit', () => {
  isQuitting = true
})

// 所有窗口关闭时退出软件（macOS 除外，macOS 习惯是窗口关了软件还在后台）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
