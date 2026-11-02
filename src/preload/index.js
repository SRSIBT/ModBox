import { contextBridge, ipcRenderer, webUtils, shell } from 'electron'

contextBridge.exposeInMainWorld('windowAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  setTheme: (theme) => ipcRenderer.send('theme:set', theme)
})

contextBridge.exposeInMainWorld('electronAPI', {
  getPathForFile: (file) => webUtils.getPathForFile(file),
  getPathInfo: (filePath) => ipcRenderer.invoke('path:info', filePath),
  openExternal: (url) => shell.openExternal(url)
})

// 内嵌网页的 preload 地址：由主进程按开发/打包分别解析，渲染层只负责传给 <webview>。
// 这里同步取一次，保证 <webview> 第一次创建就带上 preload。
let webviewPreloadPath = ''
try {
  webviewPreloadPath = ipcRenderer.sendSync('webview:preload-sync') || ''
} catch {
  webviewPreloadPath = ''
}

contextBridge.exposeInMainWorld('webviewAPI', {
  preloadPath: webviewPreloadPath,
  preload: () => ipcRenderer.invoke('webview:preload'),
  clearNexusSession: () => ipcRenderer.invoke('nexus:clear-session')
})

// 下载任务：动作走 invoke，进度由主进程推事件。
// initBridge 在渲染层只执行一次，这里不需要额外的取消订阅逻辑。
const subscribe = (channel, callback) => {
  ipcRenderer.on(channel, (_event, payload) => callback(payload))
}

contextBridge.exposeInMainWorld('downloadAPI', {
  list: () => ipcRenderer.invoke('download:list'),
  pause: (id) => ipcRenderer.invoke('download:pause', id),
  resume: (id) => ipcRenderer.invoke('download:resume', id),
  remove: (id, removeFile = false) => ipcRenderer.invoke('download:remove', id, removeFile),
  reveal: (id) => ipcRenderer.invoke('download:reveal', id),
  pauseAll: () => ipcRenderer.invoke('download:pause-all'),

  onAdded: (cb) => subscribe('download:added', cb),
  onProgress: (cb) => subscribe('download:progress', cb),
  onState: (cb) => subscribe('download:state', cb),
  onRemoved: (cb) => subscribe('download:removed', cb),
  onNotice: (cb) => subscribe('download:notice', cb),
  onFocus: (cb) => subscribe('download:focus', cb)
})
