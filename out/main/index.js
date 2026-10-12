"use strict";
const electron = require("electron");
const utils = require("@electron-toolkit/utils");
const path = require("path");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const child_process = require("child_process");
const icon = path.join(__dirname, "../../resources/icon.png");
const isDev = !electron.app.isPackaged;
const DATA_DIR = isDev ? path.join(__dirname, "../../src/main/data") : path.join(electron.app.getPath("userData"), "data");
const REPO_DIR = path.join(DATA_DIR, "repo");
const NOTICES_FILE = path.join(DATA_DIR, "notices.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const buildTree = (dir) => {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  items.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });
  return items.map((f) => {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) {
      return { name: f.name, isDir: true, open: false, children: buildTree(full) };
    }
    const stat = fs.statSync(full);
    return { name: f.name, isDir: false, size: stat.size };
  });
};
const findGameDir = (gameName) => {
  if (!fs.existsSync(REPO_DIR)) return null;
  const dirs = fs.readdirSync(REPO_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const d of dirs) {
    const gameFile = path.join(REPO_DIR, d.name, "game.json");
    if (fs.existsSync(gameFile)) {
      const game = JSON.parse(fs.readFileSync(gameFile, "utf-8"));
      if (game.name === gameName) return d.name;
    }
  }
  return null;
};
const router$4 = express.Router();
router$4.get("/mods/:id", (req, res) => {
  if (req.params.id === "files") {
    const { gameName, modPath } = req.query;
    const gameDir = findGameDir(gameName);
    if (!gameDir) return res.json({ files: [] });
    const dir = path.join(REPO_DIR, gameDir, "mods", modPath);
    if (!fs.existsSync(dir)) return res.json({ files: [] });
    return res.json({ files: buildTree(dir) });
  }
  const gameFile = path.join(REPO_DIR, req.params.id, "game.json");
  if (!fs.existsSync(gameFile)) return res.json({ mods: [] });
  const game = JSON.parse(fs.readFileSync(gameFile, "utf-8"));
  res.json({ mods: game.mods || [] });
});
router$4.post("/mods/save", (req, res) => {
  const { gameId, mods } = req.body;
  const processed = mods.map((mod) => {
    let cover = mod.cover || "";
    if (cover.startsWith("/covers/")) {
      cover = cover.split("/").pop();
    }
    let url = "";
    if (mod.modId && mod.modId !== "/") {
      const nexusGame = gameId.toLowerCase();
      url = `https://www.nexusmods.com/${nexusGame}/mods/${mod.modId}`;
    }
    return { ...mod, cover, url };
  });
  const gameFile = path.join(REPO_DIR, gameId, "game.json");
  const game = JSON.parse(fs.readFileSync(gameFile, "utf-8"));
  game.mods = processed;
  fs.writeFileSync(gameFile, JSON.stringify(game, null, 2));
  res.json({ success: true });
});
router$4.post("/mods/delete", async (req, res) => {
  const { gameName, modPath } = req.body;
  const gameDir = findGameDir(gameName);
  if (!gameDir) return res.json({ success: false });
  const dir = path.join(REPO_DIR, gameDir, "mods", modPath);
  if (fs.existsSync(dir)) {
    await electron.shell.trashItem(dir);
  }
  const coversDir = path.join(REPO_DIR, gameDir, "mods", "covers");
  if (fs.existsSync(coversDir)) {
    const old = fs.readdirSync(coversDir).find((f) => f.startsWith(modPath + "."));
    if (old) await electron.shell.trashItem(path.join(coversDir, old));
  }
  const gameFile = path.join(REPO_DIR, gameDir, "game.json");
  const game = JSON.parse(fs.readFileSync(gameFile, "utf-8"));
  game.mods = (game.mods || []).filter((m) => m.path !== modPath);
  fs.writeFileSync(gameFile, JSON.stringify(game, null, 2));
  res.json({ success: true });
});
router$4.post("/mods/import", (req, res) => {
  const { gameId, paths } = req.body;
  const modsDir = path.join(REPO_DIR, gameId, "mods");
  if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true });
  const gameFile = path.join(REPO_DIR, gameId, "game.json");
  const game = JSON.parse(fs.readFileSync(gameFile, "utf-8"));
  if (!game.mods) game.mods = [];
  const errors = [];
  paths.forEach((p) => {
    const stat = fs.statSync(p);
    const name = path.basename(p);
    if (stat.isDirectory()) {
      const dest = path.join(modsDir, name);
      fs.cpSync(p, dest, { recursive: true });
      const nextId = game.mods.length > 0 ? Math.max(...game.mods.map((m) => m.id)) + 1 : 1;
      game.mods.push({
        id: nextId,
        name,
        path: name,
        cover: "",
        modId: "/",
        version: "/",
        type: "通用",
        author: "/",
        group: "/",
        url: "",
        installed: false
      });
    } else {
      const ext = path.extname(p).toLowerCase();
      if ([".zip", ".rar", ".7z", ".gmm"].includes(ext)) {
        const dest = path.join(modsDir, name);
        fs.copyFileSync(p, dest);
        const nextId = game.mods.length > 0 ? Math.max(...game.mods.map((m) => m.id)) + 1 : 1;
        game.mods.push({
          id: nextId,
          name,
          path: name,
          cover: "",
          modId: "/",
          version: "/",
          type: "通用",
          author: "/",
          group: "/",
          installed: false
        });
      } else {
        errors.push(`格式不支持：${name}`);
      }
    }
  });
  fs.writeFileSync(gameFile, JSON.stringify(game, null, 2));
  res.json({ success: true, errors });
});
router$4.post("/mods/cover", (req, res) => {
  const { gameId, modPath, coverPath } = req.body;
  const coversDir = path.join(REPO_DIR, gameId, "mods", "covers");
  if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
  const ext = path.extname(coverPath).toLowerCase();
  const dest = path.join(coversDir, `${modPath}${ext}`);
  const old = fs.readdirSync(coversDir).find((f) => f.startsWith(modPath + "."));
  if (old) fs.unlinkSync(path.join(coversDir, old));
  fs.copyFileSync(coverPath, dest);
  res.json({ filename: `${modPath}${ext}` });
});
router$4.post("/mods/open-folder", (req, res) => {
  const { gameName, modPath } = req.body;
  const gameDir = findGameDir(gameName);
  if (!gameDir) return res.json({ success: false });
  const dir = path.join(REPO_DIR, gameDir, "mods", modPath);
  if (!fs.existsSync(dir)) return res.json({ success: false });
  electron.shell.openPath(dir);
  res.json({ success: true });
});
const router$3 = express.Router();
router$3.get("/games", (req, res) => {
  if (!fs.existsSync(REPO_DIR)) return res.json({ games: [] });
  const dirs = fs.readdirSync(REPO_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  const games = dirs.map((d) => {
    const gameFile = path.join(REPO_DIR, d.name, "game.json");
    if (fs.existsSync(gameFile)) {
      const game = JSON.parse(fs.readFileSync(gameFile, "utf-8"));
      const mods = (game.mods || []).map((mod) => ({
        ...mod,
        cover: mod.cover ? `/covers/${d.name}/mods/covers/${mod.cover}` : ""
      }));
      return {
        ...game,
        mods,
        cover: `/covers/${d.name}/cover.jpg`
      };
    }
    return {
      name: d.name,
      rootPath: "",
      exePath: "",
      mods: [],
      cover: `/covers/${d.name}/cover.jpg`
    };
  });
  res.json({ games });
});
router$3.post("/game", (req, res) => {
  const game = req.body;
  const gameDir = path.join(REPO_DIR, game.id);
  if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true });
  const gameFile = path.join(gameDir, "game.json");
  const { cover, ...gameData } = game;
  fs.writeFileSync(gameFile, JSON.stringify(gameData, null, 2));
  res.json({ success: true });
});
router$3.delete("/game/:id", async (req, res) => {
  const id = req.params.id;
  const gameDir = path.join(REPO_DIR, id);
  const gameFile = path.join(gameDir, "game.json");
  let gameName = "";
  if (fs.existsSync(gameFile)) {
    gameName = JSON.parse(fs.readFileSync(gameFile, "utf-8")).name;
  }
  if (fs.existsSync(gameDir)) {
    await electron.shell.trashItem(gameDir);
  }
  if (fs.existsSync(SETTINGS_FILE)) {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    if (settings.activeGame === gameName) {
      settings.activeGame = "";
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    }
  }
  res.json({ success: true });
});
router$3.post("/game/open-folder", (req, res) => {
  const { gameName } = req.body;
  const gameDir = findGameDir(gameName);
  if (!gameDir) return res.json({ success: false });
  const gameFile = path.join(REPO_DIR, gameDir, "game.json");
  const game = JSON.parse(fs.readFileSync(gameFile, "utf-8"));
  if (game.rootPath && fs.existsSync(game.rootPath)) {
    electron.shell.openPath(game.rootPath);
  }
  res.json({ success: true });
});
router$3.post("/game/launch", (req, res) => {
  const { gameName } = req.body;
  const gameDir = findGameDir(gameName);
  if (!gameDir) return res.json({ success: false });
  const gameFile = path.join(REPO_DIR, gameDir, "game.json");
  const game = JSON.parse(fs.readFileSync(gameFile, "utf-8"));
  if (game.steamAppId) {
    electron.shell.openExternal(`steam://rungameid/${game.steamAppId}`);
    return res.json({ success: true });
  }
  if (game.exePath && fs.existsSync(game.exePath)) {
    child_process.spawn(game.exePath, [], { detached: true, stdio: "ignore" }).unref();
    return res.json({ success: true });
  }
  res.json({ success: false });
});
const router$2 = express.Router();
router$2.get("/dialog/folder", async (req, res) => {
  const result = await electron.dialog.showOpenDialog({
    properties: ["openDirectory"]
  });
  res.json({ path: result.filePaths[0] || "" });
});
router$2.get("/dialog/folders", async (req, res) => {
  const result = await electron.dialog.showOpenDialog({
    properties: ["openDirectory", "multiSelections"]
  });
  res.json({ paths: result.filePaths });
});
router$2.get("/dialog/file", async (req, res) => {
  const { type } = req.query;
  const filters = type === "image" ? [{ name: "图片", extensions: ["jpg", "jpeg", "png", "webp", "gif"] }] : [{ name: "可执行文件", extensions: ["exe"] }];
  const result = await electron.dialog.showOpenDialog({
    properties: ["openFile"],
    filters
  });
  res.json({ path: result.filePaths[0] || "" });
});
const router$1 = express.Router();
router$1.get("/notices", (req, res) => {
  const data = fs.readFileSync(NOTICES_FILE, "utf-8");
  res.json({ notices: JSON.parse(data) });
});
const router = express.Router();
router.get("/settings", (req, res) => {
  if (!fs.existsSync(SETTINGS_FILE)) {
    return res.json({ activeGame: "", theme: "light", modColumns: [] });
  }
  const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
  res.json(data);
});
router.post("/settings", (req, res) => {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});
const app = express();
app.use(cors());
app.use(express.json());
app.use("/covers", express.static(REPO_DIR));
app.use("/backgrounds", express.static(path.join(DATA_DIR, "backgrounds")));
app.use("/api", router$3);
app.use("/api", router$4);
app.use("/api", router$1);
app.use("/api", router);
app.use("/api", router$2);
function startServer() {
  app.listen(3e3, () => {
    console.log("Express start: http://localhost:3000");
  });
}
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 1e3,
    height: 700,
    minWidth: 1e3,
    minHeight: 700,
    title: "ModBox",
    show: false,
    // 先隐藏窗口，等 ready-to-show 再显示，防止白屏
    frame: false,
    // 去掉系统标题栏和边框
    ...process.platform === "linux" ? { icon } : {},
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      webSecurity: false
    }
  });
  electron.ipcMain.on("window-minimize", () => mainWindow.minimize());
  electron.ipcMain.on("window-maximize", () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  electron.ipcMain.on("window-close", () => mainWindow.close());
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.electron");
  electron.Menu.setApplicationMenu(null);
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  startServer();
  createWindow();
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
