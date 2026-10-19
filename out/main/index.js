"use strict";
const electron = require("electron");
const utils = require("@electron-toolkit/utils");
const path = require("path");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const os = require("os");
const unzipper = require("unzipper");
const child_process = require("child_process");
const crypto = require("crypto");
const stream = require("stream");
const promises = require("stream/promises");
const icon = path.join(__dirname, "../../resources/icon.png");
const DATA_DIR = electron.app.isPackaged ? path.join(path.dirname(electron.app.getPath("exe")), "data") : path.join(__dirname, "../..", "data");
const REPO_DIR = path.join(DATA_DIR, "repo");
const NOTICES_FILE = path.join(DATA_DIR, "notices.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const BACKGROUNDS_DIR = path.join(DATA_DIR, "backgrounds");
const DOWNLOADS_DIR = path.join(DATA_DIR, "downloads");
const APP_ROOT = electron.app.isPackaged ? electron.app.getAppPath() : path.join(__dirname, "../..");
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
const RULES_FILE = "install.json";
const MANIFEST_FILE = "manifest.json";
const BAK_SUFFIX = ".bak";
const stripControlChars = (value) => [...String(value)].filter((ch) => ch.charCodeAt(0) >= 32).join("");
const isValidGameId$3 = (id) => {
  if (typeof id !== "string") return false;
  if (!id || id !== id.trim()) return false;
  if (id === "." || id === "..") return false;
  if (/[\\/]/.test(id)) return false;
  if (/[<>:"|?*]/.test(id)) return false;
  if (stripControlChars(id) !== id) return false;
  if (/[. ]$/.test(id)) return false;
  return path.basename(id) === id;
};
const isInside = (root, target) => {
  const rel = path.relative(root, target);
  return rel === "" || !rel.startsWith("..") && !path.isAbsolute(rel);
};
const toPosix = (value) => value.split(path.sep).join("/");
const readJson$1 = (file, fallback = null) => {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (e) {
    throw new Error(`${path.basename(file)} 解析失败：${e.message}`);
  }
};
const writeJson = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};
const readGame$3 = (repoDir, gameId) => {
  const gameFile2 = path.join(repoDir, gameId, "game.json");
  if (!fs.existsSync(gameFile2)) throw new Error("游戏不存在");
  const game = readJson$1(gameFile2);
  if (!game?.rootPath) throw new Error("这个游戏还没有设置根目录");
  if (!fs.existsSync(game.rootPath)) throw new Error(`游戏根目录不存在：${game.rootPath}`);
  return { game, gameRoot: path.resolve(game.rootPath) };
};
const readRules = (repoDir, gameId) => {
  const rulesFile = path.join(repoDir, gameId, RULES_FILE);
  if (!fs.existsSync(rulesFile)) {
    throw new Error(`缺少规则文件：${path.relative(repoDir, rulesFile)}`);
  }
  const rules = readJson$1(rulesFile);
  const placements = rules?.placements || rules?.install?.placements;
  if (!Array.isArray(placements) || placements.length === 0) {
    throw new Error("install.json 里没有 placements");
  }
  return { rules, placements };
};
const manifestFile = (repoDir, gameId) => path.join(repoDir, gameId, MANIFEST_FILE);
const getManifest = (repoDir, gameId) => readJson$1(manifestFile(repoDir, gameId), {});
const setInstalled = (repoDir, gameId, modPath, installed) => {
  const file = path.join(repoDir, gameId, "game.json");
  try {
    const game = JSON.parse(fs.readFileSync(file, "utf-8"));
    const mod = (game.mods || []).find((m) => m.path === modPath);
    if (!mod || mod.installed === installed) return;
    mod.installed = installed;
    fs.writeFileSync(file, JSON.stringify(game, null, 2));
  } catch (e) {
    console.warn(`[install] 更新 game.json 安装状态失败：${e.message}`);
  }
};
const escapeRegExp = (value) => value.replace(/[|\\{}()[\]^$+?.-]/g, "\\$&");
const globToRegExp = (glob) => {
  let source = "^";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") {
          i++;
          source += "(?:.*/)?";
        } else {
          source += ".*";
        }
      } else {
        source += "[^/]*";
      }
    } else if (ch === "?") {
      source += "[^/]";
    } else {
      source += escapeRegExp(ch);
    }
  }
  return new RegExp(source + "$", "i");
};
const matchPath = (pattern, relPath) => {
  const glob = String(pattern || "").replace(/\\/g, "/").replace(/^\.?\//, "");
  if (!glob) return false;
  if (glob.includes("/")) return globToRegExp(glob).test(relPath);
  const name = relPath.split("/").pop();
  return globToRegExp(glob).test(name);
};
const expandTokens = (value, gameRoot, roots, depth = 0) => {
  if (depth > 8) throw new Error("install.json 的 roots 存在循环引用");
  return String(value).replace(/\{(\w+)\}/g, (match, key) => {
    if (key === "game_root" || key === "gameRoot" || key === "root") return gameRoot;
    if (roots && Object.prototype.hasOwnProperty.call(roots, key)) {
      return expandTokens(roots[key], gameRoot, roots, depth + 1);
    }
    throw new Error(`install.json 里有未知占位符 {${key}}`);
  });
};
const resolveInto = (rule, gameRoot, roots) => {
  if (!rule?.into) throw new Error(`规则 ${rule?.id || rule?.match || "?"} 缺少 into`);
  const expanded = expandTokens(rule.into, gameRoot, roots);
  const target = path.isAbsolute(expanded) ? path.resolve(expanded) : path.resolve(gameRoot, expanded);
  if (!isInside(gameRoot, target)) {
    throw new Error(`规则 ${rule?.id || rule?.match || "?"} 的 into 越出了游戏根目录`);
  }
  return target;
};
const walkEntries = (root) => {
  const result = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = toPosix(path.relative(root, full));
      if (entry.isDirectory()) {
        result.push({ rel, isDir: true });
        walk(full);
      } else if (entry.isFile()) {
        result.push({ rel, isDir: false });
      }
    }
  };
  walk(root);
  result.sort((a, b) => a.rel.localeCompare(b.rel));
  return result;
};
const depthOf = (rel) => rel.split("/").length;
const safeTitle = (value) => {
  const name = stripControlChars(String(value || "mod")).replace(/[<>:"/\\|?*]/g, "_").replace(/[. ]+$/, "").trim();
  return name || "mod";
};
const buildPlan = ({ root, placements, gameRoot, title, roots = {} }) => {
  const entries = walkEntries(root);
  const files = entries.filter((entry) => !entry.isDir).map((entry) => entry.rel);
  const claimed = /* @__PURE__ */ new Set();
  const usedDest = /* @__PURE__ */ new Map();
  const operations = [];
  const warnings = [];
  const caseInsensitive = process.platform === "win32";
  for (const rule of placements) {
    if (!rule || rule.enabled === false) continue;
    const mode = rule.mode === "files" ? "files" : "folder";
    const into = resolveInto(rule, gameRoot, roots);
    const candidates = entries.filter((entry) => {
      if (mode === "folder" && !entry.isDir) return false;
      if (mode === "files" && entry.isDir) return false;
      return matchPath(rule.match, entry.rel);
    }).sort((a, b) => depthOf(a.rel) - depthOf(b.rel) || a.rel.localeCompare(b.rel));
    for (const candidate of candidates) {
      const parts = candidate.rel.split("/");
      const lift = Math.max(0, Number(rule.lift) || 0);
      const sourceRel = lift ? parts.slice(0, Math.max(0, parts.length - lift)).join("/") : candidate.rel;
      const sourceAbs = sourceRel ? path.join(root, ...sourceRel.split("/")) : root;
      if (mode === "folder") {
        if (!fs.existsSync(sourceAbs) || !fs.statSync(sourceAbs).isDirectory()) continue;
        const under = sourceRel ? files.filter((file) => file === sourceRel || file.startsWith(`${sourceRel}/`)) : files;
        if (under.length > 0 && under.every((file) => claimed.has(file))) continue;
        const destBase = path.join(
          into,
          sourceRel ? path.basename(sourceAbs) : safeTitle(title)
        );
        let added = 0;
        for (const rel of under) {
          if (claimed.has(rel)) continue;
          const inside = sourceRel ? rel.slice(sourceRel.length + 1) : rel;
          if (!inside) continue;
          const src = path.join(root, ...rel.split("/"));
          const dst = path.join(destBase, ...inside.split("/"));
          if (!isInside(gameRoot, dst)) throw new Error(`目标路径越界：${dst}`);
          const key = caseInsensitive ? dst.toLowerCase() : dst;
          if (usedDest.has(key)) {
            throw new Error(`两个文件被投放到同一位置：${dst}（${usedDest.get(key)} 与 ${rel}）`);
          }
          usedDest.set(key, rel);
          operations.push({ src, dst, source: rel, rule: rule.id || rule.match });
          added++;
        }
        for (const rel of under) claimed.add(rel);
        if (added === 0) warnings.push(`规则 ${rule.id || rule.match} 命中 ${candidate.rel}，但没有新文件`);
      } else {
        if (claimed.has(candidate.rel)) continue;
        const src = path.join(root, ...parts);
        const dst = path.join(into, path.basename(candidate.rel));
        if (!isInside(gameRoot, dst)) throw new Error(`目标路径越界：${dst}`);
        const key = caseInsensitive ? dst.toLowerCase() : dst;
        if (usedDest.has(key)) {
          throw new Error(`两个文件被投放到同一位置：${dst}（${usedDest.get(key)} 与 ${candidate.rel}）`);
        }
        usedDest.set(key, candidate.rel);
        operations.push({ src, dst, source: candidate.rel, rule: rule.id || rule.match });
        claimed.add(candidate.rel);
      }
    }
  }
  return {
    operations,
    unmatched: files.filter((file) => !claimed.has(file)),
    warnings
  };
};
const extractZip = (zipPath, dest) => new Promise((resolve, reject) => {
  const extract = unzipper.Extract({ path: dest });
  const input = fs.createReadStream(zipPath);
  input.on("error", reject);
  extract.on("error", reject);
  extract.on("close", resolve);
  input.pipe(extract);
});
const prepareSource = async (repoDir, gameId, modPath) => {
  const modsRoot = path.join(repoDir, gameId, "mods");
  const source = path.resolve(modsRoot, modPath);
  if (!isInside(modsRoot, source) || source === modsRoot) {
    throw new Error("非法的 Mod 路径");
  }
  if (!fs.existsSync(source)) throw new Error("Mod 文件不存在");
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    return { root: source, temp: null, title: path.basename(source) };
  }
  const ext = path.extname(source).toLowerCase();
  if (ext !== ".zip") {
    throw new Error(`目前只支持文件夹和 .zip，暂不支持 ${ext || "这个格式"}`);
  }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "modbox-zip-"));
  try {
    await extractZip(source, temp);
  } catch (e) {
    fs.rmSync(temp, { recursive: true, force: true });
    throw new Error(`解压失败：${e.message}`);
  }
  return { root: temp, temp, title: path.basename(source, ext) };
};
const gameRelative = (gameRoot, target) => toPosix(path.relative(gameRoot, target));
const gameAbsolute = (gameRoot, rel) => {
  const target = path.resolve(gameRoot, rel);
  if (!isInside(gameRoot, target)) throw new Error(`manifest 里的路径越界：${rel}`);
  return target;
};
const pruneEmptyDirs = (dirs, gameRoot) => {
  const sorted = [...new Set(dirs)].sort((a, b) => b.length - a.length);
  for (const dir of sorted) {
    let current = dir;
    while (current !== gameRoot && isInside(gameRoot, current)) {
      try {
        if (fs.readdirSync(current).length > 0) break;
        fs.rmdirSync(current);
      } catch {
        break;
      }
      current = path.dirname(current);
    }
  }
};
async function installMod({ repoDir, gameId, modPath, onProgress }) {
  if (!isValidGameId$3(gameId)) throw new Error("无效的游戏 id");
  if (typeof modPath !== "string" || !modPath) throw new Error("无效的 Mod 路径");
  const { gameRoot } = readGame$3(repoDir, gameId);
  const { rules, placements } = readRules(repoDir, gameId);
  const manifestPath = manifestFile(repoDir, gameId);
  const manifest = readJson$1(manifestPath, {});
  if (manifest[modPath]) {
    await uninstallMod({ repoDir, gameId, modPath });
    Object.assign(manifest, readJson$1(manifestPath, {}));
  }
  const source = await prepareSource(repoDir, gameId, modPath);
  try {
    const plan = buildPlan({
      root: source.root,
      placements,
      gameRoot,
      title: source.title,
      roots: rules.roots || {}
    });
    if (plan.operations.length === 0) {
      const sample = plan.unmatched.slice(0, 5).join("、");
      throw new Error(
        `没有任何文件匹配 placements${sample ? `，未匹配示例：${sample}` : ""}`
      );
    }
    const files = [];
    const backups = [];
    try {
      for (const operation of plan.operations) {
        fs.mkdirSync(path.dirname(operation.dst), { recursive: true });
        if (fs.existsSync(operation.dst)) {
          if (!fs.statSync(operation.dst).isFile()) {
            throw new Error(`目标已存在且不是文件：${operation.dst}`);
          }
          const backup = operation.dst + BAK_SUFFIX;
          fs.copyFileSync(operation.dst, backup);
          backups.push({
            target: gameRelative(gameRoot, operation.dst),
            backup: gameRelative(gameRoot, backup)
          });
        }
        fs.copyFileSync(operation.src, operation.dst);
        files.push(gameRelative(gameRoot, operation.dst));
        if (onProgress) {
          onProgress({
            done: files.length,
            total: plan.operations.length,
            file: gameRelative(gameRoot, operation.dst)
          });
        }
      }
    } catch (e) {
      if (files.length > 0 || backups.length > 0) {
        manifest[modPath] = {
          modPath,
          installedAt: (/* @__PURE__ */ new Date()).toISOString(),
          partial: true,
          error: e.message,
          files,
          backups
        };
        writeJson(manifestPath, manifest);
        setInstalled(repoDir, gameId, modPath, false);
      }
      throw e;
    }
    manifest[modPath] = {
      modPath,
      installedAt: (/* @__PURE__ */ new Date()).toISOString(),
      files,
      backups
    };
    writeJson(manifestPath, manifest);
    setInstalled(repoDir, gameId, modPath, true);
    return {
      files,
      backups,
      unmatched: plan.unmatched,
      warnings: plan.warnings
    };
  } finally {
    if (source.temp) fs.rmSync(source.temp, { recursive: true, force: true });
  }
}
async function uninstallMod({ repoDir, gameId, modPath }) {
  if (!isValidGameId$3(gameId)) throw new Error("无效的游戏 id");
  if (typeof modPath !== "string" || !modPath) throw new Error("无效的 Mod 路径");
  const { gameRoot } = readGame$3(repoDir, gameId);
  const manifestPath = manifestFile(repoDir, gameId);
  const manifest = readJson$1(manifestPath, {});
  const entry = manifest[modPath];
  if (!entry) {
    setInstalled(repoDir, gameId, modPath, false);
    return { removed: 0, restored: 0, warning: "没有安装记录，只重置了安装状态" };
  }
  const dirs = /* @__PURE__ */ new Set();
  let removed = 0;
  for (const rel of entry.files || []) {
    const target = gameAbsolute(gameRoot, rel);
    if (!fs.existsSync(target)) continue;
    if (fs.statSync(target).isFile()) {
      fs.rmSync(target, { force: true });
      removed++;
    }
    dirs.add(path.dirname(target));
  }
  let restored = 0;
  for (const item of entry.backups || []) {
    const backup = gameAbsolute(gameRoot, item.backup);
    const target = gameAbsolute(gameRoot, item.target);
    if (!fs.existsSync(backup)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(backup, target);
    fs.rmSync(backup, { force: true });
    dirs.add(path.dirname(target));
    restored++;
  }
  pruneEmptyDirs(dirs, gameRoot);
  delete manifest[modPath];
  writeJson(manifestPath, manifest);
  setInstalled(repoDir, gameId, modPath, false);
  return { removed, restored };
}
const router$5 = express.Router();
const gameFile$2 = (id) => path.join(REPO_DIR, id, "game.json");
const modDir = (gameId, modPath) => isValidGameId$2(gameId) ? path.join(REPO_DIR, gameId, "mods", modPath) : null;
const readGame$2 = (id) => {
  if (!isValidGameId$2(id) || !fs.existsSync(gameFile$2(id))) return null;
  try {
    return JSON.parse(fs.readFileSync(gameFile$2(id), "utf-8"));
  } catch (e) {
    console.warn(`[mod.js] ${id}/game.json 解析失败：${e.message}`);
    return null;
  }
};
const writeGame = (id, game) => fs.writeFileSync(gameFile$2(id), JSON.stringify(game, null, 2));
const findModCover = (gameId, modPath) => {
  const dir = path.join(REPO_DIR, gameId, "mods", "covers");
  if (!fs.existsSync(dir)) return null;
  const name = fs.readdirSync(dir).find((f) => f.startsWith(modPath + "."));
  return name ? { dir, name } : null;
};
const isValidGameId$2 = (id) => {
  if (typeof id !== "string") return false;
  if (!id || id !== id.trim()) return false;
  if (id === "." || id === "..") return false;
  if (/[\\/]/.test(id)) return false;
  if (/[<>:"|?*]/.test(id)) return false;
  if ([...id].some((ch) => ch.charCodeAt(0) < 32)) return false;
  if (/[. ]$/.test(id)) return false;
  return path.basename(id) === id;
};
router$5.get("/mods/files", (req, res) => {
  const { gameId, modPath } = req.query;
  const dir = modDir(gameId, modPath);
  if (!dir || !fs.existsSync(dir)) return res.json({ files: [] });
  res.json({ files: buildTree(dir) });
});
router$5.get("/mods/manifest", (req, res) => {
  const { gameId } = req.query;
  if (!isValidGameId$2(gameId)) {
    return res.status(400).json({ success: false, error: "无效的游戏 id" });
  }
  res.json({ success: true, manifest: getManifest(REPO_DIR, gameId) });
});
router$5.get("/mods/:id", (req, res) => {
  const id = req.params.id;
  const game = readGame$2(id);
  if (!game) return res.json({ mods: [] });
  res.json({
    mods: (game.mods || []).map((mod) => ({
      ...mod,
      cover: mod.cover ? `/covers/${id}/mods/covers/${mod.cover}` : "",
      url: mod.modId && mod.modId !== "/" ? `https://www.nexusmods.com/${id.toLowerCase()}/mods/${mod.modId}` : ""
    }))
  });
});
router$5.post("/mods/save", (req, res) => {
  const { gameId, mods } = req.body;
  if (!isValidGameId$2(gameId)) {
    return res.status(400).json({ success: false, error: "无效的游戏 id" });
  }
  const game = readGame$2(gameId);
  if (!game) {
    return res.status(404).json({ success: false, error: "游戏不存在" });
  }
  game.mods = mods.map((mod) => {
    let cover = mod.cover || "";
    if (cover.startsWith("/covers/")) cover = cover.split("/").pop();
    delete mod.url;
    return { ...mod, cover };
  });
  writeGame(gameId, game);
  res.json({ success: true });
});
router$5.post("/mods/delete", async (req, res) => {
  const { gameId, modPath } = req.body;
  if (!isValidGameId$2(gameId)) return res.json({ success: false });
  const game = readGame$2(gameId);
  if (!game) return res.json({ success: false });
  const dir = modDir(gameId, modPath);
  if (dir && fs.existsSync(dir)) {
    await electron.shell.trashItem(dir);
  }
  const cover = findModCover(gameId, modPath);
  if (cover) await electron.shell.trashItem(path.join(cover.dir, cover.name));
  game.mods = (game.mods || []).filter((m) => m.path !== modPath);
  writeGame(gameId, game);
  res.json({ success: true });
});
router$5.post("/mods/import", (req, res) => {
  const { gameId, paths } = req.body;
  if (!isValidGameId$2(gameId)) {
    return res.status(400).json({ success: false, error: "无效的游戏 id" });
  }
  const game = readGame$2(gameId);
  if (!game) {
    return res.status(404).json({ success: false, error: "游戏不存在" });
  }
  if (!game.mods) game.mods = [];
  const dir = path.join(REPO_DIR, gameId, "mods");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const errors = [];
  paths.forEach((p) => {
    const stat = fs.statSync(p);
    const name = path.basename(p);
    const dest = path.join(dir, name);
    const nextId = game.mods.length > 0 ? Math.max(...game.mods.map((m) => m.id)) + 1 : 1;
    const record = {
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
    };
    if (stat.isDirectory()) {
      fs.cpSync(p, dest, { recursive: true });
      game.mods.push(record);
    } else if ([".zip", ".rar", ".7z", ".gmm"].includes(path.extname(p).toLowerCase())) {
      fs.copyFileSync(p, dest);
      game.mods.push(record);
    } else {
      errors.push(`格式不支持：${name}`);
    }
  });
  writeGame(gameId, game);
  res.json({ success: true, errors });
});
router$5.post("/mods/install", async (req, res) => {
  const { gameId, modPath } = req.body;
  if (!isValidGameId$2(gameId)) {
    return res.status(400).json({ success: false, error: "无效的游戏 id" });
  }
  if (typeof modPath !== "string" || !modPath) {
    return res.status(400).json({ success: false, error: "无效的 Mod 路径" });
  }
  try {
    const result = await installMod({ repoDir: REPO_DIR, gameId, modPath });
    res.json({ success: true, ...result });
  } catch (e) {
    console.error("[mod.js] 安装失败：", e);
    res.status(500).json({ success: false, error: e.message });
  }
});
router$5.post("/mods/uninstall", async (req, res) => {
  const { gameId, modPath } = req.body;
  if (!isValidGameId$2(gameId)) {
    return res.status(400).json({ success: false, error: "无效的游戏 id" });
  }
  if (typeof modPath !== "string" || !modPath) {
    return res.status(400).json({ success: false, error: "无效的 Mod 路径" });
  }
  try {
    const result = await uninstallMod({ repoDir: REPO_DIR, gameId, modPath });
    res.json({ success: true, ...result });
  } catch (e) {
    console.error("[mod.js] 卸载失败：", e);
    res.status(500).json({ success: false, error: e.message });
  }
});
router$5.post("/mods/cover", (req, res) => {
  const { gameId, modPath, coverPath } = req.body;
  if (!isValidGameId$2(gameId)) {
    return res.status(400).json({ success: false, error: "无效的游戏 id" });
  }
  if (!fs.existsSync(gameFile$2(gameId))) {
    return res.status(404).json({ success: false, error: "游戏不存在" });
  }
  const dir = path.join(REPO_DIR, gameId, "mods", "covers");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const old = findModCover(gameId, modPath);
  if (old) fs.unlinkSync(path.join(old.dir, old.name));
  const filename = `${modPath}${path.extname(coverPath).toLowerCase()}`;
  fs.copyFileSync(coverPath, path.join(dir, filename));
  res.json({ filename });
});
router$5.post("/mods/open-folder", (req, res) => {
  const { gameId, modPath } = req.body;
  const dir = modDir(gameId, modPath);
  if (!dir || !fs.existsSync(dir)) return res.json({ success: false });
  electron.shell.openPath(dir);
  res.json({ success: true });
});
const router$4 = express.Router();
const gameDir = (id) => path.join(REPO_DIR, id);
const gameFile$1 = (id) => path.join(REPO_DIR, id, "game.json");
const readGame$1 = (id) => {
  if (!isValidGameId$1(id) || !fs.existsSync(gameFile$1(id))) return null;
  try {
    return JSON.parse(fs.readFileSync(gameFile$1(id), "utf-8"));
  } catch (e) {
    console.warn(`[game.js] ${id}/game.json 解析失败：${e.message}`);
    return null;
  }
};
const isValidGameId$1 = (id) => {
  if (typeof id !== "string") return false;
  if (!id || id !== id.trim()) return false;
  if (id === "." || id === "..") return false;
  if (/[\\/]/.test(id)) return false;
  if (/[<>:"|?*\x00-\x1f]/.test(id)) return false;
  if (/[. ]$/.test(id)) return false;
  return path.basename(id) === id;
};
router$4.get("/games", (req, res) => {
  if (!fs.existsSync(REPO_DIR)) return res.json({ games: [] });
  const games = fs.readdirSync(REPO_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => {
    const id = d.name;
    const game = readGame$1(id);
    if (!game) {
      return {
        id,
        name: id,
        rootPath: "",
        exePath: "",
        cover: `/covers/${id}/cover.jpg`
      };
    }
    const { mods, ...rest } = game;
    return {
      ...rest,
      id: d.name,
      cover: `/covers/${id}/cover.jpg`
    };
  });
  res.json({ games });
});
router$4.post("/game", (req, res) => {
  const { cover, id, ...gameData } = req.body;
  if (!isValidGameId$1(id)) {
    return res.status(400).json({ success: false, error: "无效的游戏 id" });
  }
  const isFile = !fs.existsSync(gameFile$1(id));
  if (!fs.existsSync(gameDir(id))) fs.mkdirSync(gameDir(id), { recursive: true });
  if (isFile) gameData.id = id;
  fs.writeFileSync(gameFile$1(id), JSON.stringify(gameData, null, 2));
  res.json({ success: true });
});
router$4.delete("/game/:id", async (req, res) => {
  const id = req.params.id;
  if (!isValidGameId$1(id)) return res.status(400).json({ success: false, error: "无效的游戏 id" });
  const dir = gameDir(id);
  if (fs.existsSync(dir)) {
    await electron.shell.trashItem(dir);
  }
  if (!fs.existsSync(SETTINGS_FILE)) return;
  try {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    if (settings.activeGameId !== id) return;
    settings.activeGameId = "";
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.warn(`[game.js] settings.json 解析失败，未清理 activeGameId：${e.message}`);
  }
  res.json({ success: true });
});
router$4.post("/game/open-folder", (req, res) => {
  const { gameId } = req.body;
  const game = readGame$1(gameId);
  if (!game) return res.json({ success: false });
  if (game.rootPath && fs.existsSync(game.rootPath)) {
    electron.shell.openPath(game.rootPath);
  }
  res.json({ success: true });
});
router$4.post("/game/launch", (req, res) => {
  const { gameId } = req.body;
  const game = readGame$1(gameId);
  if (!game) return res.json({ success: false });
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
const router$3 = express.Router();
router$3.get("/dialog/folder", async (req, res) => {
  const result = await electron.dialog.showOpenDialog({
    properties: ["openDirectory"]
  });
  res.json({ path: result.filePaths[0] || "" });
});
router$3.get("/dialog/folders", async (req, res) => {
  const result = await electron.dialog.showOpenDialog({
    properties: ["openDirectory", "multiSelections"]
  });
  res.json({ paths: result.filePaths });
});
router$3.get("/dialog/file", async (req, res) => {
  const { type } = req.query;
  const filters = type === "image" ? [{ name: "图片", extensions: ["jpg", "jpeg", "png", "webp", "gif"] }] : [{ name: "可执行文件", extensions: ["exe"] }];
  const result = await electron.dialog.showOpenDialog({
    properties: ["openFile"],
    filters
  });
  res.json({ path: result.filePaths[0] || "" });
});
const router$2 = express.Router();
router$2.get("/notices", (req, res) => {
  res.json({ notices: readNotices() });
});
router$2.post("/notices", (req, res) => {
  const incoming = Array.isArray(req.body) ? req.body : [];
  const merged = readNotices().map((notice) => {
    const patch = incoming.find((n) => n.id === notice.id);
    if (!patch) return notice;
    return {
      ...notice,
      read: !!patch.read,
      readAt: patch.readAt || null
    };
  });
  fs.writeFileSync(NOTICES_FILE, JSON.stringify(merged, null, 2));
  res.json({ success: true });
});
const readNotices = () => {
  if (!fs.existsSync(NOTICES_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(NOTICES_FILE, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn(`[notices] notices.json 解析失败，按空列表处理：${e.message}`);
    return [];
  }
};
const router$1 = express.Router();
const bgState = () => {
  let file = null;
  file = fs.readdirSync(BACKGROUNDS_DIR).find((f) => f.toLowerCase().startsWith("custom.")) || null;
  if (!file) return { hasCustom: false, file: null, mtime: 0, url: "" };
  try {
    const mtime = Math.round(fs.statSync(path.join(BACKGROUNDS_DIR, file)).mtimeMs);
    return {
      hasCustom: true,
      file,
      mtime,
      url: `/backgrounds/${encodeURIComponent(file)}?v=${mtime}`
    };
  } catch {
    return { hasCustom: false, file: null, mtime: 0, url: "" };
  }
};
router$1.get("/settings", (req, res) => {
  let data = {
    activeGameId: "",
    theme: "light",
    viewMode: "table",
    background: "default",
    modColumns: [],
    minimizeToTray: false,
    nexusApiKey: ""
  };
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      data = { ...data, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8")) };
    } catch (e) {
      console.warn(`[settings.js] settings.json 解析失败，按默认配置返回：${e.message}`);
    }
  }
  const bg = bgState();
  res.json({
    ...data,
    defaultBgUrl: "/backgrounds/【哲风壁纸】AI-AI生成.png",
    customBgUrl: bg.url,
    hasCustom: bg.hasCustom
  });
});
router$1.post("/settings", (req, res) => {
  const body = req.body || {};
  if (Array.isArray(body.modColumns)) {
    body.modColumns = body.modColumns.map(({ key, width }) => ({ key, width }));
  }
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(body, null, 2));
  res.json({ success: true });
});
router$1.post("/background/custom", (req, res) => {
  const { image } = req.body || {};
  if (!image || !fs.existsSync(image)) {
    return res.status(400).json({ success: false, message: "图片不存在" });
  }
  const ext = path.extname(image).toLowerCase();
  if (!ext) {
    return res.status(400).json({ success: false, message: "无法识别图片格式" });
  }
  fs.mkdirSync(BACKGROUNDS_DIR, { recursive: true });
  const old = fs.readdirSync(BACKGROUNDS_DIR).find((f) => f.toLowerCase().startsWith("custom."));
  if (old) fs.unlinkSync(path.join(BACKGROUNDS_DIR, old));
  fs.copyFileSync(image, path.join(BACKGROUNDS_DIR, `custom${ext}`));
  const bg = bgState();
  res.json({ success: true, customBgUrl: bg.url, hasCustom: bg.hasCustom });
});
router$1.delete("/background/custom", (req, res) => {
  try {
    const old = fs.readdirSync(BACKGROUNDS_DIR).find((f) => f.toLowerCase().startsWith("custom."));
    if (old) fs.unlinkSync(path.join(BACKGROUNDS_DIR, old));
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
  res.json({ success: true, customBgUrl: "", hasCustom: false });
});
router$1.get("/app-info", (req, res) => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(APP_ROOT, "package.json"), "utf-8"));
    res.json({
      name: pkg.name || "",
      version: pkg.version || "",
      author: pkg.author || "",
      description: pkg.description || ""
    });
  } catch (e) {
    console.warn(`[app-info] 读取 package.json 失败：${e.message}`);
    res.json({ name: "", version: "", author: "", description: "" });
  }
});
const router = express.Router();
const FAVORITES_FILE = path.join(DATA_DIR, "favorites.json");
const GQL_URL = "https://api.nexusmods.com/v2/graphql";
const REST_URL$1 = "https://api.nexusmods.com/v1";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const hasControlChar = (s) => [...s].some((ch) => ch.charCodeAt(0) < 32);
const isValidGameId = (id) => {
  if (typeof id !== "string") return false;
  if (!id || id !== id.trim()) return false;
  if (id === "." || id === "..") return false;
  if (/[\\/]/.test(id)) return false;
  if (/[<>:"|?*]/.test(id)) return false;
  if (hasControlChar(id)) return false;
  if (/[. ]$/.test(id)) return false;
  return path.basename(id) === id;
};
const gameFile = (id) => path.join(REPO_DIR, id, "game.json");
const readGame = (id) => {
  if (!isValidGameId(id) || !fs.existsSync(gameFile(id))) return null;
  try {
    return JSON.parse(fs.readFileSync(gameFile(id), "utf-8"));
  } catch (e) {
    console.warn(`[nexus] ${id}/game.json 解析失败：${e.message}`);
    return null;
  }
};
const gameDomain = (gameId) => {
  const game = readGame(gameId);
  return String(game?.nexusDomain || gameId || "").toLowerCase();
};
const readJson = (file, fallback) => {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) || fallback;
  } catch (e) {
    console.warn(`[nexus] ${path.basename(file)} 解析失败：${e.message}`);
    return fallback;
  }
};
const toInt = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
const apiKey = () => String(readJson(SETTINGS_FILE, {}).nexusApiKey || "").trim();
const favoritesOf = (gameId) => {
  const raw = readJson(FAVORITES_FILE, {})[gameId];
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => toInt(typeof item === "object" ? item?.modId : item, 0)).filter(Boolean);
};
const writeFavorites = (data) => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FAVORITES_FILE, JSON.stringify(data, null, 2));
};
const headers = () => ({
  apikey: apiKey(),
  "Application-Name": "ModBox",
  "Application-Version": "1.0.0"
});
const httpError = (status, code, message) => Object.assign(new Error(message), { status, code });
const httpJson = async (url, init = {}) => {
  const res = await electron.net.fetch(url, {
    ...init,
    headers: { ...headers(), "Content-Type": "application/json" },
    signal: AbortSignal.timeout(2e4)
  });
  const text2 = await res.text();
  let data = null;
  try {
    data = text2 ? JSON.parse(text2) : null;
  } catch {
    data = null;
  }
  if (!res.ok) throw httpError(res.status, "UPSTREAM", "");
  return data;
};
const LIST_QUERY = `
  query Mods($filter: ModsFilter, $sort: [ModsSort!], $count: Int, $offset: Int) {
    mods(filter: $filter, sort: $sort, count: $count, offset: $offset) {
      totalCount
      nodes {
        modId
        name
        summary
        version
        author
        category
        createdAt
        updatedAt
        downloads
        endorsements
        fileSize
        thumbnailUrl
        thumbnailBlurredUrl
        pictureUrl
      }
    }
  }
`;
const SORT_FIELDS = {
  latest_added: "createdAt",
  latest_updated: "updatedAt",
  downloads: "downloads",
  endorsements: "endorsements"
};
const buildFilter = (domain, name) => {
  const filter = { gameDomainName: [{ op: "EQUALS", value: domain }] };
  if (name) filter.name = [{ op: "WILDCARD", value: `%${name}%` }];
  return filter;
};
const buildSort = (sort) => ({
  [SORT_FIELDS[sort] || "createdAt"]: { direction: "DESC" }
});
const gql = async (query, variables) => {
  const data = await httpJson(GQL_URL, {
    method: "POST",
    body: JSON.stringify({ query, variables })
  });
  if (data?.errors?.length) {
    throw httpError(502, "GRAPHQL", data.errors.map((e) => e.message).join("；"));
  }
  return data?.data;
};
const text = (value) => typeof value === "string" ? value : value?.name || "";
const LOCAL_API = "http://localhost:3000";
const proxyCover = (raw) => {
  if (!raw) return "";
  const url = String(raw).startsWith("//") ? `https:${raw}` : String(raw);
  return `${LOCAL_API}/api/nexus/image?u=${encodeURIComponent(url)}`;
};
const mapMod = (mod, domain) => ({
  modId: mod.modId,
  name: mod.name || "",
  summary: mod.summary || "",
  category: text(mod.category),
  author: text(mod.author),
  version: mod.version || "",
  // 缩略图 → 模糊缩略图 → 原图，三档兜底
  cover: proxyCover(mod.thumbnailUrl || mod.thumbnailBlurredUrl || mod.pictureUrl),
  createdAt: mod.createdAt || "",
  updatedAt: mod.updatedAt || "",
  downloads: mod.downloads || 0,
  endorsements: mod.endorsements || 0,
  fileSize: mod.fileSize || 0,
  url: `https://www.nexusmods.com/${domain}/mods/${mod.modId}`
});
const fetchPage = async ({ domain, sort, page, pageSize, name }) => {
  const data = await gql(LIST_QUERY, {
    filter: buildFilter(domain, name),
    sort: buildSort(sort),
    count: pageSize,
    offset: (page - 1) * pageSize
  });
  const conn = data?.mods || {};
  const nodes = conn.nodes || [];
  const total = conn.totalCount ?? (page - 1) * pageSize + nodes.length;
  return {
    total,
    page,
    list: nodes.map((mod) => mapMod(mod, domain))
  };
};
const fetchOne = async ({ domain, modId }) => {
  const data = await httpJson(`${REST_URL$1}/games/${domain}/mods/${modId}.json`);
  if (!data) throw httpError(404, "NOT_FOUND", "找不到这个模组");
  return {
    total: 1,
    page: 1,
    list: [
      {
        modId: data.mod_id ?? toInt(modId, 0),
        name: data.name || "",
        summary: data.summary || "",
        category: data.category_name || "",
        author: data.author || data.uploaded_by || "",
        version: data.version || "",
        cover: proxyCover(data.picture_url),
        createdAt: data.created_time || "",
        updatedAt: data.updated_time || "",
        downloads: 0,
        endorsements: 0,
        fileSize: 0,
        url: `https://www.nexusmods.com/${domain}/mods/${modId}`
      }
    ]
  };
};
const fail = (res, e) => {
  const status = e.status || 502;
  const known = {
    401: "Nexus API Key 无效",
    403: "这个游戏的模组不允许访问",
    404: "找不到：模组 ID 或游戏域名可能不对",
    429: "Nexus 请求太频繁，稍后再试"
  };
  const message = e.status ? e.message || known[status] || "请求 N 网失败" : `连不上 Nexus（检查代理 / hosts / 网络）：${e.message}`;
  res.status(status).json({ success: false, error: { code: e.code || "UPSTREAM", message } });
};
const badGame = (res) => res.status(400).json({ success: false, error: { code: "BAD_GAME", message: "无效的游戏 id" } });
const IMAGE_HOST = /(^|\.)(nexusmods\.com|nexus-cdn\.com)$/i;
router.get("/nexus/image", async (req, res) => {
  const raw = String(req.query.u || "");
  let url = null;
  try {
    url = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
  } catch {
    url = null;
  }
  if (!url || !/^https?:$/.test(url.protocol)) return res.status(400).end();
  if (!IMAGE_HOST.test(url.hostname)) return res.status(403).end();
  if (url.protocol === "http:") url = new URL(url.href.replace(/^http:/, "https:"));
  try {
    const upstream = await electron.net.fetch(url.href, {
      headers: { Referer: "https://www.nexusmods.com/", "User-Agent": "Mozilla/5.0" }
    });
    if (!upstream.ok) return res.status(upstream.status).end();
    res.set("Content-Type", upstream.headers.get("content-type") || "image/jpeg");
    res.set("Cache-Control", "public, max-age=86400");
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.status(502).end();
  }
});
router.get("/nexus/mods", async (req, res) => {
  const { gameId, sort = "latest_added", modId = "", name = "", favoritesOnly } = req.query;
  if (!isValidGameId(gameId)) return badGame(res);
  if (!apiKey()) {
    return res.status(400).json({
      success: false,
      error: { code: "NO_KEY", message: "还没配置 Nexus API Key：设置 → Nexus API Key" }
    });
  }
  const page = Math.max(1, toInt(req.query.page, 1));
  const pageSize = clamp(toInt(req.query.pageSize, DEFAULT_PAGE_SIZE), 1, MAX_PAGE_SIZE);
  const idKeyword = String(modId).trim();
  const nameKeyword = String(name).trim();
  try {
    const result = idKeyword ? await fetchOne({ domain: gameDomain(gameId), modId: idKeyword }) : await fetchPage({
      domain: gameDomain(gameId),
      sort,
      page,
      pageSize,
      name: nameKeyword
    });
    let list2 = result.list;
    if (["1", "true"].includes(String(favoritesOnly))) {
      const fav = new Set(favoritesOf(gameId));
      list2 = list2.filter((mod) => fav.has(mod.modId));
    }
    res.json({
      success: true,
      source: "nexus",
      total: result.total,
      page: result.page,
      pageSize,
      list: list2
    });
  } catch (e) {
    fail(res, e);
  }
});
router.get("/nexus/favorites", (req, res) => {
  const { gameId } = req.query;
  if (!isValidGameId(gameId)) return badGame(res);
  res.json({ success: true, modIds: favoritesOf(gameId) });
});
router.post("/nexus/favorites", (req, res) => {
  const { gameId, modId, favorite } = req.body || {};
  if (!isValidGameId(gameId)) return badGame(res);
  const id = toInt(modId, 0);
  if (!id) {
    return res.status(400).json({ success: false, error: { code: "BAD_MOD", message: "无效的模组 id" } });
  }
  const all = readJson(FAVORITES_FILE, {});
  const list2 = new Set(favoritesOf(gameId));
  if (favorite) list2.add(id);
  else list2.delete(id);
  all[gameId] = [...list2];
  writeFavorites(all);
  res.json({ success: true, modIds: all[gameId] });
});
const app = express();
app.use(cors());
app.use(express.json());
app.use("/covers", express.static(REPO_DIR));
app.use("/backgrounds", express.static(BACKGROUNDS_DIR));
app.use("/api", router$4);
app.use("/api", router$5);
app.use("/api", router$2);
app.use("/api", router$1);
app.use("/api", router$3);
app.use("/api", router);
function startServer() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  app.listen(3e3, () => {
    console.log("Express start: http://localhost:3000");
  });
}
const POSITIVE_INT = /^\d+$/;
const toPositiveInt = (value) => {
  if (typeof value !== "string") return null;
  const text2 = value.trim();
  if (!POSITIVE_INT.test(text2)) return null;
  const n = Number(text2);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};
function parseNxmUrl(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 8192) return null;
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol.toLowerCase() !== "nxm:") return null;
  const domain = String(url.hostname || "").toLowerCase();
  if (!domain) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  const modsIndex = segments.findIndex((s) => s.toLowerCase() === "mods");
  if (modsIndex < 0 || modsIndex + 1 >= segments.length) return null;
  const modId = toPositiveInt(segments[modsIndex + 1]);
  if (!modId) return null;
  let fileId = null;
  if (segments[modsIndex + 2]?.toLowerCase() === "files") {
    fileId = toPositiveInt(segments[modsIndex + 3] || "");
  }
  if (!fileId) fileId = toPositiveInt(url.searchParams.get("file_id") || "");
  const key = String(url.searchParams.get("key") || "").trim();
  const expires = toPositiveInt(String(url.searchParams.get("expires") || ""));
  const authorization = key && key.length <= 2048 && expires ? {
    key,
    expires,
    userId: toPositiveInt(String(url.searchParams.get("user_id") || ""))
  } : null;
  return { domain, modId, fileId: fileId || null, authorization };
}
const isAuthorizationExpired = (authorization, nowSeconds = Math.floor(Date.now() / 1e3)) => {
  if (!authorization || !authorization.expires) return true;
  return authorization.expires <= nowSeconds;
};
const findNxmArg = (argv) => {
  if (!Array.isArray(argv)) return null;
  for (const arg of argv) {
    if (typeof arg !== "string") continue;
    const text2 = arg.trim().replace(/^"|"$/g, "");
    if (/^nxm:\/\//i.test(text2)) return text2;
  }
  return null;
};
const SCHEME = "nxm";
let handler = null;
const pending = [];
const dispatch = (url) => {
  if (!url) return;
  if (!handler) {
    pending.push(url);
    return;
  }
  try {
    const result = handler(url);
    if (result && typeof result.catch === "function") {
      result.catch((e) => console.warn("[nxm] 处理链接失败：", e?.message || e));
    }
  } catch (e) {
    console.warn("[nxm] 处理链接失败：", e.message);
  }
};
const attachNxmHandler = (fn) => {
  handler = fn;
  while (pending.length) {
    dispatch(pending.shift());
  }
};
const focusMainWindow = () => {
  const win = electron.BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
  if (!win) return;
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  win.focus();
};
const registerClient = () => {
  try {
    if (process.defaultApp && process.argv.length >= 2) {
      electron.app.setAsDefaultProtocolClient(SCHEME, process.execPath, [path.resolve(process.argv[1])]);
    } else {
      electron.app.setAsDefaultProtocolClient(SCHEME);
    }
    console.log(`[nxm] 已注册 ${SCHEME}:// 处理器（${process.defaultApp ? "开发态" : "打包态"}）`);
  } catch (e) {
    console.warn("[nxm] 协议注册失败：", e.message);
  }
};
function setupNxmProtocol() {
  if (!electron.app.requestSingleInstanceLock()) {
    electron.app.quit();
    return false;
  }
  electron.app.on("open-url", (event, url) => {
    event.preventDefault();
    dispatch(url);
  });
  electron.app.on("second-instance", (_event, argv) => {
    focusMainWindow();
    dispatch(findNxmArg(argv));
  });
  electron.app.whenReady().then(() => {
    registerClient();
    dispatch(findNxmArg(process.argv));
  });
  return true;
}
const REST_URL = "https://api.nexusmods.com/v1";
class NxmApiError extends Error {
  constructor(code, message, status) {
    super(message || "请求 Nexus 失败");
    this.name = "NxmApiError";
    this.code = code;
    this.status = status;
  }
}
const readApiKey = () => {
  try {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    return String(settings?.nexusApiKey || "").trim();
  } catch {
    return "";
  }
};
const requestHeaders = (apiKey2) => ({
  apikey: apiKey2,
  accept: "application/json",
  "Application-Name": "ModBox",
  "Application-Version": "1.0.0"
});
const getJson = async (apiPath) => {
  const apiKey2 = readApiKey();
  if (!apiKey2) {
    throw new NxmApiError("NO_KEY", "还没配置 Nexus API Key：设置 → Nexus API Key");
  }
  let res;
  try {
    res = await electron.net.fetch(`${REST_URL}${apiPath}`, {
      headers: requestHeaders(apiKey2),
      signal: AbortSignal.timeout(2e4)
    });
  } catch (e) {
    throw new NxmApiError("NETWORK", `连不上 Nexus（检查代理 / hosts / 网络）：${e.message}`);
  }
  const body = await res.text();
  let data = null;
  try {
    data = body ? JSON.parse(body) : null;
  } catch {
    data = null;
  }
  if (!res.ok) throw new NxmApiError("UPSTREAM", "", res.status);
  return data;
};
const mapDownloadLinkError = (e) => {
  if (e.code !== "UPSTREAM") return e;
  const byStatus = {
    400: "下载授权无效：浏览器和 ModBox 要登录同一个 N 网账号",
    401: "Nexus API Key 无效，去设置里重新配置",
    403: "N 网拒绝了这次下载授权，回网站重新点「Mod Manager Download」",
    404: "这个文件已经不能下载了（可能已被作者删除）",
    410: "下载授权已过期，回网站重新点「Mod Manager Download」",
    429: "N 网请求太频繁，过一会再试"
  };
  return new NxmApiError(
    "DOWNLOAD_LINK",
    byStatus[e.status] || `换取下载直链失败（HTTP ${e.status}）`,
    e.status
  );
};
const fetchModInfo = async (domain, modId) => {
  const data = await getJson(`/games/${encodeURIComponent(domain)}/mods/${modId}.json`);
  return {
    name: data?.name || "",
    version: data?.version || "",
    author: data?.author || data?.uploaded_by || ""
  };
};
const fetchDownloadLink = async ({ domain, modId, fileId, key, expires }) => {
  const params = new URLSearchParams();
  params.set("key", key);
  params.set("expires", String(expires));
  const apiPath = `/games/${encodeURIComponent(domain)}/mods/${modId}/files/${fileId}/download_link.json?${params.toString()}`;
  let data;
  try {
    data = await getJson(apiPath);
  } catch (e) {
    throw mapDownloadLinkError(e);
  }
  const item = Array.isArray(data) ? data.find((entry) => entry && entry.URI) : null;
  if (!item) throw new NxmApiError("NO_LINK", "N 网没有返回可用的下载直链");
  return {
    url: item.URI,
    // name 里已经带了「模组名-ID-版本.扩展名」，直接拿来当文件名最省事
    name: item.name || item.short_name || ""
  };
};
const isUsableFileName = (name) => {
  const base = String(name || "").trim();
  if (!base) return false;
  if (/nexus/i.test(base)) return false;
  const ext = path.extname(base);
  return Boolean(ext) && /^\.[A-Za-z0-9]{1,8}$/.test(ext);
};
const fileNameFromUrl = (rawUrl) => {
  try {
    const url = new URL(rawUrl);
    const segments = url.pathname.split("/").filter(Boolean);
    if (!segments.length) return "";
    const last = decodeURIComponent(segments[segments.length - 1]);
    return isUsableFileName(last) ? last : "";
  } catch {
    return "";
  }
};
const fileNameFromContentDisposition = (header) => {
  if (!header) return "";
  const star = /filename\*\s*=\s*([^;]+)/i.exec(header);
  if (star) {
    const raw = star[1].trim().replace(/^["']|["']$/g, "");
    const encoded = raw.includes("''") ? raw.slice(raw.indexOf("''") + 2) : raw;
    try {
      const decoded = decodeURIComponent(encoded);
      if (isUsableFileName(decoded)) return decoded;
    } catch {
    }
  }
  const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(header);
  if (plain) {
    const raw = (plain[1] || plain[2] || "").trim();
    try {
      const decoded = decodeURIComponent(raw);
      if (isUsableFileName(decoded)) return decoded;
    } catch {
      if (isUsableFileName(raw)) return raw;
    }
  }
  return "";
};
const sanitizeFileName = (raw) => {
  const cleaned = String(raw || "").trim().replace(/[<>:"/\\|?*]/g, "_").split("").filter((ch) => ch.charCodeAt(0) >= 32).join("");
  let base = cleaned.replace(/[. ]+$/, "").trim();
  if (!base) base = "mod-download.bin";
  if (base.length > 180) {
    const ext = path.extname(base);
    base = base.slice(0, Math.max(1, 180 - ext.length)) + ext;
  }
  return base;
};
const uniquePath = (dir, fileName) => {
  const ext = path.extname(fileName);
  const stem = fileName.slice(0, fileName.length - ext.length);
  let candidate = path.join(dir, fileName);
  let i = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${stem} (${i})${ext}`);
    i += 1;
  }
  return candidate;
};
const resolveInitialFileName = ({ apiName, url, modName, modId, fileId }) => {
  const fallbackName = `${modName}-${modId}-${fileId}.zip`;
  const fromApi = isUsableFileName(apiName) ? apiName : "";
  const fromUrl = fromApi ? "" : fileNameFromUrl(url);
  const resolved = fromApi || fromUrl;
  return {
    name: sanitizeFileName(resolved || fallbackName),
    needsHeader: !resolved,
    fallbackName
  };
};
const clearMarkOfTheWeb = (filePath) => {
  if (process.platform !== "win32" || !filePath) return false;
  const zoneStream = `${filePath}:Zone.Identifier`;
  try {
    if (!fs.existsSync(zoneStream)) return false;
    fs.rmSync(zoneStream, { force: true });
    return true;
  } catch (e) {
    console.warn("[download] 清除网络来源标记失败：", e.message);
    return false;
  }
};
const tasks = /* @__PURE__ */ new Map();
const controllers = /* @__PURE__ */ new Map();
let pendingFocus = false;
let ipcReady = false;
const PUBLIC_FIELDS = [
  "id",
  "modName",
  "modId",
  "gameId",
  "gameName",
  "fileName",
  "status",
  "progress",
  "downloadedBytes",
  "totalBytes",
  "speed",
  "eta",
  "error",
  "addedAt",
  "updatedAt",
  "unmatched"
];
const toPublic = (task) => {
  const out = {};
  for (const key of PUBLIC_FIELDS) out[key] = task[key];
  return out;
};
const progressPatch = (task) => ({
  id: task.id,
  downloadedBytes: task.downloadedBytes,
  totalBytes: task.totalBytes,
  progress: task.progress,
  speed: task.speed,
  eta: task.eta,
  updatedAt: task.updatedAt
});
const broadcast = (channel, payload) => {
  for (const win of electron.BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    win.webContents.send(channel, payload);
  }
};
const notify = (level, message) => broadcast("download:notice", { level, message });
const resolveGame = (domain) => {
  const target = String(domain || "").toLowerCase();
  let entries = [];
  try {
    entries = fs.readdirSync(REPO_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  } catch {
    entries = [];
  }
  for (const entry of entries) {
    try {
      const raw = fs.readFileSync(path.join(REPO_DIR, entry.name, "game.json"), "utf-8");
      const game = JSON.parse(raw);
      const gameDomain2 = String(game?.nexusDomain || entry.name || "").toLowerCase();
      if (gameDomain2 === target) {
        return { gameId: entry.name, gameName: game?.name || entry.name, unmatched: false };
      }
    } catch {
    }
  }
  return { gameId: target, gameName: target, unmatched: true };
};
const mapCdnError = (status) => {
  const byStatus = {
    401: "N 网拒绝了这个直链（未授权），回网站重新点「Mod Manager Download」",
    403: "直链已失效或过期，回网站重新点「Mod Manager Download」",
    404: "直链指向的文件不存在了"
  };
  return byStatus[status] || `直链请求失败（HTTP ${status}）`;
};
const failTask = (task, message) => {
  controllers.delete(task.id);
  task.status = "failed";
  task.speed = 0;
  task.eta = null;
  task.error = message;
  task.updatedAt = Date.now();
  try {
    fs.rmSync(task._tmpPath, { force: true });
  } catch {
  }
  broadcast("download:state", toPublic(task));
  notify("error", message);
};
const dropTask = (task) => {
  try {
    fs.rmSync(task._tmpPath, { force: true });
  } catch {
  }
  tasks.delete(task.id);
  controllers.delete(task.id);
  broadcast("download:removed", task.id);
};
const run = async (task) => {
  const controller = new AbortController();
  controllers.set(task.id, { controller, cancelled: false });
  let res;
  try {
    res = await electron.net.fetch(task._url, { signal: controller.signal });
  } catch (e) {
    const entry = controllers.get(task.id);
    controllers.delete(task.id);
    if (entry?.cancelled) {
      dropTask(task);
      return;
    }
    if (task.status === "paused") return;
    failTask(task, `下载失败：${e.message}`);
    return;
  }
  if (!res.ok || !res.body) {
    failTask(task, mapCdnError(res.status));
    return;
  }
  if (task._needsHeaderName) {
    const fromHeader = fileNameFromContentDisposition(res.headers.get("content-disposition"));
    const finalName = sanitizeFileName(fromHeader || task._fallbackName);
    task.fileName = finalName;
    task._finalPath = uniquePath(DOWNLOADS_DIR, finalName);
    task._tmpPath = `${task._finalPath}.part`;
    task._needsHeaderName = false;
    broadcast("download:state", toPublic(task));
  }
  const total = Number(res.headers.get("content-length")) || 0;
  task.totalBytes = total;
  let lastAt = Date.now();
  let lastBytes = 0;
  let lastEmit = 0;
  const meter = new stream.Transform({
    transform(chunk, _enc, cb) {
      task.downloadedBytes += chunk.length;
      if (total > 0) task.progress = Math.min(100, task.downloadedBytes / total * 100);
      const now = Date.now();
      if (now - lastEmit >= 500) {
        const dt = (now - lastAt) / 1e3;
        task.speed = dt > 0 ? (task.downloadedBytes - lastBytes) / dt : 0;
        task.eta = task.speed > 0 && total > 0 ? Math.max(0, (total - task.downloadedBytes) / task.speed) : null;
        task.updatedAt = now;
        broadcast("download:progress", progressPatch(task));
        lastEmit = now;
        lastAt = now;
        lastBytes = task.downloadedBytes;
      }
      cb(null, chunk);
    }
  });
  try {
    await promises.pipeline(stream.Readable.fromWeb(res.body), meter, fs.createWriteStream(task._tmpPath), {
      signal: controller.signal
    });
    fs.renameSync(task._tmpPath, task._finalPath);
    if (clearMarkOfTheWeb(task._finalPath)) {
      console.log(`[download] 已清除网络来源标记：${task.fileName}`);
    }
    controllers.delete(task.id);
    task.status = "completed";
    task.progress = 100;
    if (total > 0) task.downloadedBytes = total;
    task.speed = 0;
    task.eta = null;
    task.error = "";
    task.updatedAt = Date.now();
    broadcast("download:progress", progressPatch(task));
    broadcast("download:state", toPublic(task));
    notify("info", `下载完成：${task.fileName}`);
  } catch (e) {
    const entry = controllers.get(task.id);
    controllers.delete(task.id);
    if (entry?.cancelled) {
      dropTask(task);
      return;
    }
    if (e?.name === "AbortError" || task.status === "paused") {
      task.status = "paused";
      task.speed = 0;
      task.eta = null;
      task.updatedAt = Date.now();
      broadcast("download:state", toPublic(task));
      return;
    }
    failTask(task, `下载中断：${e.message}`);
  }
};
async function handleNxmUrl(rawUrl) {
  const parsed = parseNxmUrl(rawUrl);
  if (!parsed) {
    notify("error", "无法识别的 nxm 链接");
    return;
  }
  console.log(
    `[nxm] 收到链接：${parsed.domain} / mod ${parsed.modId} / file ${parsed.fileId ?? "?"}`
  );
  if (!parsed.authorization) {
    notify(
      "error",
      "这个链接没有下载授权（缺 key/expires），请在 N 网点一次「Mod Manager Download」"
    );
    return;
  }
  if (!parsed.fileId) {
    notify("error", "这个链接里没有文件 ID，无法下载");
    return;
  }
  if (isAuthorizationExpired(parsed.authorization)) {
    notify("error", "下载授权已过期，回 N 网重新点「Mod Manager Download」");
    return;
  }
  pendingFocus = true;
  broadcast("download:focus");
  notify("info", `正在解析链接：${parsed.domain} · 模组 ${parsed.modId}`);
  try {
    const game = resolveGame(parsed.domain);
    let modName = `Mod ${parsed.modId}`;
    try {
      const info = await fetchModInfo(parsed.domain, parsed.modId);
      if (info.name) modName = info.name;
    } catch (e) {
      console.warn("[nxm] 模组信息获取失败：", e.message);
    }
    const link = await fetchDownloadLink({
      domain: parsed.domain,
      modId: parsed.modId,
      fileId: parsed.fileId,
      key: parsed.authorization.key,
      expires: parsed.authorization.expires
    });
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
    const nameInfo = resolveInitialFileName({
      apiName: link.name,
      url: link.url,
      modName,
      modId: parsed.modId,
      fileId: parsed.fileId
    });
    const finalPath = uniquePath(DOWNLOADS_DIR, nameInfo.name);
    const task = {
      id: crypto.randomUUID(),
      modName,
      modId: parsed.modId,
      gameId: game.gameId,
      gameName: game.gameName,
      fileName: path.basename(finalPath),
      status: "downloading",
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      speed: 0,
      eta: null,
      error: "",
      addedAt: Date.now(),
      updatedAt: Date.now(),
      unmatched: game.unmatched,
      // 以下字段只在主进程用，toPublic 不会带出去
      _url: link.url,
      _tmpPath: `${finalPath}.part`,
      _finalPath: finalPath,
      // 名字只定到兜底值时，等响应头里的 content-disposition 再换一次
      _needsHeaderName: nameInfo.needsHeader,
      _fallbackName: nameInfo.fallbackName
    };
    tasks.set(task.id, task);
    broadcast("download:added", toPublic(task));
    run(task);
  } catch (e) {
    notify("error", e?.message || "开始下载失败");
  }
}
const list = () => {
  const focus = pendingFocus;
  pendingFocus = false;
  return { tasks: [...tasks.values()].map(toPublic), focus };
};
const pause = (id) => {
  const task = tasks.get(id);
  if (!task) return { ok: false, error: "任务不存在" };
  if (task.status !== "downloading") return { ok: false, error: "任务不在下载中" };
  task.status = "paused";
  task.speed = 0;
  task.eta = null;
  task.updatedAt = Date.now();
  controllers.get(id)?.controller.abort();
  return { ok: true };
};
const resume = (id) => {
  const task = tasks.get(id);
  if (!task) return { ok: false, error: "任务不存在" };
  if (task.status === "downloading") return { ok: true };
  if (controllers.has(id)) return { ok: false, error: "这个任务还在收尾，稍等一下" };
  try {
    fs.rmSync(task._tmpPath, { force: true });
  } catch {
  }
  task.status = "downloading";
  task.downloadedBytes = 0;
  task.progress = 0;
  task.speed = 0;
  task.eta = null;
  task.error = "";
  task.updatedAt = Date.now();
  broadcast("download:state", toPublic(task));
  run(task);
  return { ok: true };
};
const cancel = (id) => {
  const task = tasks.get(id);
  if (!task) return { ok: false, error: "任务不存在" };
  const entry = controllers.get(id);
  if (entry) {
    entry.cancelled = true;
    entry.controller.abort();
  } else {
    dropTask(task);
  }
  return { ok: true };
};
const pauseAll = () => {
  for (const task of tasks.values()) {
    if (task.status === "downloading") pause(task.id);
  }
  return { ok: true };
};
const reveal = (id) => {
  const task = tasks.get(id);
  if (!task) return { ok: false, error: "任务不存在" };
  const target = task._finalPath || path.join(DOWNLOADS_DIR, task.fileName || "");
  if (!target || !fs.existsSync(target)) return { ok: false, error: "文件不存在" };
  electron.shell.showItemInFolder(target);
  return { ok: true };
};
const safeId = (value) => typeof value === "string" && value ? value : "";
const withId = (fn) => (_event, rawId) => {
  const id = safeId(rawId);
  if (!id) return { ok: false, error: "无效的任务 id" };
  return fn(id);
};
function registerDownloadIpc() {
  if (ipcReady) return;
  ipcReady = true;
  electron.ipcMain.handle("download:list", () => list());
  electron.ipcMain.handle("download:pause", withId(pause));
  electron.ipcMain.handle("download:resume", withId(resume));
  electron.ipcMain.handle("download:cancel", withId(cancel));
  electron.ipcMain.handle("download:remove", withId(cancel));
  electron.ipcMain.handle("download:reveal", withId(reveal));
  electron.ipcMain.handle("download:pause-all", () => pauseAll());
}
const hasSingleInstance = setupNxmProtocol();
let tray = null;
let isQuitting = false;
let mainWindow = null;
function readMinimizeToTray() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8")).minimizeToTray === true;
  } catch {
    return false;
  }
}
function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.show();
  mainWindow.focus();
}
function createTray() {
  if (tray) return;
  const trayIcon = electron.nativeImage.createFromPath(icon).resize({ width: 512, height: 512 });
  tray = new electron.Tray(trayIcon);
  tray.setToolTip("ModBox");
  tray.setContextMenu(
    electron.Menu.buildFromTemplate([
      { label: "显示主界面", click: showMainWindow },
      {
        label: "退出",
        click: () => {
          isQuitting = true;
          electron.app.quit();
        }
      }
    ])
  );
  tray.on("click", showMainWindow);
}
function createWindow() {
  mainWindow = new electron.BrowserWindow({
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
  mainWindow.on("close", (e) => {
    if (isQuitting) return;
    if (!readMinimizeToTray()) return;
    e.preventDefault();
    mainWindow.hide();
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
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
  if (!hasSingleInstance) return;
  utils.electronApp.setAppUserModelId("com.electron");
  electron.Menu.setApplicationMenu(null);
  electron.ipcMain.on("window-minimize", () => mainWindow?.minimize());
  electron.ipcMain.on("window-maximize", () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  electron.ipcMain.on("window-close", () => mainWindow?.close());
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  startServer();
  registerDownloadIpc();
  createWindow();
  createTray();
  attachNxmHandler(handleNxmUrl);
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("before-quit", () => {
  isQuitting = true;
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
