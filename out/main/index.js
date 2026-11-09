"use strict";
const path = require("path");
const fs = require("fs");
const express = require("express");
const steamGamePath = require("steam-game-path");
const electron = require("electron");
const crypto = require("crypto");
const os = require("os");
const child_process = require("child_process");
const unzipper = require("unzipper");
const utils = require("@electron-toolkit/utils");
const icon = path.join(__dirname, "../../resources/icon.png");
const router$5 = express.Router();
router$5.get("/game/steam-path", (req, res) => {
  const { appId } = req.query;
  if (!appId) return res.json({ success: false, error: "缺少 appId" });
  try {
    const result = steamGamePath.getGamePath(Number(appId));
    if (result.success) {
      return res.json({ success: true, path: result.game.path });
    }
    const reasons = {
      "steam-not-found": "未找到 Steam 安装目录",
      "game-not-found": "Steam 库中未安装该游戏",
      "install-directory-missing": "游戏安装目录不存在（可能已卸载）",
      "unsupported-platform": "当前系统不支持自动检测"
    };
    return res.json({
      success: false,
      error: reasons[result.reason] || result.reason || "未找到游戏路径"
    });
  } catch (e) {
    return res.json({ success: false, error: e.message });
  }
});
const DATA_DIR = electron.app.isPackaged ? path.join(path.dirname(electron.app.getPath("exe")), "data") : path.join(__dirname, "../..", "data");
const REPO_DIR = path.join(DATA_DIR, "repo");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const NOTICE_STATE_FILE = path.join(DATA_DIR, "notice-state.json");
const BACKGROUNDS_DIR = path.join(DATA_DIR, "backgrounds");
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
  lastDialogPath: "",
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
    exeRelative: "b1\\Binaries\\Win64\\b1-Win64-Shipping.exe",
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
    exeRelative: "bin\\x64\\Cyberpunk2077.exe",
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
    exeRelative: "Bin\\Win64MasterMasterSteamPGO\\KingdomCome.exe",
    installRules: {
      placements: [
        {
          match: "dinput8.dll",
          mode: "files",
          into: "{game_root}/Bin/Win64MasterMasterSteamPGO",
          note: "KCSE 脚本扩展器本体，放游戏 exe 同目录"
        },
        {
          match: "dinput8.pdb",
          mode: "files",
          into: "{game_root}/Bin/Win64MasterMasterSteamPGO",
          note: "KCSE 调试符号"
        },
        {
          match: "KCSE/Plugins/*.dll",
          mode: "files",
          into: "{game_root}/KCSE/Plugins",
          note: "KCSE 插件 dll，统一合并到根 KCSE/Plugins/"
        },
        {
          match: "KCSE/addresslib/*.bin",
          mode: "files",
          into: "{game_root}/KCSE/addresslib",
          note: "KCSE 地址库 bin，合并到根 KCSE/addresslib/"
        },
        {
          match: "*.asi",
          mode: "files",
          into: "{game_root}/Bin/Win64MasterMasterSteamPGO",
          note: "第三人称 .asi 插件，放 WHGame.dll 同目录（非 Mods）"
        },
        {
          match: "*.ini",
          mode: "files",
          into: "{game_root}/Bin/Win64MasterMasterSteamPGO",
          note: "第三人称模组配置，跟 .asi 放一起"
        },
        {
          match: "user.cfg",
          mode: "files",
          into: "{game_root}",
          note: "旧式 cfg 模组，放游戏根目录，需配合 Steam 启动参数 -devmode +exec user.cfg"
        },
        {
          match: "Mods",
          mode: "folder",
          into: "{game_root}",
          note: "包内自带 Mods/ 目录时直接并入根"
        },
        {
          match: "Bin",
          mode: "folder",
          into: "{game_root}",
          note: "包内自带 Bin/ 目录时直接并入根"
        },
        {
          match: "*",
          mode: "folder",
          into: "{game_root}/Mods",
          note: "兜底：顶层文件夹放入 Mods/"
        }
      ],
      cleanup: {
        label: "天国：拯救2：清空 Mods/、KCSE/ 与 KCSE 代理 dll",
        actions: [
          {
            op: "purge",
            dir: "Mods",
            keepFiles: [],
            note: "清空 Mods/ 下所有用户 Mod"
          },
          {
            op: "purge",
            dir: "KCSE",
            keepFiles: [],
            note: "清空根目录 KCSE/（插件、地址库全在里面）"
          },
          {
            op: "purge",
            dir: "Bin/Win64MasterMasterSteamPGO/quest_travel",
            keepFiles: [],
            note: "清空 Bin/Win64MasterMasterSteamPGO 目录 quest_travel/ 目录"
          },
          {
            op: "unlink",
            files: [
              "Bin/Win64MasterMasterSteamPGO/dinput8.dll",
              "Bin/Win64MasterMasterSteamPGO/dinput8.pdb"
            ],
            note: "移除 KCSE 代理 dll 与调试符号"
          },
          {
            op: "unlink",
            files: [
              "Bin/Win64MasterMasterSteamPGO/KCD2_TPVCamera.asi",
              "Bin/Win64MasterMasterSteamPGO/KCD2_TPVCamera.ini",
              "Bin/Win64MasterMasterSteamPGO/version.dll",
              "Bin/Win64MasterMasterSteamPGO/winmm.dll"
            ],
            note: "移除第三人称插件与可能的 Loader"
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
    exeRelative: "RDR2.exe",
    installRules: {
      placements: [
        {
          match: "vfs.asi",
          mode: "files",
          into: "{game_root}",
          note: "LML 的 vfs.asi 必须放 RDR2.exe 同目录"
        },
        {
          match: "lml.ini",
          mode: "files",
          into: "{game_root}",
          note: "LML 配置放根目录"
        },
        {
          match: "ModManager.Core.dll",
          mode: "files",
          into: "{game_root}",
          note: "LML 核心 dll"
        },
        {
          match: "ModManager.NativeInterop.dll",
          mode: "files",
          into: "{game_root}",
          note: "LML 互操作 dll"
        },
        {
          match: "^NLog.dll",
          mode: "files",
          into: "{game_root}",
          note: "LML 日志库，只取顶层 NLog.dll，不碰 ModManager 里的同名文件"
        },
        {
          match: "lml",
          mode: "folder",
          into: "{game_root}",
          note: "LML 的 lml/ 目录并入根"
        },
        {
          match: "Rampage.asi",
          mode: "files",
          into: "{game_root}",
          note: "Rampage 修改器本体，放根目录"
        },
        {
          match: "RampageFiles",
          mode: "folder",
          into: "{game_root}",
          note: "Rampage 数据文件夹，放根目录（不要进 lml/）"
        },
        {
          match: "Mary_Linton",
          mode: "folder",
          into: "{game_root}",
          note: "伴侣模组数据文件夹，放根目录（不要进 lml/）"
        },
        {
          match: "ModManager",
          mode: "folder",
          into: "{game_root}",
          note: "RDR 模组管理器UI，丢进根目录"
        },
        {
          match: "scripts",
          mode: "folder",
          into: "{game_root}",
          note: "部分脚本 Mod 的 scripts/ 目录并入根"
        },
        {
          match: "*.asi",
          mode: "files",
          into: "{game_root}",
          note: "ASI 插件放根目录（RDR2.exe 旁）"
        },
        {
          match: "*.ini",
          mode: "files",
          into: "{game_root}",
          note: "模组配置 ini，跟 .asi 同目录放根目录"
        },
        {
          match: "dinput8.dll",
          mode: "files",
          into: "{game_root}",
          note: "ASI Loader 代理 dll，放根目录"
        },
        {
          match: "ScriptHookRDR2.dll",
          mode: "files",
          into: "{game_root}",
          note: "ScriptHook 前置，放根目录"
        },
        {
          match: "install.xml",
          mode: "files",
          lift: 1,
          into: "{game_root}/lml",
          note: "LML 格式模组：带 install.xml 的文件夹整体进 lml/"
        },
        {
          match: "*",
          mode: "folder",
          into: "{game_root}/lml",
          note: "兜底：无法识别的顶层文件夹丢进 lml/"
        }
      ],
      cleanup: {
        disableMods: true,
        label: "荒野大镖客2：清空 lml/、scripts/、RampageFiles/ 与根目录插件 dll",
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
            op: "purge",
            dir: "RampageFiles",
            keepFiles: [],
            note: "清空 Rampage 数据文件夹"
          },
          {
            op: "unlink",
            files: ["dinput8.dll", "ScriptHookRDR2.dll", "vfs.asi", "version.dll", "Rampage.asi"],
            note: "移除常见 ScriptHook / ASI Loader / LML 代理文件与 Rampage 本体"
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
    exeRelative: "re9.exe",
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
    exeRelative: "sekiro.exe",
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
    exeRelative: "SB\\Binaries\\Win64\\SB-Win64-Shipping.exe",
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
    modColumns: normalizeColumns(input.modColumns),
    gamePaths: normalizePaths(input.gamePaths),
    lastDialogPath: typeof input.lastDialogPath === "string" ? input.lastDialogPath : ""
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
const getBackground = () => {
  const file = fs.existsSync(BACKGROUNDS_DIR) ? fs.readdirSync(BACKGROUNDS_DIR).find((f) => f.toLowerCase().startsWith("custom.")) || null : null;
  if (!file) return { hasCustom: false, url: "" };
  try {
    const mtime = Math.round(fs.statSync(path.join(BACKGROUNDS_DIR, file)).mtimeMs);
    return { hasCustom: true, url: `/backgrounds/${encodeURIComponent(file)}?v=${mtime}` };
  } catch {
    return { hasCustom: false, url: "" };
  }
};
const setBackground = (image) => {
  if (!image || !fs.existsSync(image)) throw new Error("图片不存在");
  const ext = path.extname(image).toLowerCase();
  if (!ext) throw new Error("无法识别图片格式");
  fs.mkdirSync(BACKGROUNDS_DIR, { recursive: true });
  const target = path.join(BACKGROUNDS_DIR, `custom${ext}`);
  const old = fs.existsSync(BACKGROUNDS_DIR) ? fs.readdirSync(BACKGROUNDS_DIR).find((f) => f.toLowerCase().startsWith("custom.")) || null : null;
  fs.copyFileSync(image, target);
  if (old && old !== path.basename(target)) {
    fs.unlinkSync(path.join(BACKGROUNDS_DIR, old));
  }
  return getBackground();
};
const removeBackground = () => {
  const file = () => {
    if (!fs.existsSync(BACKGROUNDS_DIR)) return null;
    return fs.readdirSync(BACKGROUNDS_DIR).find((file2) => file2.toLowerCase().startsWith("custom.")) || null;
  };
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
  if (glob.startsWith("^")) {
    const exact = glob.slice(1);
    return globToRegExp(exact).test(relPath);
  }
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
        fs.chmodSync(target, 438);
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
  try {
    const { rules } = readRules(repoDir, gameId);
    const actions = rules?.cleanup?.actions || [];
    for (const action of actions) {
      if (action.op === "purge") {
        const dir = path.join(gameRoot, action.dir);
        if (fs.existsSync(dir)) purgeDir(dir, action, failed);
      } else if (action.op === "unlink") {
        for (const file of action.files || []) {
          const full = path.join(gameRoot, file);
          if (fs.existsSync(full)) {
            try {
              fs.unlinkSync(full);
            } catch (e) {
              failed.push(`${file}：${e.message}`);
            }
          }
        }
      }
    }
  } catch (e) {
    failed.push(`cleanup.actions：${e.message}`);
  }
  removeCreatedDirs(createdDirs);
  return { removed, restored, failed };
}
function purgeDir(dir, action, failed) {
  const keepFiles = action.keepFiles || [];
  const keepDirs = action.keepDirs || [];
  const match = (name, patterns) => patterns.some((p) => {
    const re = new RegExp("^" + p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$", "i");
    return re.test(name);
  });
  const walk = (current) => {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (e) {
      failed.push(`${current}：${e.message}`);
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (match(entry.name, keepDirs)) continue;
        walk(full);
        try {
          if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
        } catch {
        }
      } else {
        if (match(entry.name, keepFiles)) continue;
        try {
          fs.chmodSync(full, 438);
          fs.unlinkSync(full);
        } catch (e) {
          failed.push(`${full}：${e.message}`);
        }
      }
    }
  };
  walk(dir);
  try {
    if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  } catch {
  }
}
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
const lastPath = () => readSettings().lastDialogPath || void 0;
const remember = (p) => {
  if (p) saveSettings({ lastDialogPath: p });
};
router$2.get("/dialog/folder", async (req, res) => {
  const result = await electron.dialog.showOpenDialog({
    defaultPath: lastPath(),
    properties: ["openDirectory"]
  });
  const path2 = result.filePaths[0] || "";
  remember(path2);
  res.json({ path: path2 });
});
router$2.get("/dialog/folders", async (req, res) => {
  const result = await electron.dialog.showOpenDialog({
    defaultPath: lastPath(),
    properties: ["openDirectory"]
  });
  const paths = result.filePaths.slice(0, 1);
  remember(paths[0]);
  res.json({ paths });
});
router$2.get("/dialog/file", async (req, res) => {
  const { type } = req.query;
  const filters = type === "image" ? [{ name: "图片", extensions: ["jpg", "jpeg", "png", "webp", "gif"] }] : [{ name: "可执行文件", extensions: ["exe"] }];
  const result = await electron.dialog.showOpenDialog({
    defaultPath: lastPath(),
    properties: ["openFile"],
    filters
  });
  const path2 = result.filePaths[0] || "";
  remember(path2);
  res.json({ path: path2 });
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
  const bg = getBackground();
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
    const bg = setBackground(req.body?.image);
    res.json({ success: true, customBgUrl: bg.url, hasCustom: bg.hasCustom });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});
router.delete("/background/custom", (req, res) => {
  try {
    const bg = removeBackground();
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
app.use("/api", router$5);
function startServer() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(REPO_DIR, { recursive: true });
  fs.mkdirSync(BACKGROUNDS_DIR, { recursive: true });
  readSettings();
  app.listen(3e3, () => {
    console.log("Express start: http://localhost:3000");
  });
}
const CHROME_VERSION = process.versions.chrome || "131.0.0.0";
const UA_PLATFORM = process.platform === "darwin" ? "Macintosh; Intel Mac OS X 10_15_7" : process.platform === "linux" ? "X11; Linux x86_64" : "Windows NT 10.0; Win64; x64";
electron.app.userAgentFallback = `Mozilla/5.0 (${UA_PLATFORM}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`;
electron.app.commandLine.appendSwitch("disable-blink-features", "AutomationControlled");
let mainWindow = null;
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
      webSecurity: true
    }
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
