import { contextBridge, ipcRenderer, webUtils, shell } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

contextBridge.exposeInMainWorld('windowAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close')
})

contextBridge.exposeInMainWorld('electronAPI', {
  getPathForFile: (file) => webUtils.getPathForFile(file),
  openExternal: (url) => shell.openExternal(url)
})

// nxm 下载：动作走 invoke，进度由主进程推事件。
// 订阅统一返回取消函数，避免 HMR / 重复挂载时监听器越堆越多。
const subscribe = (channel, callback) => {
  const listener = (_event, payload) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('downloadAPI', {
  list: () => ipcRenderer.invoke('download:list'),
  pause: (id) => ipcRenderer.invoke('download:pause', id),
  resume: (id) => ipcRenderer.invoke('download:resume', id),
  cancel: (id) => ipcRenderer.invoke('download:cancel', id),
  remove: (id) => ipcRenderer.invoke('download:remove', id),
  reveal: (id) => ipcRenderer.invoke('download:reveal', id),
  pauseAll: () => ipcRenderer.invoke('download:pause-all'),

  onAdded: (cb) => subscribe('download:added', cb),
  onProgress: (cb) => subscribe('download:progress', cb),
  onState: (cb) => subscribe('download:state', cb),
  onRemoved: (cb) => subscribe('download:removed', cb),
  onNotice: (cb) => subscribe('download:notice', cb),
  onFocus: (cb) => subscribe('download:focus', cb)
})

// Custom APIs for renderer
const api = {}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
