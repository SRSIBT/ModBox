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
let webviewPreloadPath = "";
try {
  webviewPreloadPath = electron.ipcRenderer.sendSync("webview:preload-sync") || "";
} catch {
  webviewPreloadPath = "";
}
electron.contextBridge.exposeInMainWorld("webviewAPI", {
  preloadPath: webviewPreloadPath,
  preload: () => electron.ipcRenderer.invoke("webview:preload"),
  clearNexusSession: () => electron.ipcRenderer.invoke("nexus:clear-session")
});
const subscribe = (channel, callback) => {
  electron.ipcRenderer.on(channel, (_event, payload) => callback(payload));
};
electron.contextBridge.exposeInMainWorld("downloadAPI", {
  list: () => electron.ipcRenderer.invoke("download:list"),
  pause: (id) => electron.ipcRenderer.invoke("download:pause", id),
  resume: (id) => electron.ipcRenderer.invoke("download:resume", id),
  remove: (id, removeFile = false) => electron.ipcRenderer.invoke("download:remove", id, removeFile),
  reveal: (id) => electron.ipcRenderer.invoke("download:reveal", id),
  pauseAll: () => electron.ipcRenderer.invoke("download:pause-all"),
  onAdded: (cb) => subscribe("download:added", cb),
  onProgress: (cb) => subscribe("download:progress", cb),
  onState: (cb) => subscribe("download:state", cb),
  onRemoved: (cb) => subscribe("download:removed", cb),
  onNotice: (cb) => subscribe("download:notice", cb),
  onFocus: (cb) => subscribe("download:focus", cb)
});
