"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
electron.contextBridge.exposeInMainWorld("windowAPI", {
  minimize: () => electron.ipcRenderer.send("window-minimize"),
  maximize: () => electron.ipcRenderer.send("window-maximize"),
  close: () => electron.ipcRenderer.send("window-close")
});
electron.contextBridge.exposeInMainWorld("electronAPI", {
  getPathForFile: (file) => electron.webUtils.getPathForFile(file),
  openExternal: (url) => electron.shell.openExternal(url)
});
const api = {};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}
