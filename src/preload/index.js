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