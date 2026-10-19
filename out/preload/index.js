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
const subscribe = (channel, callback) => {
  const listener = (_event, payload) => callback(payload);
  electron.ipcRenderer.on(channel, listener);
  return () => electron.ipcRenderer.removeListener(channel, listener);
};
electron.contextBridge.exposeInMainWorld("downloadAPI", {
  list: () => electron.ipcRenderer.invoke("download:list"),
  pause: (id) => electron.ipcRenderer.invoke("download:pause", id),
  resume: (id) => electron.ipcRenderer.invoke("download:resume", id),
  cancel: (id) => electron.ipcRenderer.invoke("download:cancel", id),
  remove: (id) => electron.ipcRenderer.invoke("download:remove", id),
  reveal: (id) => electron.ipcRenderer.invoke("download:reveal", id),
  pauseAll: () => electron.ipcRenderer.invoke("download:pause-all"),
  onAdded: (cb) => subscribe("download:added", cb),
  onProgress: (cb) => subscribe("download:progress", cb),
  onState: (cb) => subscribe("download:state", cb),
  onRemoved: (cb) => subscribe("download:removed", cb),
  onNotice: (cb) => subscribe("download:notice", cb),
  onFocus: (cb) => subscribe("download:focus", cb)
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
