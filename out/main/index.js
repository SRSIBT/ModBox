"use strict";
const path = require("path");
const fs = require("fs");
const url = require("url");
const express = require("express");
const electron = require("electron");
const crypto = require("crypto");
const os = require("os");
const child_process = require("child_process");
const unzipper = require("unzipper");
const utils = require("@electron-toolkit/utils");
const stream = require("stream");
const promises = require("stream/promises");
const http = require("http");
const icon = path.join(__dirname, "../../resources/icon.png");
const DATA_DIR = electron.app.isPackaged ? path.join(path.dirname(electron.app.getPath("exe")), "data") : path.join(__dirname, "../..", "data");
const REPO_DIR = path.join(DATA_DIR, "repo");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const NOTICE_STATE_FILE = path.join(DATA_DIR, "notice-state.json");
const BACKGROUNDS_DIR = path.join(DATA_DIR, "backgrounds");
const DOWNLOADS_DIR = path.join(DATA_DIR, "downloads");
const BUILTIN_RESOURCES_DIR = electron.app.isPackaged ? process.resourcesPath : path.join(__dirname, "../../src/main/resources");
const BUILTIN_COVERS_DIR = path.join(BUILTIN_RESOURCES_DIR, "covers");
const BUILTIN_BACKGROUNDS_DIR = path.join(BUILTIN_RESOURCES_DIR, "backgrounds");
const APP_ROOT = electron.app.isPackaged ? electron.app.getAppPath() : path.join(__dirname, "../..");
const DEFAULT_MOD = {
  cover: "",
  modId: "/",
  version: "/",
  type: "通用",
  author: "/",
  group: "/",
  url: "",
  installed: false,
  describe: ""
};
const DEFAULT_SETTINGS = {
  activeGameId: "",
  theme: "dark",
  viewMode: "table",
  background: "default",
  backgroundOpacity: 50,
  weather: "none",
  minimizeToTray: false,
  // 下载列表上的开关：下完自动解压进模组库
  autoImport: false,
  // 表头宽度；label 由前端维护，这里只持久化 key + width
  modColumns: [
    { key: "status", width: 80 },
    { key: "drag", width: 40 },
    { key: "index", width: 30 },
    { key: "cover", width: 60 },
    { key: "name", width: 200 },
    { key: "type", width: 80 },
    { key: "modId", width: 100 },
    { key: "version", width: 80 },
    { key: "author", width: 80 },
    { key: "group", width: 80 }
  ],
  // 用户实际安装路径。内置游戏只提供元数据，不再保存路径。
  gamePaths: {
    BlackMythWukong: {
      rootPath: "",
      exePath: ""
    },
    Cyberpunk2077: {
      rootPath: "",
      exePath: ""
    },
    KingdomComeDeliverance2: {
      rootPath: "",
      exePath: ""
    },
    RedDeadRedemption2: {
      rootPath: "",
      exePath: ""
    },
    ResidentEvilRequiem: {
      rootPath: "",
      exePath: ""
    },
    Sekiro: {
      rootPath: "",
      exePath: ""
    },
    StellarBlade: {
      rootPath: "",
      exePath: ""
    }
  }
};
const BUILTIN_GAMES = {
  BlackMythWukong: {
    id: "BlackMythWukong",
    name: "黑神话：悟空",
    cover: "/builtin-covers/BlackMythWukong.jpg",
    steamAppId: "2358720",
    nexusDomain: "blackmythwukong",
    installRules: {
      placements: [
        {
          match: "b1",
          mode: "folder",
          into: "{game_root}",
          note: "游戏根目录下真实存在 b1/ 安装树，包内带完整 b1 目录结构时整棵树并入游戏根"
        },
        {
          match: "Engine",
          mode: "folder",
          into: "{game_root}",
          note: "游戏根目录下真实存在 Engine/，包内带 Engine 目录时并入游戏根"
        },
        {
          match: "ue4ss",
          mode: "folder",
          into: "{game_root}/b1/Binaries/Win64/",
          note: "UE4SS 加载器目录放 b1/Binaries/Win64/（黑神话：悟空为 UE5 游戏，UE4SS 装在此处）"
        },
        {
          match: "CSharpLoader",
          mode: "folder",
          into: "{game_root}/b1/Binaries/Win64/",
          note: "CSharpLoader 加载器目录放 b1/Binaries/Win64/"
        },
        {
          match: "dwmapi.dll",
          mode: "files",
          into: "{game_root}/b1/Binaries/Win64/",
          note: "UE4SS 代理 dll，放 b1/Binaries/Win64/"
        },
        {
          match: "Scripts",
          mode: "folder",
          lift: 1,
          into: "{game_root}/b1/Binaries/Win64/ue4ss/Mods",
          note: "UE4SS 脚本：连它上一级的 Mod 目录一起进 ue4ss/Mods"
        },
        {
          match: "LogicMods",
          mode: "folder",
          into: "{game_root}/b1/Content/Paks/",
          note: "蓝图 Mod 目录放 b1/Content/Paks/"
        },
        {
          match: "~mods",
          mode: "folder",
          into: "{game_root}/b1/Content/Paks/",
          note: "包内已带 ~mods 目录时并入 b1/Content/Paks/"
        },
        {
          match: "*.pak",
          mode: "files",
          into: "{game_root}/b1/Content/Paks/~mods",
          note: "散装 PAK 放 b1/Content/Paks/~mods"
        },
        {
          match: "*.ucas",
          mode: "files",
          into: "{game_root}/b1/Content/Paks/~mods",
          note: "散装 UCAS 放 b1/Content/Paks/~mods"
        },
        {
          match: "*.utoc",
          mode: "files",
          into: "{game_root}/b1/Content/Paks/~mods",
          note: "散装 UTOC 放 b1/Content/Paks/~mods"
        }
      ],
      // 这些目录由加载器整目录独占，卸载时可以直接按目录处理。
      // 通用卸载代码不认识这些名字，只读这里的配置。
      exclusiveDirs: [
        "{game_root}/b1/Binaries/Win64/CSharpLoader",
        "{game_root}/b1/Binaries/Win64/ue4ss"
      ],
      cleanup: {
        disableMods: true,
        label: "黑神话：悟空：清空 Paks 下的模组 pak 与 Win64 下的加载器（先卸载所有已安装的模组并把被覆盖的官方文件还原，再清装载点）",
        actions: [
          {
            op: "purge",
            dir: "b1/Content/Paks",
            keepFiles: ["filehash.dat", "pakchunk*.pak", "pakchunk*.sig"],
            note: "除游戏自带的 pakchunk 外全清（含所有子目录）"
          },
          {
            op: "purge",
            dir: "b1/Binaries/Win64",
            keepDirs: ["D3D12"],
            keepFiles: [
              "b1-Win64-Shipping.exe",
              "MonoPosixHelper.dll",
              "OpenImageDenoise.dll",
              "tbb12.dll",
              "amd_fidelityfx_*.dll",
              "tbb.dll"
            ],
            note: "UE4SS / CSharpLoader 的残余都在这儿"
          },
          {
            op: "unlink",
            files: ["b1/Binaries/Win64/dwmapi.dll"],
            note: "模组加载器塞进来的代理 dll"
          }
        ]
      }
    }
  },
  Cyberpunk2077: {
    id: "Cyberpunk2077",
    name: "赛博朋克 2077",
    cover: "/builtin-covers/Cyberpunk2077.jpg",
    steamAppId: "1091500",
    nexusDomain: "cyberpunk2077",
    installRules: {
      placements: [
        {
          match: "archive",
          mode: "folder",
          into: "{game_root}",
          note: "legacy 格式 Mod 的 archive 目录，与游戏自带 archive 合并"
        },
        {
          match: "*.archive",
          mode: "files",
          into: "{game_root}/archive/pc/mod",
          note: "散装 .archive 文件放 archive/pc/mod"
        },
        {
          match: "*.xl",
          mode: "files",
          into: "{game_root}/archive/pc/mod",
          note: "ArchiveXL 的 .xl 文件与 archive 同目录"
        },
        {
          match: "bin",
          mode: "folder",
          into: "{game_root}",
          note: "CET / RED4ext 等框架的 bin 目录并入根"
        },
        {
          match: "r6",
          mode: "folder",
          into: "{game_root}",
          note: "redscript 脚本与 tweaks 配置并入 r6"
        },
        {
          match: "mods",
          mode: "folder",
          into: "{game_root}",
          note: "REDmod 格式的 mods 目录（含 info.json 的子文件夹）"
        },
        {
          match: "*",
          mode: "folder",
          lift: 1,
          into: "{game_root}/archive/pc/mod",
          note: "兜底：无法识别结构的顶层文件夹，当作 legacy Mod 塞进 archive/pc/mod"
        }
      ],
      cleanup: {
        disableMods: true,
        label: "赛博朋克 2077：清空 legacy Mod 目录、REDmod 目录与常见框架插件",
        actions: [
          {
            op: "purge",
            dir: "archive/pc/mod",
            keepFiles: [],
            note: "清空所有用户 .archive / .xl"
          },
          {
            op: "purge",
            dir: "mods",
            keepFiles: [],
            note: "清空 REDmod 格式 Mod（若 REDmod 本体在此会一并删除，按需调整）"
          },
          {
            op: "purge",
            dir: "bin/x64/plugins",
            note: "清空 CET 插件与相关 dll 残余"
          },
          {
            op: "purge",
            dir: "r6/scripts",
            note: "清空 redscript 脚本"
          },
          {
            op: "purge",
            dir: "r6/tweaks",
            note: "清空 TweakXL / ArchiveXL 的 tweaks"
          }
        ]
      }
    }
  },
  KingdomComeDeliverance2: {
    id: "KingdomComeDeliverance2",
    name: "天国：拯救2",
    cover: "/builtin-covers/KingdomComeDeliverance2.jpg",
    steamAppId: "1771300",
    nexusDomain: "kingdomcomedeliverance2",
    installRules: {
      placements: [
        {
          match: "Mods",
          mode: "folder",
          into: "{game_root}",
          note: "包内自带 Mods/ 目录时直接并入根"
        },
        {
          match: "mod.manifest",
          mode: "files",
          lift: 1,
          into: "{game_root}/Mods",
          note: "检测到 mod.manifest 时，把包含它的文件夹整体放入 Mods/"
        },
        {
          match: "*",
          mode: "folder",
          lift: 1,
          into: "{game_root}/Mods",
          note: "兜底：顶层文件夹放入 Mods/"
        }
      ],
      cleanup: {
        disableMods: true,
        label: "天国：拯救2：清空根目录 Mods/ 下所有用户模组",
        actions: [
          {
            op: "purge",
            dir: "Mods",
            keepFiles: [],
            note: "Mods/ 下全部是用户 Mod，直接清空"
          }
        ]
      }
    }
  },
  RedDeadRedemption2: {
    id: "RedDeadRedemption2",
    name: "荒野大镖客：救赎2",
    cover: "/builtin-covers/RedDeadRedemption2.jpg",
    steamAppId: "1174180",
    nexusDomain: "reddeadredemption2",
    installRules: {
      placements: [
        {
          match: "lml",
          mode: "folder",
          into: "{game_root}",
          note: "LML 的 lml/ 目录并入根"
        },
        {
          match: "ModLoader",
          mode: "folder",
          into: "{game_root}",
          note: "Lenny Mod Loader 本体目录"
        },
        {
          match: "ModManager",
          mode: "folder",
          into: "{game_root}",
          note: "Lenny Mod Manager 目录"
        },
        {
          match: "*.asi",
          mode: "files",
          into: "{game_root}",
          note: "ASI 插件放根目录（RDR2.exe 旁）"
        },
        {
          match: "*.dll",
          mode: "files",
          into: "{game_root}",
          note: "ScriptHook / 代理 dll 放根目录，具体以 Mod 说明为准"
        },
        {
          match: "scripts",
          mode: "folder",
          into: "{game_root}",
          note: "部分脚本 Mod 的 scripts/ 目录并入根"
        },
        {
          match: "*",
          mode: "folder",
          into: "{game_root}/lml",
          note: "兜底：无法识别的文件夹丢进 lml/（LML 会读取子文件夹）"
        }
      ],
      cleanup: {
        disableMods: true,
        label: "荒野大镖客2：清空 lml/ 与根目录常见脚本/插件文件",
        actions: [
          {
            op: "purge",
            dir: "lml",
            keepFiles: [],
            note: "清空 LML 下所有 Mod"
          },
          {
            op: "purge",
            dir: "scripts",
            note: "清空 scripts/"
          },
          {
            op: "unlink",
            files: ["dinput8.dll", "ScriptHookRDR2.dll", "vfs.asi", "version.dll"],
            note: "移除常见 ScriptHook / ASI Loader / LML 代理文件"
          }
        ]
      }
    }
  },
  ResidentEvilRequiem: {
    id: "ResidentEvilRequiem",
    name: "生化危机9：安魂曲",
    cover: "/builtin-covers/ResidentEvilRequiem.jpg",
    steamAppId: "3764200",
    nexusDomain: "residentevilrequiem",
    installRules: {
      placements: [
        {
          match: "natives",
          mode: "folder",
          into: "{game_root}",
          note: "纹理/模型替换类 Mod 的 natives/ 目录并入根（合并而非替换）"
        },
        {
          match: "reframework",
          mode: "folder",
          into: "{game_root}",
          note: "脚本/插件类 Mod 的 reframework 目录并入根"
        },
        {
          match: "*.lua",
          mode: "files",
          into: "{game_root}/reframework/autorun",
          note: "散装 Lua 脚本放 reframework/autorun"
        },
        {
          match: "*.exe",
          mode: "files",
          into: "{game_root}",
          note: "少数工具类 exe 放根目录（如 PSVR2Bridge.exe）"
        },
        {
          match: "*.pak",
          mode: "files",
          into: "{game_root}",
          note: "PAK 文件放根目录（需 REFramework 开启 PAK Directory Loading）"
        }
      ],
      cleanup: {
        disableMods: true,
        label: "生化危机9：清空 natives/ 与 reframework/autorun 下的用户 Mod",
        actions: [
          {
            op: "purge",
            dir: "natives",
            note: "清空所有散装纹理/模型 Mod（REFramework 本体不在 natives 里）"
          },
          {
            op: "purge",
            dir: "reframework/autorun",
            note: "清空 autorun 下的用户 Lua 脚本"
          }
        ]
      }
    }
  },
  Sekiro: {
    id: "Sekiro",
    name: "只狼：影逝二度",
    cover: "/builtin-covers/Sekiro.jpg",
    steamAppId: "814380",
    nexusDomain: "sekiro",
    installRules: {
      placements: [
        {
          match: "mods",
          mode: "folder",
          into: "{game_root}",
          note: "包内自带 mods/ 目录时并入根（需与 modengine.ini 的 override 路径一致）"
        },
        {
          match: "parts",
          mode: "folder",
          into: "{game_root}/mods",
          note: "皮肤类 Mod 的 parts/ 直接放 mods/ 下，不要再套一层"
        },
        {
          match: "chr",
          mode: "folder",
          into: "{game_root}/mods",
          note: "角色/NPC 类 Mod 的 chr/ 放 mods/ 下"
        },
        {
          match: "*.dcx",
          mode: "files",
          into: "{game_root}/mods",
          note: "散装 .dcx 文件放 mods/"
        },
        {
          match: "*",
          mode: "folder",
          lift: 1,
          into: "{game_root}/mods",
          note: "兜底：顶层文件夹整体放入 mods/"
        }
      ],
      cleanup: {
        disableMods: true,
        label: "只狼：清空 mods/ 与 ModEngine 代理 dll",
        actions: [
          {
            op: "purge",
            dir: "mods",
            keepFiles: [],
            note: "清空所有用户 Mod"
          },
          {
            op: "unlink",
            files: ["dinput8.dll"],
            note: "移除 ModEngine 的代理 dll"
          }
        ]
      }
    }
  },
  StellarBlade: {
    id: "StellarBlade",
    name: "剑星",
    cover: "/builtin-covers/StellarBlade.jpg",
    steamAppId: "3489700",
    nexusDomain: "stellarblade",
    installRules: {
      placements: [
        {
          match: "~Mods",
          mode: "folder",
          into: "{game_root}/SB/Content/Paks",
          note: "包内自带 ~Mods/ 目录时并入 Paks/"
        },
        {
          match: "~mods",
          mode: "folder",
          into: "{game_root}/SB/Content/Paks",
          note: "同上，大小写变体"
        },
        {
          match: "*.pak",
          mode: "files",
          into: "{game_root}/SB/Content/Paks/~Mods",
          note: "散装 .pak 放 ~Mods/"
        },
        {
          match: "*.ucas",
          mode: "files",
          into: "{game_root}/SB/Content/Paks/~Mods",
          note: "散装 .ucas 放 ~Mods/"
        },
        {
          match: "*.utoc",
          mode: "files",
          into: "{game_root}/SB/Content/Paks/~Mods",
          note: "散装 .utoc 放 ~Mods/"
        },
        {
          match: "*",
          mode: "folder",
          lift: 1,
          into: "{game_root}/SB/Content/Paks/~Mods",
          note: "兜底：无法识别的文件夹塞进 ~Mods/"
        }
      ],
      cleanup: {
        disableMods: true,
        label: "剑星：清空 SB/Content/Paks/~Mods 下的所有 Mod",
        actions: [
          {
            op: "purge",
            dir: "SB/Content/Paks/~Mods",
            keepFiles: [],
            note: "清空 ~Mods/ 下全部内容"
          },
          {
            op: "purge",
            dir: "SB/Content/Paks/~mods",
            note: "清空大小写变体目录（若存在）"
          }
        ]
      }
    }
  }
};
const writeFileAtomic = (file, data, options = {}) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`
  );
  try {
    fs.writeFileSync(tmp, data, options);
    fs.renameSync(tmp, file);
  } finally {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
    }
  }
};
const backupCorruptFile = (file) => {
  if (!fs.existsSync(file)) return "";
  try {
    const stamp = new Date(fs.statSync(file).mtimeMs).toISOString().replace(/[:.]/g, "-");
    const backup = `${file}.corrupt-${stamp}`;
    if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
    return backup;
  } catch (e) {
    console.warn(`[file] 备份失败：${e.message}`);
    return "";
  }
};
const readJson = (file, fallback = null) => {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8").replace(/^\uFEFF/, ""));
  } catch (e) {
    const backup = backupCorruptFile(file);
    throw new Error(
      `${path.basename(file)} 解析失败：${e.message}` + (backup ? `（已备份到 ${backup}）` : "")
    );
  }
};
const writeJson = (file, data, options) => {
  writeFileAtomic(file, JSON.stringify(data, null, 2), options);
};
const isInside = (root, target) => {
  const rel = path.relative(root, target);
  return rel === "" || !rel.startsWith("..") && !path.isAbsolute(rel);
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
const modsFile = (repoDir, gameId) => path.join(repoDir, gameId, "mods.json");
const getModDir = (gameId, modPath) => {
  if (typeof modPath !== "string") return null;
  const name = modPath.trim();
  if (!name || name !== modPath) return null;
  if (name === "." || name === ".." || name.includes("\0")) return null;
  if (/[/\\]/.test(name)) return null;
  if (/[<>:"|?*]/.test(name) || /[. ]$/.test(name)) return null;
  if (path.isAbsolute(name) || /^[A-Za-z]:/.test(name)) return null;
  const modsRoot = path.resolve(REPO_DIR, gameId, "mods");
  const dir = path.resolve(modsRoot, name);
  if (dir === modsRoot || !isInside(modsRoot, dir)) return null;
  return dir;
};
const findModCover = (gameId, modPath) => {
  if (typeof modPath !== "string" || !modPath) return null;
  const dir = path.join(REPO_DIR, gameId, "mods", "covers");
  if (!fs.existsSync(dir)) return null;
  const name = fs.readdirSync(dir).find((file) => path.parse(file).name === modPath);
  return name ? { dir, name } : null;
};
const readGameMods = (gameId, { repoDir = REPO_DIR } = {}) => {
  if (!BUILTIN_GAMES[gameId]) return [];
  const file = modsFile(repoDir, gameId);
  try {
    const data = readJson(file, null);
    if (data === null) return [];
    if (Array.isArray(data.mods)) return data.mods;
    console.warn(`[mods] ${gameId}/mods.json 格式不对，按空列表处理`);
  } catch (e) {
    console.warn(`[mods] ${gameId}/mods.json 读取失败，按空列表处理：${e.message}`);
  }
  return [];
};
const saveGameMods = (gameId, mods, { repoDir = REPO_DIR } = {}) => {
  if (!BUILTIN_GAMES[gameId]) return false;
  writeJson(modsFile(repoDir, gameId), { mods: Array.isArray(mods) ? mods : [] });
  return true;
};
const createMod = ({ id, name, path: modPath, modId = "/" } = {}) => ({
  ...DEFAULT_MOD,
  id,
  name,
  path: modPath,
  modId
});
const clone = (value) => JSON.parse(JSON.stringify(value));
const isObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);
const normalizeColumns = (value) => {
  if (!Array.isArray(value)) return clone(DEFAULT_SETTINGS.modColumns);
  const columns = value.filter((item) => isObject(item) && typeof item.key === "string" && item.key).map((item) => {
    const width = Number(item.width);
    return { key: item.key, width: Number.isFinite(width) && width > 0 ? width : 80 };
  });
  return columns.length ? columns : clone(DEFAULT_SETTINGS.modColumns);
};
const normalizePaths = (value) => {
  const input = isObject(value) ? value : {};
  const result = {};
  for (const id of Object.keys(BUILTIN_GAMES)) {
    const fallback = DEFAULT_SETTINGS.gamePaths[id] || {};
    const item = isObject(input[id]) ? input[id] : {};
    result[id] = {
      rootPath: typeof item.rootPath === "string" ? item.rootPath : fallback.rootPath || "",
      exePath: typeof item.exePath === "string" ? item.exePath : fallback.exePath || ""
    };
  }
  return result;
};
const normalize = (raw) => {
  const input = isObject(raw) ? raw : {};
  const base = clone(DEFAULT_SETTINGS);
  const activeGameId = typeof input.activeGameId === "string" ? input.activeGameId : "";
  return {
    activeGameId: BUILTIN_GAMES[activeGameId] ? activeGameId : "",
    theme: ["light", "dark"].includes(input.theme) ? input.theme : base.theme,
    viewMode: ["table", "card"].includes(input.viewMode) ? input.viewMode : base.viewMode,
    background: ["default", "custom"].includes(input.background) ? input.background : base.background,
    backgroundOpacity: Math.min(
      100,
      Math.max(
        0,
        Number.isFinite(Number(input.backgroundOpacity)) ? Number(input.backgroundOpacity) : base.backgroundOpacity
      )
    ),
    weather: ["none", "rain", "snow"].includes(input.weather) ? input.weather : base.weather,
    minimizeToTray: typeof input.minimizeToTray === "boolean" ? input.minimizeToTray : base.minimizeToTray,
    autoImport: typeof input.autoImport === "boolean" ? input.autoImport : base.autoImport,
    modColumns: normalizeColumns(input.modColumns),
    gamePaths: normalizePaths(input.gamePaths)
  };
};
const readSettings = () => {
  if (!fs.existsSync(SETTINGS_FILE)) {
    const settings = normalize(null);
    writeJson(SETTINGS_FILE, settings);
    return settings;
  }
  try {
    const raw = readJson(SETTINGS_FILE, {});
    const settings = normalize(raw);
    if (JSON.stringify(raw) !== JSON.stringify(settings)) writeJson(SETTINGS_FILE, settings);
    return settings;
  } catch (e) {
    console.warn(`[settings] 文件损坏，使用默认设置：${e.message}`);
    const settings = normalize(null);
    writeJson(SETTINGS_FILE, settings);
    return settings;
  }
};
const saveSettings = (patch = {}) => {
  const current = readSettings();
  const input = isObject(patch) ? patch : {};
  const gamePaths = { ...current.gamePaths };
  if (isObject(input.gamePaths)) {
    for (const [gameId, item] of Object.entries(input.gamePaths)) {
      if (!BUILTIN_GAMES[gameId] || !isObject(item)) continue;
      gamePaths[gameId] = { ...gamePaths[gameId] || {}, ...item };
    }
  }
  const next = normalize({
    ...current,
    ...input,
    gamePaths,
    modColumns: input.modColumns !== void 0 ? input.modColumns : current.modColumns
  });
  writeJson(SETTINGS_FILE, next);
  return next;
};
const findCustomBackground = () => {
  if (!fs.existsSync(BACKGROUNDS_DIR)) return null;
  return fs.readdirSync(BACKGROUNDS_DIR).find((file) => file.toLowerCase().startsWith("custom.")) || null;
};
const getBackgroundState = () => {
  const file = findCustomBackground();
  if (!file) return { hasCustom: false, url: "" };
  try {
    const mtime = Math.round(fs.statSync(path.join(BACKGROUNDS_DIR, file)).mtimeMs);
    return { hasCustom: true, url: `/backgrounds/${encodeURIComponent(file)}?v=${mtime}` };
  } catch {
    return { hasCustom: false, url: "" };
  }
};
const setCustomBackground = (image) => {
  if (!image || !fs.existsSync(image)) throw new Error("图片不存在");
  const ext = path.extname(image).toLowerCase();
  if (!ext) throw new Error("无法识别图片格式");
  fs.mkdirSync(BACKGROUNDS_DIR, { recursive: true });
  const target = path.join(BACKGROUNDS_DIR, `custom${ext}`);
  const old = findCustomBackground();
  fs.copyFileSync(image, target);
  if (old && old !== path.basename(target)) fs.unlinkSync(path.join(BACKGROUNDS_DIR, old));
  return getBackgroundState();
};
const removeCustomBackground = () => {
  const file = findCustomBackground();
  if (file) fs.unlinkSync(path.join(BACKGROUNDS_DIR, file));
  return { hasCustom: false, url: "" };
};
const getGames = () => {
  const settings = readSettings();
  return Object.values(BUILTIN_GAMES).map((game) => {
    const item = settings.gamePaths[game.id] || {};
    return {
      ...game,
      rootPath: item.rootPath || "",
      exePath: item.exePath || ""
    };
  });
};
const getGame = (gameId, { repoDir = REPO_DIR } = {}) => {
  const game = BUILTIN_GAMES[gameId];
  if (!game) return null;
  const item = readSettings().gamePaths[gameId] || {};
  return {
    ...game,
    rootPath: item.rootPath || "",
    exePath: item.exePath || "",
    mods: readGameMods(gameId, { repoDir })
  };
};
const saveGamePaths = (gameId, paths = {}) => {
  if (!BUILTIN_GAMES[gameId]) return null;
  const item = {};
  if (typeof paths.rootPath === "string") item.rootPath = paths.rootPath;
  if (typeof paths.exePath === "string") item.exePath = paths.exePath;
  return saveSettings({ gamePaths: { [gameId]: item } }).gamePaths[gameId];
};
const MANIFEST_FILE = "manifest.json";
const BAK_SUFFIX = ".bak";
const stripControlChars = (value) => [...String(value)].filter((ch) => ch.charCodeAt(0) >= 32).join("");
const toPosix = (value) => value.split(path.sep).join("/");
const readGame = (repoDir, gameId) => {
  const game = getGame(gameId, { repoDir });
  if (!game) throw new Error("游戏不存在");
  if (!game.rootPath) throw new Error("这个游戏还没有设置根目录");
  if (!fs.existsSync(game.rootPath)) throw new Error(`游戏根目录不存在：${game.rootPath}`);
  return { game, gameRoot: path.resolve(game.rootPath) };
};
const findGameProcesses = (gameRoot, exePath = "") => new Promise((resolve) => {
  if (process.platform !== "win32") return resolve([]);
  const script = `
$ErrorActionPreference = 'Stop'
$root = $env:MODBOX_GAME_ROOT
$exe = if ($env:MODBOX_GAME_EXE) { [IO.Path]::GetFileNameWithoutExtension($env:MODBOX_GAME_EXE) } else { '' }
try {
  $items = Get-CimInstance Win32_Process |
    Where-Object {
      ($_.ExecutablePath -and $_.ExecutablePath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) -or
      ($exe -and $_.Name -ieq "$exe.exe")
    }
} catch {
  $items = @()
  if ($exe) {
    $items = Get-Process -Name $exe -ErrorAction SilentlyContinue |
      ForEach-Object { [pscustomobject]@{ Name = "$($_.ProcessName).exe"; ProcessId = $_.Id; ExecutablePath = $_.Path } }
  }
}
$items | Select-Object Name, ProcessId, ExecutablePath | ConvertTo-Json -Compress
`;
  child_process.execFile(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    {
      env: { ...process.env, MODBOX_GAME_ROOT: gameRoot, MODBOX_GAME_EXE: exePath || "" },
      windowsHide: true,
      timeout: 5e3
    },
    (error, stdout) => {
      if (error || !stdout.trim()) return resolve([]);
      try {
        const data = JSON.parse(stdout);
        resolve(Array.isArray(data) ? data : [data]);
      } catch {
        resolve([]);
      }
    }
  );
});
const ensureGameClosed = async (gameRoot, exePath = "") => {
  const processes = await findGameProcesses(gameRoot, exePath);
  if (!processes.length) return;
  const names = [...new Set(processes.map((item) => item.Name).filter(Boolean))];
  throw new Error(
    `游戏还在运行：${names.join("、") || "未知进程"}。请彻底退出游戏（包括启动器）后再操作。`
  );
};
const readRules = (repoDir, gameId) => {
  const game = getGame(gameId, { repoDir });
  const rules = game?.installRules;
  if (!Array.isArray(rules?.placements) || rules.placements.length === 0) {
    throw new Error("这个游戏还没有配置安装规则");
  }
  return { rules, placements: rules.placements };
};
const manifestFile = (repoDir, gameId) => path.join(repoDir, gameId, MANIFEST_FILE);
const emptyManifest = () => ({ mods: {}, backups: {} });
const normalizeManifest = (raw) => {
  const result = emptyManifest();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return result;
  if (raw.mods || raw.backups) {
    result.mods = raw.mods && typeof raw.mods === "object" ? raw.mods : {};
    result.backups = raw.backups && typeof raw.backups === "object" ? raw.backups : {};
    return result;
  }
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object") continue;
    const entry = { ...value };
    delete entry.backups;
    result.mods[key] = entry;
    for (const item of value.backups || []) {
      if (!item?.target || !item?.backup) continue;
      const backup = result.backups[item.target];
      if (backup) {
        if (!backup.owners.includes(key)) backup.owners.push(key);
      } else {
        result.backups[item.target] = { backup: item.backup, owners: [key] };
      }
    }
  }
  return result;
};
const readManifest = (repoDir, gameId) => normalizeManifest(readJson(manifestFile(repoDir, gameId), {}));
const writeManifest = (repoDir, gameId, manifest) => writeJson(manifestFile(repoDir, gameId), manifest);
const setInstalled = (repoDir, gameId, modPath, installed) => {
  try {
    const game = getGame(gameId, { repoDir });
    const mods = game?.mods || [];
    const mod = mods.find((m) => m.path === modPath);
    if (!mod || mod.installed === installed) return;
    mod.installed = installed;
    saveGameMods(gameId, mods, { repoDir });
  } catch (e) {
    console.warn(`[install] 更新安装状态失败：${e.message}`);
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
  if (depth > 8) throw new Error("内置安装规则的 roots 存在循环引用");
  return String(value).replace(/\{(\w+)\}/g, (match, key) => {
    if (key === "game_root" || key === "gameRoot" || key === "root") return gameRoot;
    if (roots && Object.prototype.hasOwnProperty.call(roots, key)) {
      return expandTokens(roots[key], gameRoot, roots, depth + 1);
    }
    throw new Error(`内置安装规则里有未知占位符 {${key}}`);
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
        const destBase = path.join(into, sourceRel ? path.basename(sourceAbs) : safeTitle(title));
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
        if (added === 0)
          warnings.push(`规则 ${rule.id || rule.match} 命中 ${candidate.rel}，但没有新文件`);
      } else {
        if (claimed.has(candidate.rel)) continue;
        const src = path.join(root, ...parts);
        const dst = path.join(into, path.basename(candidate.rel));
        if (!isInside(gameRoot, dst)) throw new Error(`目标路径越界：${dst}`);
        const key = caseInsensitive ? dst.toLowerCase() : dst;
        if (usedDest.has(key)) {
          throw new Error(
            `两个文件被投放到同一位置：${dst}（${usedDest.get(key)} 与 ${candidate.rel}）`
          );
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
const removeCreatedDirs = (dirs) => {
  const sorted = [...new Set(dirs)].sort((a, b) => b.length - a.length);
  for (const dir of sorted) {
    try {
      if (fs.readdirSync(dir).length > 0) continue;
      fs.rmdirSync(dir);
    } catch {
    }
  }
};
async function installMod({ repoDir, gameId, modPath, onProgress }) {
  if (typeof modPath !== "string" || !modPath) throw new Error("无效的 Mod 路径");
  const { game, gameRoot } = readGame(repoDir, gameId);
  await ensureGameClosed(gameRoot, game.exePath);
  const { rules, placements } = readRules(repoDir, gameId);
  let manifest = readManifest(repoDir, gameId);
  if (manifest.mods[modPath]) {
    await uninstallMod({ repoDir, gameId, modPath });
    manifest = readManifest(repoDir, gameId);
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
      throw new Error(`没有任何文件匹配 placements${sample ? `，未匹配示例：${sample}` : ""}`);
    }
    const files = [];
    const createdDirs = /* @__PURE__ */ new Set();
    let backupAdded = false;
    try {
      for (const operation of plan.operations) {
        const missingDirs = [];
        let parent = path.dirname(operation.dst);
        while (parent !== gameRoot && isInside(gameRoot, parent) && !fs.existsSync(parent)) {
          missingDirs.push(parent);
          parent = path.dirname(parent);
        }
        fs.mkdirSync(path.dirname(operation.dst), { recursive: true });
        for (const dir of missingDirs) createdDirs.add(gameRelative(gameRoot, dir));
        const rel = gameRelative(gameRoot, operation.dst);
        if (fs.existsSync(operation.dst)) {
          if (!fs.statSync(operation.dst).isFile()) {
            throw new Error(`目标已存在且不是文件：${operation.dst}`);
          }
          const existing = manifest.backups[rel];
          if (existing) {
            if (!existing.owners.includes(modPath)) existing.owners.push(modPath);
          } else {
            const backup = operation.dst + BAK_SUFFIX;
            fs.copyFileSync(operation.dst, backup);
            manifest.backups[rel] = {
              backup: gameRelative(gameRoot, backup),
              owners: [modPath]
            };
            backupAdded = true;
          }
        }
        fs.copyFileSync(operation.src, operation.dst);
        files.push(rel);
        if (onProgress) {
          onProgress({
            done: files.length,
            total: plan.operations.length,
            file: rel
          });
        }
      }
    } catch (e) {
      if (files.length > 0 || backupAdded) {
        manifest.mods[modPath] = {
          modPath,
          installedAt: (/* @__PURE__ */ new Date()).toISOString(),
          partial: true,
          error: e.message,
          files,
          createdDirs: [...createdDirs]
        };
        writeManifest(repoDir, gameId, manifest);
        setInstalled(repoDir, gameId, modPath, false);
      }
      throw e;
    }
    manifest.mods[modPath] = {
      modPath,
      installedAt: (/* @__PURE__ */ new Date()).toISOString(),
      files,
      createdDirs: [...createdDirs]
    };
    writeManifest(repoDir, gameId, manifest);
    setInstalled(repoDir, gameId, modPath, true);
    return {
      files,
      createdDirs: [...createdDirs],
      unmatched: plan.unmatched,
      warnings: plan.warnings
    };
  } finally {
    if (source.temp) fs.rmSync(source.temp, { recursive: true, force: true });
  }
}
const exclusiveDirsOf = (rules, gameRoot) => {
  const roots = rules.roots || {};
  return (rules.exclusiveDirs || []).map((entry) => {
    const expanded = expandTokens(entry, gameRoot, roots);
    const dir = path.isAbsolute(expanded) ? path.resolve(expanded) : path.resolve(gameRoot, expanded);
    if (!isInside(gameRoot, dir)) throw new Error(`独占目录越界：${dir}`);
    return dir;
  });
};
const clearExclusiveDir = (dir, failures) => {
  const walk = (current) => {
    let items;
    try {
      items = fs.readdirSync(current, { withFileTypes: true });
    } catch (e) {
      failures.push(`${current}（${e.code || e.message}）`);
      return;
    }
    for (const item of items) {
      const full = path.join(current, item.name);
      if (item.isDirectory()) {
        walk(full);
        continue;
      }
      try {
        fs.rmSync(full, { force: true });
      } catch (e) {
        failures.push(`${full}（${e.code || e.message}）`);
      }
    }
  };
  walk(dir);
};
const cleanupBySource = async ({ repoDir, gameId, modPath, gameRoot, manifest }) => {
  let source;
  try {
    source = await prepareSource(repoDir, gameId, modPath);
    const { rules, placements } = readRules(repoDir, gameId);
    const plan = buildPlan({
      root: source.root,
      placements,
      gameRoot,
      title: source.title,
      roots: rules.roots || {}
    });
    const exclusive = exclusiveDirsOf(rules, gameRoot);
    const touched = exclusive.filter(
      (dir) => plan.operations.some((operation) => isInside(dir, operation.dst))
    );
    let removed = 0;
    let restored = 0;
    let failed = 0;
    for (const dir of touched) {
      if (!fs.existsSync(dir)) continue;
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        removed++;
        for (const rel of Object.keys(manifest?.backups || {})) {
          if (isInside(dir, gameAbsolute(gameRoot, rel))) delete manifest.backups[rel];
        }
      } catch {
        failed++;
      }
    }
    for (const operation of plan.operations) {
      if (touched.some((dir) => isInside(dir, operation.dst))) continue;
      const backup = operation.dst + BAK_SUFFIX;
      if (!fs.existsSync(backup)) continue;
      try {
        fs.mkdirSync(path.dirname(operation.dst), { recursive: true });
        fs.copyFileSync(backup, operation.dst);
        fs.rmSync(backup, { force: true });
        restored++;
      } catch {
        failed++;
      }
    }
    return {
      removed,
      restored,
      warning: `没有安装记录，已按安装规则清理 ${removed} 个独占目录、还原 ${restored} 个备份` + (failed ? `，${failed} 项失败` : "") + (touched.length === 0 ? "；该游戏没有声明独占目录，未删除任何普通文件" : "")
    };
  } catch (e) {
    return { removed: 0, restored: 0, warning: `没有安装记录，无法按规则清理：${e.message}` };
  } finally {
    if (source?.temp) fs.rmSync(source.temp, { recursive: true, force: true });
  }
};
async function uninstallMod({ repoDir, gameId, modPath, skipProcessCheck = false }) {
  if (typeof modPath !== "string" || !modPath) throw new Error("无效的 Mod 路径");
  const { game, gameRoot } = readGame(repoDir, gameId);
  if (!skipProcessCheck) await ensureGameClosed(gameRoot, game.exePath);
  const manifest = readManifest(repoDir, gameId);
  const entry = manifest.mods[modPath];
  if (!entry) {
    const result = await cleanupBySource({ repoDir, gameId, modPath, gameRoot, manifest });
    writeManifest(repoDir, gameId, manifest);
    setInstalled(repoDir, gameId, modPath, false);
    return { removed: result.removed, restored: result.restored, warning: result.warning };
  }
  const dirs = new Set((entry.createdDirs || []).map((rel) => gameAbsolute(gameRoot, rel)));
  const failed = [];
  let removed = 0;
  let restored = 0;
  for (const rel of entry.files || []) {
    const target = gameAbsolute(gameRoot, rel);
    const backup = manifest.backups[rel];
    if (backup) {
      const owners = Array.isArray(backup.owners) ? backup.owners : [];
      const others = owners.filter((owner) => owner !== modPath);
      if (others.length > 0) {
        backup.owners = others;
        continue;
      }
      const backupPath = gameAbsolute(gameRoot, backup.backup);
      if (!fs.existsSync(backupPath)) {
        failed.push(`${rel}（原备份不存在）`);
        continue;
      }
      try {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(backupPath, target);
        fs.rmSync(backupPath, { force: true });
        delete manifest.backups[rel];
        restored++;
      } catch (e) {
        failed.push(`${rel}（${e.code || e.message}）`);
      }
      continue;
    }
    if (!fs.existsSync(target)) continue;
    try {
      if (fs.statSync(target).isFile()) {
        fs.rmSync(target, { force: true, maxRetries: 2, retryDelay: 200 });
        removed++;
      }
    } catch (e) {
      failed.push(`${rel}（${e.code || e.message}）`);
    }
  }
  if (failed.length) {
    throw new Error(`卸载没有完成，文件可能还被游戏占用：${failed.slice(0, 5).join("、")}`);
  }
  const exclusiveFailures = [];
  try {
    const { rules } = readRules(repoDir, gameId);
    const touchedFiles = [...entry.files || [], ...entry.createdDirs || []];
    const touchedDirs = exclusiveDirsOf(rules, gameRoot).filter(
      (dir) => touchedFiles.some((rel) => isInside(dir, gameAbsolute(gameRoot, rel)))
    );
    for (const dir of touchedDirs) {
      if (!fs.existsSync(dir)) continue;
      const shared = Object.entries(manifest.backups).some(
        ([rel, item]) => isInside(dir, gameAbsolute(gameRoot, rel)) && (item.owners || []).length > 0
      );
      if (shared) continue;
      clearExclusiveDir(dir, exclusiveFailures);
      for (const rel of Object.keys(manifest.backups)) {
        if (isInside(dir, gameAbsolute(gameRoot, rel))) delete manifest.backups[rel];
      }
    }
  } catch (e) {
    exclusiveFailures.push(e.message);
  }
  removeCreatedDirs(dirs);
  delete manifest.mods[modPath];
  writeManifest(repoDir, gameId, manifest);
  setInstalled(repoDir, gameId, modPath, false);
  return { removed, restored, failed: exclusiveFailures };
}
async function cleanupGameMods({ repoDir, gameId }) {
  const { game, gameRoot } = readGame(repoDir, gameId);
  await ensureGameClosed(gameRoot, game.exePath);
  const manifest = readManifest(repoDir, gameId);
  const modPaths = [
    .../* @__PURE__ */ new Set([...(game.mods || []).map((mod) => mod.path), ...Object.keys(manifest.mods)])
  ].filter(Boolean);
  const failed = [];
  const createdDirs = new Set(
    Object.values(manifest.mods).flatMap(
      (item) => (item.createdDirs || []).map((rel) => gameAbsolute(gameRoot, rel))
    )
  );
  let removed = 0;
  let restored = 0;
  for (const modPath of modPaths) {
    try {
      const result = await uninstallMod({
        repoDir,
        gameId,
        modPath,
        skipProcessCheck: true
      });
      removed += result.removed || 0;
      restored += result.restored || 0;
      if (result.failed?.length) failed.push(...result.failed);
    } catch (e) {
      failed.push(`${modPath}：${e.message}`);
    }
  }
  try {
    const { rules } = readRules(repoDir, gameId);
    const current = readManifest(repoDir, gameId);
    for (const dir of exclusiveDirsOf(rules, gameRoot)) {
      if (!fs.existsSync(dir)) continue;
      const shared = Object.entries(current.backups).some(
        ([rel, item]) => isInside(dir, gameAbsolute(gameRoot, rel)) && (item.owners || []).length > 0
      );
      if (shared) continue;
      clearExclusiveDir(dir, failed);
      for (const rel of Object.keys(current.backups)) {
        if (isInside(dir, gameAbsolute(gameRoot, rel))) delete current.backups[rel];
      }
    }
    writeManifest(repoDir, gameId, current);
  } catch (e) {
    failed.push(e.message);
  }
  removeCreatedDirs(createdDirs);
  return { removed, restored, failed };
}
async function importDownloaded(task) {
  if (!readSettings().autoImport) return null;
  const file = task?._finalPath || "";
  if (!file || !fs.existsSync(file)) return null;
  if (![".zip", ".7z", ".rar"].includes(path.extname(file).toLowerCase())) return null;
  const game = getGame(task.gameId);
  if (!game) return null;
  const name = cleanName(path.basename(file));
  const folder = sanitizeFileName(name);
  const dest = path.join(REPO_DIR, task.gameId, "mods", folder);
  fs.mkdirSync(dest, { recursive: true });
  const sevenZip = find7Zip();
  if (sevenZip) {
    await run$1(sevenZip, ["x", file, `-o${dest}`, "-y"]);
  } else {
    await run$1("tar.exe", ["-xf", file, "-C", dest]);
  }
  const mods = game.mods || [];
  const id = mods.length ? Math.max(...mods.map((m) => Number(m.id) || 0)) + 1 : 1;
  mods.push(createMod({ id, name, path: folder, modId: task.modId }));
  saveGameMods(task.gameId, mods);
  return { name, folder };
}
const run$1 = (cmd, args) => new Promise((resolve, reject) => {
  const child = child_process.spawn(cmd, args, { windowsHide: true, stdio: "ignore" });
  child.on("error", reject);
  child.on("exit", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`${path.basename(cmd)} 退出码 ${code}`));
  });
});
const find7Zip = () => {
  const candidates = [
    path.join(process.resourcesPath || "", "7zip", "7z.exe"),
    path.join(electron.app.getAppPath(), "src", "main", "resources", "7zip", "7z.exe"),
    path.join(process.cwd(), "src", "main", "resources", "7zip", "7z.exe")
  ];
  return candidates.find((item) => item && fs.existsSync(item)) || "";
};
const cleanName = (fileName) => {
  let base = String(fileName).replace(/\.[^./\\]+$/, "");
  base = base.replace(/[-_\s]+\d+([-_.]\d+){2,}$/u, "");
  return base.trim() || String(fileName);
};
const router$4 = express.Router();
const buildTree = (dir) => {
  const items = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return items.map((item) => {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      return { name: item.name, isDir: true, open: false, children: buildTree(full) };
    }
    return { name: item.name, isDir: false, size: fs.statSync(full).size };
  });
};
router$4.get("/mods/files", (req, res) => {
  const { gameId, modPath } = req.query;
  if (!getGame(gameId)) return res.json({ files: [] });
  const dir = getModDir(gameId, modPath);
  if (!dir || !fs.existsSync(dir)) return res.json({ files: [] });
  res.json({ files: buildTree(dir) });
});
router$4.get("/mods/rules", (req, res) => {
  const { gameId } = req.query;
  const builtin = getGame(gameId)?.installRules;
  const placements = Array.isArray(builtin?.placements) ? builtin.placements : [];
  res.json({
    success: true,
    exists: placements.length > 0,
    source: "builtin",
    placements
  });
});
router$4.get("/mods/:id", (req, res) => {
  const id = req.params.id;
  const game = getGame(id);
  if (!game) return res.json({ mods: [] });
  const domain = game.nexusDomain || id.toLowerCase();
  res.json({
    mods: (game.mods || []).map((mod) => ({
      ...mod,
      cover: mod.cover ? `/covers/${id}/mods/covers/${mod.cover}` : "",
      url: mod.modId && mod.modId !== "/" ? `https://www.nexusmods.com/${domain}/mods/${mod.modId}` : ""
    }))
  });
});
router$4.post("/mods/save", (req, res) => {
  const { gameId, mods } = req.body;
  if (!getGame(gameId)) {
    return res.status(404).json({ success: false, error: "游戏不存在" });
  }
  if (!Array.isArray(mods)) {
    return res.status(400).json({ success: false, error: "mods 必须是数组" });
  }
  const saved = mods.map((mod) => {
    const next = { ...mod || {} };
    delete next.url;
    let cover = next.cover || "";
    if (cover.startsWith("/covers/")) cover = cover.split("/").pop();
    return { ...next, cover };
  });
  saveGameMods(gameId, saved);
  res.json({ success: true });
});
router$4.post("/mods/cleanup", async (req, res) => {
  const { gameId } = req.body || {};
  if (!getGame(gameId)) {
    return res.status(404).json({ success: false, error: "游戏不存在" });
  }
  try {
    const result = await cleanupGameMods({ repoDir: REPO_DIR, gameId });
    res.json({ success: true, ...result });
  } catch (e) {
    console.error("[mod.js] 清理 Mod 失败：", e);
    res.status(500).json({ success: false, error: e.message });
  }
});
router$4.post("/mods/delete", async (req, res) => {
  const { gameId, modPath } = req.body || {};
  const game = getGame(gameId);
  if (!game) return res.json({ success: false });
  const dir = getModDir(gameId, modPath);
  if (!dir) {
    return res.status(400).json({ success: false, error: "无效的 Mod 路径" });
  }
  try {
    if (game.rootPath && fs.existsSync(game.rootPath)) {
      await uninstallMod({ repoDir: REPO_DIR, gameId, modPath });
    }
    if (fs.existsSync(dir)) {
      await electron.shell.trashItem(dir);
    }
    let warning = "";
    const cover = findModCover(gameId, modPath);
    if (cover) {
      try {
        await electron.shell.trashItem(path.join(cover.dir, cover.name));
      } catch (e) {
        warning = `Mod 已删除，但封面删除失败：${e.message}`;
        console.warn("[mod.js] 删除 Mod 封面失败：", e);
      }
    }
    const mods = (game.mods || []).filter((m) => m.path !== modPath);
    saveGameMods(gameId, mods);
    res.json({ success: true, ...warning ? { warning } : {} });
  } catch (e) {
    console.error("[mod.js] 删除 Mod 失败：", e);
    res.status(500).json({ success: false, error: e.message });
  }
});
router$4.post("/mods/import", (req, res) => {
  const { gameId, paths } = req.body;
  if (!Array.isArray(paths) || paths.length === 0) {
    return res.status(400).json({ success: false, error: "没有可导入的路径" });
  }
  const game = getGame(gameId);
  if (!game) {
    return res.status(404).json({ success: false, error: "游戏不存在" });
  }
  const mods = Array.isArray(game.mods) ? game.mods : [];
  const dir = path.join(REPO_DIR, gameId, "mods");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const errors = [];
  const archiveExts = [".zip", ".7z", ".rar"];
  paths.forEach((p) => {
    if (typeof p !== "string" || !p) {
      errors.push("无效的导入路径");
      return;
    }
    const name = path.basename(p);
    try {
      const stat = fs.statSync(p);
      const isFolder = stat.isDirectory();
      const isArchive = stat.isFile() && archiveExts.includes(path.extname(p).toLowerCase());
      if (!isFolder && !isArchive) {
        errors.push(`只支持导入文件夹和压缩包：${name}`);
        return;
      }
      const dest = path.join(dir, name);
      if (isFolder) {
        fs.cpSync(p, dest, { recursive: true });
      } else {
        fs.copyFileSync(p, dest);
      }
      const nextId = mods.length > 0 ? Math.max(...mods.map((m) => Number(m.id) || 0)) + 1 : 1;
      mods.push(createMod({ id: nextId, name, path: name }));
    } catch (e) {
      errors.push(`导入失败：${name}（${e.message}）`);
    }
  });
  saveGameMods(gameId, mods);
  res.json({ success: true, errors });
});
router$4.post("/mods/install", async (req, res) => {
  const { gameId, modPath } = req.body;
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
router$4.post("/mods/uninstall", async (req, res) => {
  const { gameId, modPath } = req.body;
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
router$4.post("/mods/cover", (req, res) => {
  const { gameId, modPath, coverPath } = req.body || {};
  if (!getGame(gameId)) {
    return res.status(404).json({ success: false, error: "游戏不存在" });
  }
  if (!getModDir(gameId, modPath)) {
    return res.status(400).json({ success: false, error: "无效的 Mod 路径" });
  }
  if (typeof coverPath !== "string" || !coverPath || !fs.existsSync(coverPath)) {
    return res.status(400).json({ success: false, error: "封面文件不存在" });
  }
  if (!fs.statSync(coverPath).isFile()) {
    return res.status(400).json({ success: false, error: "封面路径不是文件" });
  }
  const ext = path.extname(coverPath).toLowerCase();
  if (!ext) {
    return res.status(400).json({ success: false, error: "无法识别图片格式" });
  }
  const dir = path.join(REPO_DIR, gameId, "mods", "covers");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `${modPath}${ext}`;
  const target = path.join(dir, filename);
  const old = findModCover(gameId, modPath);
  fs.copyFileSync(coverPath, target);
  if (old && old.name !== filename) fs.unlinkSync(path.join(old.dir, old.name));
  res.json({ filename });
});
router$4.post("/mods/open-folder", async (req, res) => {
  const { gameId, modPath } = req.body || {};
  if (!getGame(gameId)) return res.json({ success: false, error: "游戏不存在" });
  const dir = getModDir(gameId, modPath);
  if (!dir || !fs.existsSync(dir)) return res.json({ success: false, error: "Mod 不存在" });
  const error = await electron.shell.openPath(dir);
  res.json({ success: !error, error });
});
const router$3 = express.Router();
router$3.get("/games", (req, res) => {
  res.json({ games: getGames() });
});
router$3.post("/game", (req, res) => {
  const { id, rootPath, exePath } = req.body || {};
  const paths = {};
  if (typeof rootPath === "string") paths.rootPath = rootPath;
  if (typeof exePath === "string") paths.exePath = exePath;
  const saved = saveGamePaths(id, paths);
  if (!saved) return res.status(404).json({ success: false, error: "游戏不存在" });
  res.json({ success: true, rootPath: saved.rootPath || "", exePath: saved.exePath || "" });
});
router$3.post("/game/open-folder", async (req, res) => {
  const { gameId } = req.body || {};
  const game = getGame(gameId);
  if (!game) return res.status(404).json({ success: false, error: "游戏不存在" });
  if (!game.rootPath) {
    return res.json({ success: false, error: "尚未设置游戏根目录" });
  }
  if (!fs.existsSync(game.rootPath)) {
    return res.json({ success: false, error: `游戏根目录不存在：${game.rootPath}` });
  }
  try {
    const error = await electron.shell.openPath(game.rootPath);
    if (error) return res.json({ success: false, error });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});
router$3.post("/game/launch", async (req, res) => {
  const { gameId } = req.body || {};
  const game = getGame(gameId);
  if (!game) return res.status(404).json({ success: false, error: "游戏不存在" });
  let steamError = "";
  if (game.steamAppId) {
    try {
      await electron.shell.openExternal(`steam://rungameid/${game.steamAppId}`);
      return res.json({ success: true, via: "steam" });
    } catch (e) {
      steamError = e.message;
      console.warn("[game.js] Steam 启动失败，尝试 exe 兜底：", e.message);
    }
  }
  if (game.exePath && fs.existsSync(game.exePath)) {
    try {
      const child = child_process.spawn(game.exePath, [], {
        cwd: path.dirname(game.exePath),
        detached: true,
        stdio: "ignore"
      });
      await new Promise((resolve, reject) => {
        child.once("spawn", resolve);
        child.once("error", reject);
      });
      child.unref();
      return res.json({ success: true, via: "exe" });
    } catch (e) {
      return res.status(500).json({
        success: false,
        error: `exe 启动失败：${e.message}` + (steamError ? `；Steam 错误：${steamError}` : "")
      });
    }
  }
  res.json({
    success: false,
    error: steamError ? `Steam 启动失败：${steamError}；也没有可用的 exePath` : "没有可用的 Steam App ID 或 exePath"
  });
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
    properties: ["openDirectory"]
  });
  res.json({ paths: result.filePaths.slice(0, 1) });
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
const NOTICES = [
  {
    id: 1,
    title: "ModBox v0.0.1",
    time: "2026-09-28 15:07:00",
    tag: "置顶",
    content: ["1.自制Mod盒子，项目启动。", "2.完成了标题栏和主题切换。"]
  },
  {
    id: 2,
    title: "ModBox v0.0.2",
    time: "2026-09-30 10:45:00",
    tag: "更新",
    content: ["1.已完成了公告栏基本设计。", "2.准备完成公告栏后端数据动态更新和公告栏UI补充。"]
  },
  {
    id: 3,
    title: "ModBox v0.0.3",
    time: "2026-10-1 13:40:00",
    tag: "更新",
    content: [
      "1.已完成公告栏全部设计。",
      "2.已完成导航栏UI设计。",
      "3.准备完成导航栏后端逻辑设计。"
    ]
  }
];
const router$1 = express.Router();
const readStates = () => {
  try {
    const data = readJson(NOTICE_STATE_FILE, []);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn(`[notice] 已读状态读取失败：${e.message}`);
    return [];
  }
};
router$1.get("/notices", (req, res) => {
  const states = new Map(readStates().map((item) => [Number(item.id), item]));
  res.json({
    notices: NOTICES.map((notice) => {
      const state = states.get(notice.id);
      return { ...notice, read: state?.read === true, readAt: state?.readAt || null };
    })
  });
});
router$1.post("/notices", (req, res) => {
  const incoming = Array.isArray(req.body) ? req.body : [];
  const known = new Set(NOTICES.map((notice) => notice.id));
  const states = new Map(readStates().map((item) => [Number(item.id), item]));
  for (const item of incoming) {
    const id = Number(item?.id);
    if (!known.has(id)) continue;
    states.set(id, { id, read: item?.read === true, readAt: item?.readAt || null });
  }
  writeJson(
    NOTICE_STATE_FILE,
    [...states.values()].sort((a, b) => a.id - b.id)
  );
  res.json({ success: true });
});
const router = express.Router();
router.get("/settings", (req, res) => {
  const bg = getBackgroundState();
  res.json({
    ...readSettings(),
    defaultBgUrl: "/builtin-bg/default.jpg",
    customBgUrl: bg.url,
    hasCustom: bg.hasCustom
  });
});
router.post("/settings", (req, res) => {
  res.json({ success: true, settings: saveSettings(req.body || {}) });
});
router.post("/background/custom", (req, res) => {
  try {
    const bg = setCustomBackground(req.body?.image);
    res.json({ success: true, customBgUrl: bg.url, hasCustom: bg.hasCustom });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});
router.delete("/background/custom", (req, res) => {
  try {
    const bg = removeCustomBackground();
    res.json({ success: true, customBgUrl: bg.url, hasCustom: bg.hasCustom });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});
router.get("/app-info", (req, res) => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(APP_ROOT, "package.json"), "utf-8"));
    res.json({
      name: pkg.name || "",
      version: pkg.version || "",
      author: pkg.author || "",
      description: pkg.description || ""
    });
  } catch {
    res.json({ name: "", version: "", author: "", description: "" });
  }
});
const app = express();
app.use(express.json());
app.use("/covers", express.static(REPO_DIR));
app.use("/backgrounds", express.static(BACKGROUNDS_DIR));
app.use("/builtin-covers", express.static(BUILTIN_COVERS_DIR));
app.use("/builtin-bg", express.static(BUILTIN_BACKGROUNDS_DIR));
app.use("/api", router$3);
app.use("/api", router$4);
app.use("/api", router$1);
app.use("/api", router);
app.use("/api", router$2);
function startServer() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(REPO_DIR, { recursive: true });
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  fs.mkdirSync(BACKGROUNDS_DIR, { recursive: true });
  readSettings();
  app.listen(3e3, () => {
    console.log("Express start: http://localhost:3000");
  });
}
const BIN_DIR = path.join(DATA_DIR, "bin");
const aria2Candidates = () => [
  // 打包后由 extraResources 放到 resources/aria2
  path.join(process.resourcesPath || "", "aria2", "aria2c.exe"),
  // 开发时读源码资源目录
  path.join(electron.app.getAppPath(), "src", "main", "resources", "aria2", "aria2c.exe"),
  // 用户也可以自己放到 data/bin
  path.join(BIN_DIR, "aria2c.exe")
];
const aria2Path = () => aria2Candidates().find((p) => fs.existsSync(p)) || "";
let missingWarned = false;
let proc = null;
let rpcPort = 0;
let rpcSecret = "";
let starting = null;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const rpc = async (method, params = []) => {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: crypto.randomUUID(),
    method,
    params: [`token:${rpcSecret}`, ...params]
  });
  const res = await fetch(`http://127.0.0.1:${rpcPort}/jsonrpc`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    signal: AbortSignal.timeout(8e3)
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "aria2 RPC 调用失败");
  return data.result;
};
const waitForRpc = async (deadline) => {
  while (Date.now() < deadline) {
    try {
      await rpc("aria2.getVersion");
      return true;
    } catch {
      await sleep(150);
    }
  }
  return false;
};
const isRunning = () => Boolean(proc && !proc.killed);
const ensureAria2 = async () => {
  if (isRunning()) return true;
  if (starting) return starting;
  const exe = aria2Path();
  if (!exe) {
    if (!missingWarned) {
      missingWarned = true;
      console.warn("[aria2] 没找到 aria2c.exe，试过这些位置：\n  " + aria2Candidates().join("\n  "));
    }
    return false;
  }
  starting = (async () => {
    rpcPort = 16800 + Math.floor(Math.random() * 400);
    rpcSecret = crypto.randomBytes(12).toString("hex");
    proc = child_process.spawn(
      exe,
      [
        "--enable-rpc=true",
        "--rpc-listen-all=false",
        `--rpc-listen-port=${rpcPort}`,
        `--rpc-secret=${rpcSecret}`,
        "--console-log-level=warn",
        "--summary-interval=0",
        "--max-concurrent-downloads=16",
        "--disk-cache=64M",
        "--auto-file-renaming=false",
        "--allow-overwrite=false",
        "--continue=true",
        "--no-conf=true"
      ],
      { windowsHide: true, stdio: "ignore" }
    );
    proc.on("exit", () => {
      proc = null;
    });
    const ok2 = await waitForRpc(Date.now() + 8e3);
    if (!ok2) {
      stopAria2();
      console.warn("[aria2] 启动失败，退回内置下载器");
      return false;
    }
    console.log(`[aria2] 已启动，监听 127.0.0.1:${rpcPort}`);
    return true;
  })();
  const ok = await starting;
  starting = null;
  return ok;
};
const stopAria2 = () => {
  if (!proc) return;
  try {
    proc.kill();
  } catch {
  }
  proc = null;
};
const addDownload = async ({ url: url2, dir, fileName, headers = [] }) => {
  const options = {
    dir,
    out: fileName,
    continue: "true",
    "auto-file-renaming": "false",
    "allow-overwrite": "false",
    // 不预分配磁盘：大文件起速更快，也不用先占满 75MB
    "file-allocation": "none",
    // 这两项是提速的关键：每个服务器 16 条连接，按几何切分挑片段
    "max-connection-per-server": "16",
    split: "16",
    "min-split-size": "1M",
    "stream-piece-selector": "geom"
  };
  if (headers.length) options.header = headers;
  return rpc("aria2.addUri", [[url2], options]);
};
const tellStatus = (gid) => rpc("aria2.tellStatus", [
  gid,
  ["status", "totalLength", "completedLength", "downloadSpeed", "errorMessage", "files"]
]);
const pauseDownload = (gid) => rpc("aria2.forcePause", [gid]);
const unpauseDownload = (gid) => rpc("aria2.unpause", [gid]);
const removeDownload = (gid) => rpc("aria2.forceRemove", [gid]);
const removeResult = (gid) => rpc("aria2.removeDownloadResult", [gid]);
const EDGE_URL = "https://edge.microsoft.com/translate/translatetext";
const GOOGLE_URL = "https://translate.googleapis.com/translate_a/single";
const EDGE_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0";
const MAX_CACHE = 4e3;
const MAX_TEXT = 2e4;
const CHUNK_SIZE = 1800;
const MAX_BATCH_ITEMS = 40;
const MAX_BATCH_CHARS = 6e3;
const CONCURRENCY = 2;
const REQUEST_GAP_MS = 140;
const cache = /* @__PURE__ */ new Map();
const downUntil = { edge: 0, google: 0 };
let active = 0;
let pumping = false;
const pending$1 = [];
const sha1 = (value) => crypto.createHash("sha1").update(value).digest("hex");
const isDown = (provider) => Date.now() < downUntil[provider];
const markDown = (provider, ms) => {
  downUntil[provider] = Date.now() + ms;
};
const markUp = (provider) => {
  downUntil[provider] = 0;
};
const shouldTrip = (error) => {
  const status = Number(error?.status) || 0;
  return status === 0 || status === 401 || status === 403 || status === 429 || status >= 500;
};
const tripMs = (error) => {
  const status = Number(error?.status) || 0;
  return status === 401 || status === 403 || status === 429 ? 10 * 60 * 1e3 : 60 * 1e3;
};
const cacheKey = (provider, targetLang, text) => `${provider}|${targetLang}|${sha1(text)}`;
const cacheSet = (key, value) => {
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest !== void 0) cache.delete(oldest);
  }
  cache.set(key, value);
};
const enqueue = (task) => new Promise((resolve, reject) => {
  pending$1.push({ task, resolve, reject });
  pump();
});
const pump = () => {
  if (pumping) return;
  pumping = true;
  try {
    while (active < CONCURRENCY && pending$1.length > 0) {
      const job = pending$1.shift();
      active += 1;
      Promise.resolve().then(job.task).then(job.resolve, job.reject).finally(() => {
        active -= 1;
        setTimeout(pump, REQUEST_GAP_MS);
      });
    }
  } finally {
    pumping = false;
  }
};
const normalizeTarget = (provider, targetLang) => {
  const lang = String(targetLang || "").trim() || "zh-Hans";
  if (provider === "google") return lang.toLowerCase() === "zh-hans" ? "zh-CN" : lang;
  return lang.toLowerCase() === "zh-cn" ? "zh-Hans" : lang;
};
const splitText = (text, max = CHUNK_SIZE) => {
  const value = String(text || "");
  if (value.length <= max) return [value];
  const chunks = [];
  let rest = value;
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max);
    if (cut < max * 0.4) cut = rest.lastIndexOf("。", max);
    if (cut < max * 0.4) cut = rest.lastIndexOf(". ", max);
    if (cut < max * 0.4) cut = rest.lastIndexOf(" ", max);
    if (cut < max * 0.3) cut = max;
    chunks.push(rest.slice(0, cut + 1));
    rest = rest.slice(cut + 1);
  }
  if (rest) chunks.push(rest);
  return chunks;
};
const httpText = async (url2, options = {}, timeout = 25e3) => {
  const response = await electron.net.fetch(url2, {
    ...options,
    signal: AbortSignal.timeout(timeout)
  });
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return text;
};
const translateEdgeTexts = async (texts, targetLang) => {
  if (texts.length === 0) return [];
  const url2 = new URL(EDGE_URL);
  url2.searchParams.set("to", targetLang);
  const raw = await httpText(
    url2.toString(),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": EDGE_UA,
        Accept: "*/*"
      },
      body: JSON.stringify(texts)
    },
    3e4
  );
  const data = JSON.parse(raw);
  if (!Array.isArray(data) || data.length !== texts.length) {
    throw new Error("Edge 翻译返回数量不匹配");
  }
  return data.map((item, index) => item?.translations?.[0]?.text || texts[index]);
};
const translateEdgeMany = async (texts, targetLang) => {
  const prepared = texts.map((text) => ({ text, chunks: splitText(text) }));
  const flat = [];
  prepared.forEach((item, index) => {
    item.chunks.forEach((chunk, chunkIndex) => {
      flat.push({ text: chunk, index, chunkIndex });
    });
  });
  const groups = [];
  let current = [];
  let chars = 0;
  for (const item of flat) {
    if (current.length >= MAX_BATCH_ITEMS || current.length > 0 && chars + item.text.length > MAX_BATCH_CHARS) {
      groups.push(current);
      current = [];
      chars = 0;
    }
    current.push(item);
    chars += item.text.length;
  }
  if (current.length > 0) groups.push(current);
  const translated = /* @__PURE__ */ new Map();
  for (const group of groups) {
    const payload = group.map((item) => item.text);
    const output = await translateEdgeTexts(payload, targetLang);
    group.forEach((item, index) => {
      translated.set(`${item.index}:${item.chunkIndex}`, output[index] || item.text);
    });
  }
  return prepared.map(
    (item, index) => item.chunks.map((_, chunkIndex) => translated.get(`${index}:${chunkIndex}`) || "").join("")
  );
};
const translateEdge = async (text, targetLang) => {
  const [translated] = await translateEdgeMany([text], targetLang);
  if (!translated) throw new Error("Edge 翻译没有返回译文");
  return translated;
};
const translateGoogle = async (text, targetLang) => {
  const url2 = new URL(GOOGLE_URL);
  url2.searchParams.set("client", "gtx");
  url2.searchParams.set("sl", "auto");
  url2.searchParams.set("tl", targetLang);
  url2.searchParams.set("dt", "t");
  url2.searchParams.set("q", text);
  const raw = await httpText(url2.toString(), {
    headers: {
      "User-Agent": EDGE_UA,
      Accept: "*/*"
    }
  });
  const data = JSON.parse(raw);
  const parts = Array.isArray(data?.[0]) ? data[0] : [];
  const out = parts.map((part) => part?.[0] || "").join("");
  if (!out) throw new Error("Google 翻译没有返回译文");
  return out;
};
const providers = {
  edge: translateEdge,
  google: translateGoogle
};
const providerChain = (provider) => provider === "google" ? ["google", "edge"] : ["edge", "google"];
async function translateText(options = {}) {
  const provider = options.provider === "google" ? "google" : "edge";
  const text = String(options.text ?? "").replace(/\r\n/g, "\n").slice(0, MAX_TEXT).trim();
  if (!text) return "";
  const targetLang = normalizeTarget(provider, options.targetLang);
  const key = cacheKey(provider, targetLang, text);
  const cached = cache.get(key);
  if (cached !== void 0) return cached;
  let lastError = null;
  for (const name of providerChain(provider)) {
    if (isDown(name)) continue;
    try {
      const translated = await enqueue(
        () => providers[name](text, normalizeTarget(name, targetLang))
      );
      cacheSet(key, translated);
      markUp(name);
      return translated;
    } catch (error) {
      lastError = error;
      if (shouldTrip(error)) markDown(name, tripMs(error));
      console.warn(`[translate] ${name} 失败：${error?.message || error}`);
    }
  }
  throw lastError || new Error("翻译服务暂不可用");
}
async function translateBatch(options = {}) {
  const list2 = Array.isArray(options.texts) ? options.texts.slice(0, 80) : [];
  if (list2.length === 0) return [];
  const provider = options.provider === "google" ? "google" : "edge";
  const targetLang = normalizeTarget(provider, options.targetLang);
  const normalized = list2.map((item) => String(item ?? "").slice(0, MAX_TEXT));
  const unique = [...new Set(normalized)];
  const result = /* @__PURE__ */ new Map();
  const pendingTexts = [];
  for (const text of unique) {
    if (!text.trim()) {
      result.set(text, text);
      continue;
    }
    const key = cacheKey(provider, targetLang, text);
    const cached = cache.get(key);
    if (cached !== void 0) {
      result.set(text, cached);
      continue;
    }
    pendingTexts.push(text);
  }
  if (provider === "edge" && !isDown("edge") && pendingTexts.length > 0) {
    try {
      const translations = await enqueue(() => translateEdgeMany(pendingTexts, targetLang));
      pendingTexts.forEach((text, index) => {
        const translated = translations[index] || text;
        result.set(text, translated);
        cacheSet(cacheKey(provider, targetLang, text), translated);
      });
      markUp("edge");
    } catch (error) {
      if (shouldTrip(error)) markDown("edge", tripMs(error));
      console.warn(`[translate] edge 批量失败：${error?.message || error}`);
    }
  }
  await Promise.all(
    pendingTexts.filter((text) => !result.has(text)).map(async (text) => {
      try {
        result.set(text, await translateText({ text, provider, targetLang }));
      } catch {
        result.set(text, text);
      }
    })
  );
  return normalized.map((text) => result.get(text) ?? text);
}
let registered = false;
function registerTranslateIpc() {
  if (registered) return;
  registered = true;
  electron.ipcMain.handle("translate:batch", (_event, options) => translateBatch(options));
}
const POSITIVE_INT = /^\d+$/;
const toPositiveInt = (value) => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!POSITIVE_INT.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};
function parseNxmUrl(raw) {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text || text.length > 8192) return null;
  let url2;
  try {
    url2 = new URL(text);
  } catch {
    return null;
  }
  if (url2.protocol.toLowerCase() !== "nxm:") return null;
  const domain = String(url2.hostname || "").toLowerCase();
  if (!domain) return null;
  const segments = url2.pathname.split("/").filter(Boolean);
  const modsIndex = segments.findIndex((item) => item.toLowerCase() === "mods");
  if (modsIndex < 0 || modsIndex + 1 >= segments.length) return null;
  const modId = toPositiveInt(segments[modsIndex + 1]);
  if (!modId) return null;
  let fileId = null;
  if (segments[modsIndex + 2]?.toLowerCase() === "files") {
    fileId = toPositiveInt(segments[modsIndex + 3] || "");
  }
  if (!fileId) fileId = toPositiveInt(url2.searchParams.get("file_id") || "");
  const key = String(url2.searchParams.get("key") || "").trim();
  const expires = toPositiveInt(String(url2.searchParams.get("expires") || ""));
  const authorization = key && key.length <= 2048 && expires ? {
    key,
    expires,
    userId: toPositiveInt(String(url2.searchParams.get("user_id") || ""))
  } : null;
  return { domain, modId, fileId: fileId || null, authorization };
}
const isAuthorizationExpired = (authorization, nowSeconds = Math.floor(Date.now() / 1e3)) => {
  if (!authorization?.expires) return true;
  return authorization.expires <= nowSeconds;
};
const findNxmArg = (argv) => {
  if (!Array.isArray(argv)) return null;
  for (const arg of argv) {
    if (typeof arg !== "string") continue;
    const text = arg.trim().replace(/^"|"$/g, "");
    if (/^nxm:\/\//i.test(text)) return text;
  }
  return null;
};
const SCHEME = "nxm";
let handler = null;
const pending = [];
const dispatch = (url2) => {
  if (!url2) return;
  if (!handler) {
    pending.push(url2);
    return;
  }
  try {
    const result = handler(url2);
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
  } catch (e) {
    console.warn("[nxm] 协议注册失败：", e.message);
  }
};
function setupNxmProtocol() {
  if (!electron.app.requestSingleInstanceLock()) {
    electron.app.quit();
    return false;
  }
  electron.app.on("open-url", (event, url2) => {
    event.preventDefault();
    dispatch(url2);
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
const CLIENT_ID = "vortex_loopback";
const OAUTH_BASE = "https://users.nexusmods.com/oauth";
const API_BASE = "https://api.nexusmods.com/v1";
const SCOPES = "openid profile email";
const PARTITION = "persist:nexus";
const AUTH_FILE = path.join(DATA_DIR, "nexus-auth.json");
const LOGIN_TIMEOUT_MS = 5 * 60 * 1e3;
class NexusAuthError extends Error {
  constructor(code, message) {
    super(message || "N 网登录失败");
    this.name = "NexusAuthError";
    this.code = code;
  }
}
let cachedAuth = null;
let refreshPromise = null;
let loginPromise = null;
const readAuth = () => {
  if (cachedAuth) return cachedAuth;
  try {
    cachedAuth = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
  } catch {
    cachedAuth = null;
  }
  return cachedAuth;
};
const writeAuth = (auth) => {
  writeJson(AUTH_FILE, auth, { mode: 384 });
  cachedAuth = auth;
  return auth;
};
const clearAuth = () => {
  cachedAuth = null;
  try {
    fs.rmSync(AUTH_FILE, { force: true });
  } catch {
  }
};
const isExpiring = (auth) => !auth?.expiresAt || Date.now() > auth.expiresAt - 60 * 1e3;
const parseJson = async (response, fallback) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
};
const requestToken = async (params) => {
  let response;
  try {
    response = await electron.net.fetch(`${OAUTH_BASE}/token`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(25e3)
    });
  } catch (error) {
    throw new NexusAuthError("NETWORK", `连不上 N 网登录服务：${error.message}`);
  }
  const data = await parseJson(response, {});
  if (!response.ok || !data.access_token) {
    const message = data.error_description || data.error || `HTTP ${response.status}`;
    throw new NexusAuthError("TOKEN", `N 网授权失败：${message}`);
  }
  return data;
};
const fetchUserInfo = async (accessToken) => {
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
    "Application-Name": "ModBox",
    "Application-Version": "1.0.0"
  };
  try {
    const response = await electron.net.fetch(`${API_BASE}/users/validate.json`, {
      headers,
      signal: AbortSignal.timeout(2e4)
    });
    if (response.ok) {
      const user = await parseJson(response, {});
      return {
        name: user.name || user.username || "N 网用户",
        email: user.email || "",
        avatar: user.avatar_url || user.avatar || "",
        isPremium: Boolean(user.is_premium),
        isSupporter: Boolean(user.is_supporter)
      };
    }
  } catch {
  }
  try {
    const response = await electron.net.fetch(`${OAUTH_BASE}/userinfo`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(2e4)
    });
    if (response.ok) {
      const user = await parseJson(response, {});
      return {
        name: user.name || user.preferred_username || user.username || "N 网用户",
        email: user.email || "",
        avatar: user.picture || user.avatar_url || "",
        isPremium: Boolean(user.is_premium),
        isSupporter: Boolean(user.is_supporter)
      };
    }
  } catch {
  }
  return { name: "N 网用户", email: "", avatar: "", isPremium: false, isSupporter: false };
};
const refreshAccessToken = async (auth) => {
  if (!auth?.refreshToken) throw new NexusAuthError("AUTH", "请先登录 N 网");
  try {
    const data = await requestToken({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: auth.refreshToken
    });
    return writeAuth({
      ...auth,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || auth.refreshToken,
      expiresAt: Date.now() + Math.max(60, Number(data.expires_in) || 3600) * 1e3
    });
  } catch (error) {
    if (error?.code !== "NETWORK") clearAuth();
    throw error;
  }
};
const getAuthStatus = () => {
  const auth = readAuth();
  return {
    loggedIn: Boolean(auth?.accessToken || auth?.refreshToken),
    user: auth?.user || null,
    expiresAt: auth?.expiresAt || 0
  };
};
const getAccessToken = async () => {
  const auth = readAuth();
  if (!auth?.accessToken && !auth?.refreshToken) throw new NexusAuthError("AUTH", "请先登录 N 网");
  if (auth?.accessToken && !isExpiring(auth)) return auth.accessToken;
  if (!auth?.refreshToken) throw new NexusAuthError("AUTH", "N 网登录已过期，请重新登录");
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken(auth).finally(() => {
      refreshPromise = null;
    });
  }
  const next = await refreshPromise;
  return next.accessToken;
};
const escapeHtml = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const callbackPage = (success, message) => `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>ModBox · N 网授权</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#10151c;color:#e8edf3;font-family:Segoe UI,Microsoft YaHei,sans-serif">
  <main style="max-width:520px;padding:32px;text-align:center">
    <h1 style="color:${success ? "#34d399" : "#f87171"};font-size:24px">${success ? "授权成功" : "授权失败"}</h1>
    <p style="color:#b7c0cc;line-height:1.7">${escapeHtml(message)}</p>
    <p style="color:#7f8b99;font-size:13px">窗口即将关闭。</p>
  </main>
</body>
</html>`;
const exchangeCode = async ({ code, verifier, redirectUri }) => {
  const token = await requestToken({
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    code,
    code_verifier: verifier
  });
  const accessToken = token.access_token;
  const refreshToken = token.refresh_token || "";
  const expiresAt = Date.now() + Math.max(60, Number(token.expires_in) || 3600) * 1e3;
  const user = await fetchUserInfo(accessToken);
  return writeAuth({ accessToken, refreshToken, expiresAt, user });
};
const runLogin = async () => {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const state = crypto.randomBytes(16).toString("hex");
  let finish = () => {
  };
  let timeout = null;
  let authWindow = null;
  const server = http.createServer((request, response) => {
    void (async () => {
      const requestUrl = new URL(
        request.url || "/",
        `http://${request.headers.host || "127.0.0.1"}`
      );
      if (requestUrl.pathname !== "/") {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      const returnedState = requestUrl.searchParams.get("state") || "";
      const code = requestUrl.searchParams.get("code") || "";
      const oauthError = requestUrl.searchParams.get("error") || "";
      const oauthDescription = requestUrl.searchParams.get("error_description") || "";
      if (returnedState !== state) {
        response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        response.end(callbackPage(false, "授权状态校验失败，请重新授权。"));
        finish(new NexusAuthError("STATE", "N 网授权状态校验失败"));
        return;
      }
      if (oauthError || !code) {
        response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        response.end(callbackPage(false, oauthDescription || "N 网没有返回授权码。"));
        finish(new NexusAuthError("CALLBACK", oauthDescription || "N 网没有返回授权码"));
        return;
      }
      try {
        const auth = await exchangeCode({ code, verifier, redirectUri });
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(callbackPage(true, `已授权：${auth.user?.name || "N 网用户"}`));
        finish(void 0, auth);
      } catch (error) {
        response.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
        response.end(callbackPage(false, error?.message || "授权处理失败。"));
        finish(error);
      }
    })();
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new NexusAuthError("SERVER", "无法启动授权回调服务");
  }
  const redirectUri = `http://127.0.0.1:${address.port}`;
  const authorizeUrl = new URL(`${OAUTH_BASE}/authorize`);
  authorizeUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256"
  }).toString();
  return new Promise((resolve, reject) => {
    let settled = false;
    finish = (error, auth) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        if (authWindow && !authWindow.isDestroyed()) authWindow.close();
      } catch {
      }
      server.close();
      if (error) reject(error);
      else resolve(auth);
    };
    timeout = setTimeout(() => {
      finish(new NexusAuthError("TIMEOUT", "授权等待超时，请重试"));
    }, LOGIN_TIMEOUT_MS);
    const parent = electron.BrowserWindow.getAllWindows().find((win) => !win.isDestroyed());
    authWindow = new electron.BrowserWindow({
      width: 520,
      height: 760,
      minWidth: 420,
      minHeight: 560,
      parent,
      modal: true,
      title: "授权 ModBox 访问 N 网",
      autoHideMenuBar: true,
      webPreferences: {
        partition: PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    authWindow.on("closed", () => {
      finish(new NexusAuthError("CANCELLED", "已取消 N 网授权"));
    });
    authWindow.webContents.setWindowOpenHandler(({ url: url2 }) => {
      if (/^https?:\/\//i.test(url2)) authWindow?.loadURL(url2);
      return { action: "deny" };
    });
    void authWindow.loadURL(authorizeUrl.toString());
  });
};
const loginNexus = () => {
  if (loginPromise) return loginPromise;
  loginPromise = runLogin().finally(() => {
    loginPromise = null;
  });
  return loginPromise;
};
const REST_URL = "https://api.nexusmods.com/v1";
class NxmApiError extends Error {
  constructor(code, message, status) {
    super(message || "请求 Nexus 失败");
    this.name = "NxmApiError";
    this.code = code;
    this.status = status;
  }
}
const authHeaders = async () => {
  let token = "";
  try {
    token = await getAccessToken();
  } catch (error) {
    if (error instanceof NexusAuthError) throw error;
    throw new NexusAuthError("AUTH", "N 网登录状态无效，请重新登录");
  }
  return {
    accept: "application/json",
    authorization: `Bearer ${token}`,
    "Application-Name": "ModBox",
    "Application-Version": "1.0.0"
  };
};
const getJson = async (apiPath) => {
  const headers = await authHeaders();
  let res;
  try {
    res = await electron.net.fetch(`${REST_URL}${apiPath}`, {
      headers,
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
  if (e instanceof NexusAuthError) return e;
  if (e.code !== "UPSTREAM") return e;
  const byStatus = {
    400: "下载授权无效：请在 N 网页面重新点一次下载",
    401: "N 网登录已过期，请重新授权",
    403: "N 网拒绝了这次下载授权；请确认已登录，或回 N 网页面重新下载",
    404: "这个文件已经不能下载了（可能已被作者删除）",
    410: "下载授权已过期，回 N 网页面重新下载",
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
  if (key) params.set("key", key);
  if (expires) params.set("expires", String(expires));
  const query = params.toString();
  const apiPath = `/games/${encodeURIComponent(domain)}/mods/${modId}/files/${fileId}/download_link.json` + (query ? `?${query}` : "");
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
    name: item.name || item.short_name || ""
  };
};
const COMPLETED_FILE = path.join(DOWNLOADS_DIR, "completed.json");
const isUsableFileName = (name) => {
  const base = String(name || "").trim();
  if (!base || /nexus/i.test(base)) return false;
  return /^\.[A-Za-z0-9]{1,8}$/.test(path.extname(base));
};
const fileNameFromUrl = (rawUrl) => {
  try {
    const segments = new URL(rawUrl).pathname.split("/").filter(Boolean);
    const last = decodeURIComponent(segments.pop() || "");
    return isUsableFileName(last) ? last : "";
  } catch {
    return "";
  }
};
const fileNameFromContentDisposition = (header) => {
  if (!header) return "";
  const star = /filename\*\s*=\s*([^;]+)/i.exec(header);
  if (star) {
    const raw2 = star[1].trim().replace(/^["']|["']$/g, "");
    try {
      const name = decodeURIComponent(raw2.includes("''") ? raw2.split("''").pop() : raw2);
      if (isUsableFileName(name)) return name;
    } catch {
    }
  }
  const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(header);
  if (!plain) return "";
  const raw = (plain[1] || plain[2] || "").trim();
  try {
    const name = decodeURIComponent(raw);
    if (isUsableFileName(name)) return name;
  } catch {
    if (isUsableFileName(raw)) return raw;
  }
  return "";
};
const uniquePath = (dir, fileName) => {
  const ext = path.extname(fileName);
  const stem = fileName.slice(0, fileName.length - ext.length);
  let file = path.join(dir, fileName);
  let i = 1;
  while (fs.existsSync(file)) {
    file = path.join(dir, `${stem} (${i})${ext}`);
    i += 1;
  }
  return file;
};
const resolveInitialFileName = ({ apiName, url: url2, modName, modId, fileId }) => {
  const fallbackName = `${modName}-${modId}-${fileId}.zip`;
  const fromApi = isUsableFileName(apiName) ? apiName : "";
  const resolved = fromApi || fileNameFromUrl(url2);
  return {
    name: sanitizeFileName(resolved || fallbackName),
    needsHeader: !resolved,
    fallbackName
  };
};
const tasks = /* @__PURE__ */ new Map();
const controllers = /* @__PURE__ */ new Map();
let pendingFocus = false;
let ipcReady = false;
let aria2Warned = false;
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
const readCompleted = () => {
  try {
    const data = JSON.parse(fs.readFileSync(COMPLETED_FILE, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};
for (const record of readCompleted()) {
  if (!record?.id) continue;
  const filePath = typeof record.path === "string" && record.path ? record.path : path.join(DOWNLOADS_DIR, record.fileName || "");
  tasks.set(record.id, {
    ...record,
    status: "completed",
    _finalPath: filePath,
    _tmpPath: `${filePath}.part`,
    _fallbackName: record.fileName || ""
  });
}
const persistCompleted = () => {
  try {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
    const list2 = [...tasks.values()].filter((task) => task.status === "completed").map((task) => ({
      ...toPublic(task),
      path: task._finalPath || path.join(DOWNLOADS_DIR, task.fileName || "")
    }));
    fs.writeFileSync(COMPLETED_FILE, JSON.stringify(list2, null, 2), "utf-8");
  } catch (e) {
    console.warn("[download] 写入已完成记录失败：", e.message);
  }
};
const resolveGame = (domain) => {
  const target = String(domain || "").toLowerCase();
  for (const game of getGames()) {
    const gameDomain = String(game.nexusDomain || game.id || "").toLowerCase();
    if (gameDomain === target) {
      return { gameId: game.id, gameName: game.name || game.id, unmatched: false };
    }
  }
  return { gameId: target, gameName: target, unmatched: true };
};
const mapCdnError = (status) => {
  const byStatus = {
    401: "直链需要授权（未登录或授权已过期）",
    403: "直链已失效或过期，回 N 网重新点一次下载",
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
  console.error(`[download] 失败：${task.fileName} — ${message}`);
  broadcast("download:state", toPublic(task));
  notify("error", message);
};
const removeTaskFiles = (task) => {
  const paths = /* @__PURE__ */ new Set([
    task._tmpPath,
    task._finalPath,
    task._finalPath ? `${task._finalPath}.aria2` : ""
  ]);
  for (const file of paths) {
    if (!file) continue;
    try {
      fs.rmSync(file, { force: true });
    } catch {
    }
  }
};
const dropTask = (task, keepFile = false) => {
  if (!keepFile) removeTaskFiles(task);
  tasks.delete(task.id);
  controllers.delete(task.id);
  broadcast("download:removed", task.id);
  persistCompleted();
};
const IDLE_TIMEOUT_MS = 3e4;
const MAX_ATTEMPTS = 3;
const run = async (task) => {
  let attempt = 0;
  while (attempt < MAX_ATTEMPTS) {
    attempt += 1;
    const controller = new AbortController();
    controllers.set(task.id, { controller, cancelled: false });
    let stalled = false;
    let lastDataAt = Date.now();
    let stallTimer = null;
    const stopWatch = () => {
      if (stallTimer) clearInterval(stallTimer);
      stallTimer = null;
    };
    try {
      const headers = { ...task._headers || {} };
      if (task.downloadedBytes > 0) headers.Range = `bytes=${task.downloadedBytes}-`;
      const res = task._ses ? await task._ses.fetch(task._url, { signal: controller.signal, headers }) : await electron.net.fetch(task._url, { signal: controller.signal, headers });
      if (!res.ok || !res.body) {
        controllers.delete(task.id);
        failTask(task, mapCdnError(res.status));
        return;
      }
      const resuming = res.status === 206 && task.downloadedBytes > 0;
      if (!resuming && task.downloadedBytes > 0) {
        task.downloadedBytes = 0;
        task.progress = 0;
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
      const contentLength = Number(res.headers.get("content-length")) || 0;
      const total = resuming ? task.downloadedBytes + contentLength : contentLength;
      task.totalBytes = total;
      let lastAt = Date.now();
      let lastBytes = task.downloadedBytes;
      let lastEmit = 0;
      const meter = new stream.Transform({
        transform(chunk, _enc, cb) {
          lastDataAt = Date.now();
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
      lastDataAt = Date.now();
      stallTimer = setInterval(() => {
        if (Date.now() - lastDataAt < IDLE_TIMEOUT_MS) return;
        stallTimer = null;
        stalled = true;
        console.warn(`[download] ${IDLE_TIMEOUT_MS / 1e3} 秒没有数据，判定连接卡死，准备续传`);
        controller.abort();
      }, 2e3);
      await promises.pipeline(
        stream.Readable.fromWeb(res.body),
        meter,
        fs.createWriteStream(task._tmpPath, { flags: resuming ? "a" : "w" }),
        { signal: controller.signal }
      );
      stopWatch();
      controllers.delete(task.id);
      fs.renameSync(task._tmpPath, task._finalPath);
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
      persistCompleted();
      afterComplete(task);
      return;
    } catch (e) {
      stopWatch();
      const entry = controllers.get(task.id);
      controllers.delete(task.id);
      if (entry?.cancelled) {
        dropTask(task);
        return;
      }
      if (e?.name === "AbortError" && !stalled) {
        task.status = "paused";
        task.speed = 0;
        task.eta = null;
        task.updatedAt = Date.now();
        broadcast("download:state", toPublic(task));
        return;
      }
      if (task.status === "paused") return;
      if (attempt < MAX_ATTEMPTS) {
        console.warn(
          `[download] 第 ${attempt} 次中断（${stalled ? "连接卡死" : e.message}），已收 ${task.downloadedBytes} 字节，准备续传`
        );
        task.status = "downloading";
        task.updatedAt = Date.now();
        continue;
      }
      failTask(task, stalled ? "连接反复卡死，重试 3 次仍未完成" : `下载中断：${e.message}`);
      return;
    }
  }
};
const startTask = async (task) => {
  if (!tasks.has(task.id) || task.status !== "downloading") return;
  try {
    if (await ensureAria2()) {
      const headers = [];
      for (const [key, value] of Object.entries(task._headers || {})) {
        headers.push(`${key}: ${value}`);
      }
      if (task._cookieHeader) headers.push(`Cookie: ${task._cookieHeader}`);
      task._gid = await addDownload({
        url: task._url,
        dir: DOWNLOADS_DIR,
        fileName: task.fileName,
        headers
      });
      broadcast("download:state", toPublic(task));
      trackAria2(task);
      return;
    }
    if (!aria2Warned) {
      aria2Warned = true;
      console.warn(
        "[download] 没找到 aria2c.exe，使用内置下载器（把 aria2c.exe 放到 data/bin/ 可启用 16 连接）"
      );
    }
  } catch (e) {
    console.warn("[download] aria2 启动下载失败，退回内置下载器：", e.message);
    task._gid = "";
  }
  run(task);
};
const afterComplete = (task) => {
  importDownloaded(task).then((result) => {
    if (!result) return;
    notify("info", `已自动导入：${result.name}`);
    broadcast("download:imported", { gameId: task.gameId, name: result.name });
  }).catch((e) => notify("error", `自动导入失败：${e.message}`));
};
const finishTask = (task, filePath) => {
  const finalPath = filePath || task._finalPath || "";
  task._finalPath = finalPath;
  if (finalPath) {
    try {
      fs.rmSync(`${finalPath}.aria2`, { force: true });
    } catch {
    }
  }
  task.status = "completed";
  task.progress = 100;
  if (task.totalBytes > 0) task.downloadedBytes = task.totalBytes;
  task.speed = 0;
  task.eta = null;
  task.error = "";
  task.updatedAt = Date.now();
  broadcast("download:progress", progressPatch(task));
  broadcast("download:state", toPublic(task));
  notify("info", `下载完成：${task.fileName}`);
  persistCompleted();
  afterComplete(task);
};
const trackAria2 = (task) => {
  const timer = setInterval(async () => {
    if (!tasks.has(task.id) || !task._gid) {
      clearInterval(timer);
      return;
    }
    let status;
    try {
      status = await tellStatus(task._gid);
    } catch (e) {
      clearInterval(timer);
      console.warn("[download] aria2 状态读取失败，改用内置下载器：", e.message);
      task._gid = "";
      if (tasks.has(task.id) && task.status === "downloading") run(task);
      return;
    }
    task.downloadedBytes = Number(status.completedLength) || 0;
    task.totalBytes = Number(status.totalLength) || 0;
    task.speed = Number(status.downloadSpeed) || 0;
    task.progress = task.totalBytes > 0 ? Math.min(100, task.downloadedBytes / task.totalBytes * 100) : 0;
    task.eta = task.speed > 0 && task.totalBytes > 0 ? Math.max(0, (task.totalBytes - task.downloadedBytes) / task.speed) : null;
    task.updatedAt = Date.now();
    broadcast("download:progress", progressPatch(task));
    if (status.status === "complete") {
      clearInterval(timer);
      const doneGid = task._gid;
      task._gid = "";
      removeResult(doneGid).catch(() => {
      });
      const filePath = status.files?.[0]?.path || path.join(DOWNLOADS_DIR, task.fileName);
      finishTask(task, filePath);
      return;
    }
    if (status.status === "error") {
      clearInterval(timer);
      task._gid = "";
      failTask(task, `下载失败：${status.errorMessage || "未知错误"}`);
      return;
    }
    if (status.status === "removed") {
      clearInterval(timer);
      task._gid = "";
      tasks.delete(task.id);
      broadcast("download:removed", task.id);
    }
  }, 500);
};
async function handleNxmUrl(rawUrl) {
  const parsed = parseNxmUrl(rawUrl);
  if (!parsed) {
    notify("error", "无法识别的 nxm 链接");
    return;
  }
  if (!parsed.fileId) {
    notify("error", "这个链接里没有文件 ID，无法下载");
    return;
  }
  if (parsed.authorization && isAuthorizationExpired(parsed.authorization)) {
    notify("error", "下载授权已过期，回 N 网重新点「Mod Manager Download」");
    return;
  }
  try {
    if (!getAuthStatus().loggedIn) {
      notify("info", "首次自动下载需要授权 N 网，请在弹窗里登录并授权");
      await loginNexus();
    }
    pendingFocus = true;
    broadcast("download:focus");
    notify("info", `正在解析链接：${parsed.domain} · 模组 ${parsed.modId}`);
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
      key: parsed.authorization?.key || "",
      expires: parsed.authorization?.expires || ""
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
    startTask(task);
  } catch (e) {
    notify("error", e?.message || "开始下载失败");
  }
}
const domainFromPage = (pageUrl) => {
  try {
    const u = new URL(pageUrl);
    if (!/(^|\.)nexusmods\.com$/i.test(u.hostname)) return "";
    const segs = u.pathname.split("/").filter(Boolean);
    const first = (segs[0] || "").toLowerCase();
    if (first === "games") return segs[1] || "";
    const notGame = ["core", "users", "settings", "search", "login"];
    if (!first || notGame.includes(first)) return "";
    return segs[0];
  } catch {
    return "";
  }
};
const modIdFromPage = (pageUrl) => {
  try {
    const matched = /\/mods\/(\d+)/i.exec(new URL(pageUrl).pathname);
    return matched ? matched[1] : "";
  } catch {
    return "";
  }
};
async function handleBrowserDownload({ url: url2, fileName, ses, pageUrl }) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  const name = sanitizeFileName(fileName || fileNameFromUrl(url2) || "download.bin");
  const finalPath = uniquePath(DOWNLOADS_DIR, name);
  const domain = domainFromPage(pageUrl);
  const game = domain ? resolveGame(domain) : { gameId: "", gameName: "", unmatched: true };
  let cookieHeader = "";
  try {
    const cookies = ses ? await ses.cookies.get({ url: url2 }) : [];
    cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  } catch {
    cookieHeader = "";
  }
  const task = {
    id: crypto.randomUUID(),
    modName: name,
    modId: modIdFromPage(pageUrl),
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
    // 只在主进程用，toPublic 不会带出去
    _url: url2,
    _ses: ses,
    _headers: { Referer: "https://www.nexusmods.com/", Accept: "*/*" },
    _cookieHeader: cookieHeader,
    _tmpPath: `${finalPath}.part`,
    _finalPath: finalPath,
    _needsHeaderName: false,
    _fallbackName: name
  };
  tasks.set(task.id, task);
  broadcast("download:added", toPublic(task));
  startTask(task);
}
const NEXUS_PARTITION = "persist:nexus";
const attachedSessions = /* @__PURE__ */ new WeakSet();
function attachBrowserDownloads(ses) {
  if (!ses || attachedSessions.has(ses)) return;
  attachedSessions.add(ses);
  ses.on("will-download", (event, item, contents) => {
    const url2 = item.getURL();
    const fileName = item.getFilename();
    const pageUrl = contents && !contents.isDestroyed() ? contents.getURL() : "";
    event.preventDefault();
    handleBrowserDownload({ url: url2, fileName, ses, pageUrl }).catch((e) => {
      console.error("[download] 网页下载启动失败：", e.message);
      notify("error", `下载启动失败：${e.message}`);
    });
  });
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
  broadcast("download:state", toPublic(task));
  if (task._gid) {
    pauseDownload(task._gid).catch((e) => console.warn("[aria2] 暂停失败：", e.message));
    return { ok: true };
  }
  controllers.get(id)?.controller.abort();
  return { ok: true };
};
const resume = (id) => {
  const task = tasks.get(id);
  if (!task) return { ok: false, error: "任务不存在" };
  if (task.status === "downloading") return { ok: true };
  if (controllers.has(id)) return { ok: false, error: "这个任务还在收尾，稍等一下" };
  task.status = "downloading";
  task.speed = 0;
  task.eta = null;
  task.error = "";
  task.updatedAt = Date.now();
  broadcast("download:state", toPublic(task));
  if (task._gid) {
    unpauseDownload(task._gid).catch((e) => {
      console.warn("[aria2] 继续失败，重新提交任务：", e.message);
      task._gid = "";
      startTask(task);
    });
    return { ok: true };
  }
  let resumeFrom = 0;
  try {
    if (fs.existsSync(task._tmpPath)) resumeFrom = fs.statSync(task._tmpPath).size;
  } catch {
    resumeFrom = 0;
  }
  task.downloadedBytes = resumeFrom;
  task.progress = task.totalBytes > 0 ? Math.min(100, resumeFrom / task.totalBytes * 100) : 0;
  startTask(task);
  return { ok: true };
};
const removeTask = async (id, removeFile = false) => {
  const task = tasks.get(id);
  if (!task) return { ok: false, error: "任务不存在" };
  if (task.status === "completed") {
    dropTask(task, !removeFile);
    return { ok: true };
  }
  if (task._gid) {
    await removeDownload(task._gid).catch(() => {
    });
    task._gid = "";
  }
  const entry = controllers.get(id);
  if (entry) {
    entry.cancelled = true;
    entry.controller.abort();
    return { ok: true };
  }
  dropTask(task);
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
  electron.ipcMain.handle("download:remove", (_event, rawId, removeFile) => {
    const id = safeId(rawId);
    if (!id) return { ok: false, error: "无效的任务 id" };
    return removeTask(id, Boolean(removeFile));
  });
  electron.ipcMain.handle("download:reveal", withId(reveal));
  electron.ipcMain.handle("download:pause-all", () => pauseAll());
  electron.ipcMain.handle("download:nxm", async (_event, rawUrl) => {
    if (typeof rawUrl !== "string" || !/^nxm:\/\//i.test(rawUrl)) {
      return { ok: false, error: "无效的 nxm 链接" };
    }
    await handleNxmUrl(rawUrl);
    return { ok: true };
  });
}
const CHROME_VERSION = process.versions.chrome || "131.0.0.0";
const UA_PLATFORM = process.platform === "darwin" ? "Macintosh; Intel Mac OS X 10_15_7" : process.platform === "linux" ? "X11; Linux x86_64" : "Windows NT 10.0; Win64; x64";
electron.app.userAgentFallback = `Mozilla/5.0 (${UA_PLATFORM}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`;
electron.app.commandLine.appendSwitch("disable-blink-features", "AutomationControlled");
const NEXUS_HOST = /(^|\.)(nexusmods|nexus-cdn)\.com$/i;
const ARCHIVE_PATH = /\.(7z|zip|rar|tar|gz|tgz|pak|exe|bin|dll)$/i;
const hostOf = (url2) => {
  try {
    return new URL(url2).hostname;
  } catch {
    return "";
  }
};
const isNexusUrl = (url2) => NEXUS_HOST.test(hostOf(url2));
const isNxmUrl = (url2) => /^nxm:\/\//i.test(url2);
const isDownloadUrl = (url2) => {
  if (!/^https?:/i.test(url2)) return false;
  try {
    const u = new URL(url2);
    return ARCHIVE_PATH.test(u.pathname) || /(^|\.)nexus-cdn\.com$/i.test(u.hostname);
  } catch {
    return false;
  }
};
const hasSingleInstance = setupNxmProtocol();
let tray = null;
let isQuitting = false;
let mainWindow = null;
function readMinimizeToTray() {
  return readSettings().minimizeToTray === true;
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
      webSecurity: false,
      // 模组下载页是内嵌网页，必须开这个开关，否则 <webview> 只是一个空标签
      webviewTag: true
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
  electron.nativeTheme.themeSource = readSettings().theme === "dark" ? "dark" : "light";
  electron.ipcMain.on("theme:set", (_event, theme) => {
    electron.nativeTheme.themeSource = theme === "dark" ? "dark" : "light";
  });
  electron.ipcMain.handle("path:info", (_event, filePath) => {
    if (typeof filePath !== "string" || !filePath) return null;
    try {
      const stat = fs.statSync(filePath);
      return {
        path: filePath,
        name: path.basename(filePath),
        isDirectory: stat.isDirectory(),
        isFile: stat.isFile()
      };
    } catch {
      return null;
    }
  });
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  electron.app.on("web-contents-created", (_e, contents) => {
    if (contents.getType() !== "webview") return;
    contents.on("will-navigate", (event, url2) => {
      if (isNxmUrl(url2)) {
        event.preventDefault();
        console.log("[webview] 拦到 nxm 链接，交给下载管理器");
        handleNxmUrl(url2);
        return;
      }
      if (!isDownloadUrl(url2)) return;
      console.log("[webview] 拦截到下载导航，改为下载：", url2);
      event.preventDefault();
      contents.downloadURL(url2);
    });
    contents.setWindowOpenHandler(({ url: url2 }) => {
      if (isNxmUrl(url2)) {
        console.log("[webview] 新窗口是 nxm 链接，交给下载管理器");
        handleNxmUrl(url2);
      } else if (isDownloadUrl(url2)) {
        console.log("[webview] 新窗口是下载地址，改为下载：", url2);
        contents.downloadURL(url2);
      } else if (isNexusUrl(url2)) {
        contents.loadURL(url2);
      } else if (/^https?:/i.test(url2)) {
        electron.shell.openExternal(url2);
      }
      return { action: "deny" };
    });
  });
  startServer();
  registerDownloadIpc();
  registerTranslateIpc();
  const resolveWebviewPreload = () => {
    const candidates = [
      electron.app.isPackaged ? path.join(process.resourcesPath, "webview-preload.js") : "",
      path.join(electron.app.getAppPath(), "src/main/resources/webview-preload.js"),
      path.join(__dirname, "../../src/main/resources/webview-preload.js")
    ].filter(Boolean);
    const preloadFile = candidates.find((candidate) => fs.existsSync(candidate));
    if (!preloadFile) {
      console.warn("[webview] 找不到翻译 preload，已尝试：", candidates);
      return "";
    }
    return url.pathToFileURL(preloadFile).toString();
  };
  electron.ipcMain.handle("webview:preload", () => resolveWebviewPreload());
  electron.ipcMain.on("webview:preload-sync", (event) => {
    event.returnValue = resolveWebviewPreload();
  });
  electron.ipcMain.handle("nexus:clear-session", async () => {
    const ses = electron.session.fromPartition(NEXUS_PARTITION);
    await ses.clearStorageData({
      storages: ["cookies", "localstorage", "cachestorage", "indexdb", "serviceworkers"]
    });
    await ses.clearCache();
    return true;
  });
  attachBrowserDownloads(electron.session.fromPartition(NEXUS_PARTITION));
  attachBrowserDownloads(electron.session.defaultSession);
  createWindow();
  createTray();
  attachNxmHandler(handleNxmUrl);
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("before-quit", () => {
  isQuitting = true;
  stopAria2();
});
electron.app.on("browser-window-created", (event, window) => {
  window.webContents.setWebRTCIPHandlingPolicy("disable_non_proxied_udp");
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
