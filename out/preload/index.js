"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("windowAPI", {
  minimize: () => electron.ipcRenderer.send("window-minimize"),
  maximize: () => electron.ipcRenderer.send("window-maximize"),
  close: () => electron.ipcRenderer.send("window-close"),
  setTheme: (theme) => electron.ipcRenderer.send("theme:set", theme)
});
electron.contextBridge.exposeInMainWorld("electronAPI", {
  getPathForFile: (file) => electron.webUtils.getPathForFile(file),
  getPathInfo: (filePath) => electron.ipcRenderer.invoke("path:info", filePath),
  openExternal: (url) => electron.shell.openExternal(url)
});
