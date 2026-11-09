// 内置游戏配置
export const BUILTIN_GAMES = {
  BlackMythWukong: {
    id: 'BlackMythWukong',
    name: '黑神话：悟空',
    cover: '/builtin-covers/BlackMythWukong.jpg',
    steamAppId: '2358720',
    nexusDomain: 'blackmythwukong',
    exeRelative: 'b1\\Binaries\\Win64\\b1-Win64-Shipping.exe',
    installRules: {
      placements: [
        {
          match: 'b1',
          mode: 'folder',
          into: '{game_root}',
          note: '游戏根目录下真实存在 b1/ 安装树，包内带完整 b1 目录结构时整棵树并入游戏根'
        },
        {
          match: 'Engine',
          mode: 'folder',
          into: '{game_root}',
          note: '游戏根目录下真实存在 Engine/，包内带 Engine 目录时并入游戏根'
        },
        {
          match: 'ue4ss',
          mode: 'folder',
          into: '{game_root}/b1/Binaries/Win64/',
          note: 'UE4SS 加载器目录放 b1/Binaries/Win64/（黑神话：悟空为 UE5 游戏，UE4SS 装在此处）'
        },
        {
          match: 'CSharpLoader',
          mode: 'folder',
          into: '{game_root}/b1/Binaries/Win64/',
          note: 'CSharpLoader 加载器目录放 b1/Binaries/Win64/'
        },
        {
          match: 'dwmapi.dll',
          mode: 'files',
          into: '{game_root}/b1/Binaries/Win64/',
          note: 'UE4SS 代理 dll，放 b1/Binaries/Win64/'
        },
        {
          match: 'Scripts',
          mode: 'folder',
          lift: 1,
          into: '{game_root}/b1/Binaries/Win64/ue4ss/Mods',
          note: 'UE4SS 脚本：连它上一级的 Mod 目录一起进 ue4ss/Mods'
        },
        {
          match: 'LogicMods',
          mode: 'folder',
          into: '{game_root}/b1/Content/Paks/',
          note: '蓝图 Mod 目录放 b1/Content/Paks/'
        },
        {
          match: '~mods',
          mode: 'folder',
          into: '{game_root}/b1/Content/Paks/',
          note: '包内已带 ~mods 目录时并入 b1/Content/Paks/'
        },
        {
          match: '*.pak',
          mode: 'files',
          into: '{game_root}/b1/Content/Paks/~mods',
          note: '散装 PAK 放 b1/Content/Paks/~mods'
        },
        {
          match: '*.ucas',
          mode: 'files',
          into: '{game_root}/b1/Content/Paks/~mods',
          note: '散装 UCAS 放 b1/Content/Paks/~mods'
        },
        {
          match: '*.utoc',
          mode: 'files',
          into: '{game_root}/b1/Content/Paks/~mods',
          note: '散装 UTOC 放 b1/Content/Paks/~mods'
        }
      ],
      // 这些目录由加载器整目录独占，卸载时可以直接按目录处理。
      // 通用卸载代码不认识这些名字，只读这里的配置。
      exclusiveDirs: [
        '{game_root}/b1/Binaries/Win64/CSharpLoader',
        '{game_root}/b1/Binaries/Win64/ue4ss'
      ],
      cleanup: {
        label:
          '黑神话：悟空：清空 Paks 下的模组 pak 与 Win64 下的加载器（先卸载所有已安装的模组并把被覆盖的官方文件还原，再清装载点）',
        actions: [
          {
            op: 'purge',
            dir: 'b1/Content/Paks',
            keepFiles: ['filehash.dat', 'pakchunk*.pak', 'pakchunk*.sig'],
            note: '除游戏自带的 pakchunk 外全清（含所有子目录）'
          },
          {
            op: 'purge',
            dir: 'b1/Binaries/Win64',
            keepDirs: ['D3D12'],
            keepFiles: [
              'b1-Win64-Shipping.exe',
              'MonoPosixHelper.dll',
              'OpenImageDenoise.dll',
              'tbb12.dll',
              'amd_fidelityfx_*.dll',
              'tbb.dll'
            ],
            note: 'UE4SS / CSharpLoader 的残余都在这儿'
          },
          {
            op: 'unlink',
            files: ['b1/Binaries/Win64/dwmapi.dll'],
            note: '模组加载器塞进来的代理 dll'
          }
        ]
      }
    }
  },

  Cyberpunk2077: {
    id: 'Cyberpunk2077',
    name: '赛博朋克 2077',
    cover: '/builtin-covers/Cyberpunk2077.jpg',
    steamAppId: '1091500',
    nexusDomain: 'cyberpunk2077',
    exeRelative: 'bin\\x64\\Cyberpunk2077.exe',
    installRules: {
      placements: [
        {
          match: 'archive',
          mode: 'folder',
          into: '{game_root}',
          note: 'legacy 格式 Mod 的 archive 目录，与游戏自带 archive 合并'
        },
        {
          match: '*.archive',
          mode: 'files',
          into: '{game_root}/archive/pc/mod',
          note: '散装 .archive 文件放 archive/pc/mod'
        },
        {
          match: '*.xl',
          mode: 'files',
          into: '{game_root}/archive/pc/mod',
          note: 'ArchiveXL 的 .xl 文件与 archive 同目录'
        },
        {
          match: 'bin',
          mode: 'folder',
          into: '{game_root}',
          note: 'CET / RED4ext 等框架的 bin 目录并入根'
        },
        {
          match: 'r6',
          mode: 'folder',
          into: '{game_root}',
          note: 'redscript 脚本与 tweaks 配置并入 r6'
        },
        {
          match: 'mods',
          mode: 'folder',
          into: '{game_root}',
          note: 'REDmod 格式的 mods 目录（含 info.json 的子文件夹）'
        },
        {
          match: '*',
          mode: 'folder',
          lift: 1,
          into: '{game_root}/archive/pc/mod',
          note: '兜底：无法识别结构的顶层文件夹，当作 legacy Mod 塞进 archive/pc/mod'
        }
      ],
      cleanup: {
        label: '赛博朋克 2077：清空 legacy Mod 目录、REDmod 目录与常见框架插件',
        actions: [
          {
            op: 'purge',
            dir: 'archive/pc/mod',
            keepFiles: [],
            note: '清空所有用户 .archive / .xl'
          },
          {
            op: 'purge',
            dir: 'mods',
            keepFiles: [],
            note: '清空 REDmod 格式 Mod（若 REDmod 本体在此会一并删除，按需调整）'
          },
          {
            op: 'purge',
            dir: 'bin/x64/plugins',
            note: '清空 CET 插件与相关 dll 残余'
          },
          {
            op: 'purge',
            dir: 'r6/scripts',
            note: '清空 redscript 脚本'
          },
          {
            op: 'purge',
            dir: 'r6/tweaks',
            note: '清空 TweakXL / ArchiveXL 的 tweaks'
          }
        ]
      }
    }
  },

  KingdomComeDeliverance2: {
    id: 'KingdomComeDeliverance2',
    name: '天国：拯救2',
    cover: '/builtin-covers/KingdomComeDeliverance2.jpg',
    steamAppId: '1771300',
    nexusDomain: 'kingdomcomedeliverance2',
    exeRelative: 'Bin\\Win64MasterMasterSteamPGO\\KingdomCome.exe',
    installRules: {
      placements: [
        {
          match: 'dinput8.dll',
          mode: 'files',
          into: '{game_root}/Bin/Win64MasterMasterSteamPGO',
          note: 'KCSE 脚本扩展器本体，放游戏 exe 同目录'
        },
        {
          match: 'dinput8.pdb',
          mode: 'files',
          into: '{game_root}/Bin/Win64MasterMasterSteamPGO',
          note: 'KCSE 调试符号'
        },
        {
          match: '**/KCSE/Plugins/*.dll',
          mode: 'files',
          into: '{game_root}/KCSE/Plugins',
          note: 'KCSE 插件 dll，统一合并到根 KCSE/Plugins/'
        },
        {
          match: '**/KCSE/addresslib/*.bin',
          mode: 'files',
          into: '{game_root}/KCSE/addresslib',
          note: 'KCSE 地址库 bin，合并到根 KCSE/addresslib/'
        },
        {
          match: '*.asi',
          mode: 'files',
          into: '{game_root}/Bin/Win64MasterMasterSteamPGO',
          note: '第三人称 .asi 插件，放 WHGame.dll 同目录（非 Mods）'
        },
        {
          match: '*.ini',
          mode: 'files',
          into: '{game_root}/Bin/Win64MasterMasterSteamPGO',
          note: '第三人称模组配置，跟 .asi 放一起'
        },
        {
          match: 'user.cfg',
          mode: 'files',
          into: '{game_root}',
          note: '旧式 cfg 模组，放游戏根目录，需配合 Steam 启动参数 -devmode +exec user.cfg'
        },
        {
          match: 'Mods',
          mode: 'folder',
          into: '{game_root}',
          note: '包内自带 Mods/ 目录时直接并入根'
        },
        {
          match: 'Bin',
          mode: 'folder',
          into: '{game_root}',
          note: '包内自带 Bin/ 目录时直接并入根'
        },
        {
          match: '*',
          mode: 'folder',
          into: '{game_root}/Mods',
          note: '兜底：顶层文件夹放入 Mods/'
        }
      ],
      cleanup: {
        label: '天国：拯救2：清空 Mods/、KCSE/ 与 KCSE 代理 dll',
        actions: [
          {
            op: 'purge',
            dir: 'Mods',
            keepFiles: [],
            note: '清空 Mods/ 下所有用户 Mod'
          },
          {
            op: 'purge',
            dir: 'KCSE',
            keepFiles: [],
            note: '清空根目录 KCSE/（插件、地址库全在里面）'
          },
          {
            op: 'purge',
            dir: 'Bin/Win64MasterMasterSteamPGO/quest_travel',
            keepFiles: [],
            note: '清空 Bin/Win64MasterMasterSteamPGO 目录 quest_travel/ 目录'
          },
          {
            op: 'unlink',
            files: [
              'Bin/Win64MasterMasterSteamPGO/dinput8.dll',
              'Bin/Win64MasterMasterSteamPGO/dinput8.pdb'
            ],
            note: '移除 KCSE 代理 dll 与调试符号'
          },
          {
            op: 'unlink',
            files: [
              'Bin/Win64MasterMasterSteamPGO/KCD2_TPVCamera.asi',
              'Bin/Win64MasterMasterSteamPGO/KCD2_TPVCamera.ini',
              'Bin/Win64MasterMasterSteamPGO/version.dll',
              'Bin/Win64MasterMasterSteamPGO/winmm.dll'
            ],
            note: '移除第三人称插件与可能的 Loader'
          }
        ]
      }
    }
  },

  RedDeadRedemption2: {
    id: 'RedDeadRedemption2',
    name: '荒野大镖客：救赎2',
    cover: '/builtin-covers/RedDeadRedemption2.jpg',
    steamAppId: '1174180',
    nexusDomain: 'reddeadredemption2',
    exeRelative: 'RDR2.exe',
    installRules: {
      placements: [
        {
          match: 'vfs.asi',
          mode: 'files',
          into: '{game_root}',
          note: 'LML 的 vfs.asi 必须放 RDR2.exe 同目录'
        },
        {
          match: 'lml.ini',
          mode: 'files',
          into: '{game_root}',
          note: 'LML 配置放根目录'
        },
        {
          match: 'ModManager.Core.dll',
          mode: 'files',
          into: '{game_root}',
          note: 'LML 核心 dll'
        },
        {
          match: 'ModManager.NativeInterop.dll',
          mode: 'files',
          into: '{game_root}',
          note: 'LML 互操作 dll'
        },
        {
          match: '^NLog.dll',
          mode: 'files',
          into: '{game_root}',
          note: 'LML 日志库，只取顶层 NLog.dll，不碰 ModManager 里的同名文件'
        },
        {
          match: 'lml',
          mode: 'folder',
          into: '{game_root}',
          note: 'LML 的 lml/ 目录并入根'
        },
        {
          match: 'Rampage.asi',
          mode: 'files',
          into: '{game_root}',
          note: 'Rampage 修改器本体，放根目录'
        },
        {
          match: 'RampageFiles',
          mode: 'folder',
          into: '{game_root}',
          note: 'Rampage 数据文件夹，放根目录（不要进 lml/）'
        },
        {
          match: 'Mary_Linton',
          mode: 'folder',
          into: '{game_root}',
          note: '伴侣模组数据文件夹，放根目录（不要进 lml/）'
        },
        {
          match: 'ModManager',
          mode: 'folder',
          into: '{game_root}',
          note: 'RDR 模组管理器UI，丢进根目录'
        },
        {
          match: 'scripts',
          mode: 'folder',
          into: '{game_root}',
          note: '部分脚本 Mod 的 scripts/ 目录并入根'
        },
        {
          match: '*.asi',
          mode: 'files',
          into: '{game_root}',
          note: 'ASI 插件放根目录（RDR2.exe 旁）'
        },
        {
          match: '*.ini',
          mode: 'files',
          into: '{game_root}',
          note: '模组配置 ini，跟 .asi 同目录放根目录'
        },
        {
          match: 'dinput8.dll',
          mode: 'files',
          into: '{game_root}',
          note: 'ASI Loader 代理 dll，放根目录'
        },
        {
          match: 'ScriptHookRDR2.dll',
          mode: 'files',
          into: '{game_root}',
          note: 'ScriptHook 前置，放根目录'
        },
        {
          match: 'install.xml',
          mode: 'files',
          lift: 1,
          into: '{game_root}/lml',
          note: 'LML 格式模组：带 install.xml 的文件夹整体进 lml/'
        },
        {
          match: '*',
          mode: 'folder',
          into: '{game_root}/lml',
          note: '兜底：无法识别的顶层文件夹丢进 lml/'
        }
      ],
      cleanup: {
        disableMods: true,
        label: '荒野大镖客2：清空 lml/、scripts/、RampageFiles/ 与根目录插件 dll',
        actions: [
          {
            op: 'purge',
            dir: 'lml',
            keepFiles: [],
            note: '清空 LML 下所有 Mod'
          },
          {
            op: 'purge',
            dir: 'scripts',
            note: '清空 scripts/'
          },
          {
            op: 'purge',
            dir: 'RampageFiles',
            keepFiles: [],
            note: '清空 Rampage 数据文件夹'
          },
          {
            op: 'unlink',
            files: ['dinput8.dll', 'ScriptHookRDR2.dll', 'vfs.asi', 'version.dll', 'Rampage.asi'],
            note: '移除常见 ScriptHook / ASI Loader / LML 代理文件与 Rampage 本体'
          }
        ]
      }
    }
  },

  ResidentEvilRequiem: {
    id: 'ResidentEvilRequiem',
    name: '生化危机9：安魂曲',
    cover: '/builtin-covers/ResidentEvilRequiem.jpg',
    steamAppId: '3764200',
    nexusDomain: 'residentevilrequiem',
    exeRelative: 're9.exe',
    installRules: {
      placements: [
        {
          match: 'natives',
          mode: 'folder',
          into: '{game_root}',
          note: '纹理/模型替换类 Mod 的 natives/ 目录并入根（合并而非替换）'
        },
        {
          match: 'reframework',
          mode: 'folder',
          into: '{game_root}',
          note: '脚本/插件类 Mod 的 reframework 目录并入根'
        },
        {
          match: '*.lua',
          mode: 'files',
          into: '{game_root}/reframework/autorun',
          note: '散装 Lua 脚本放 reframework/autorun'
        },
        {
          match: '*.exe',
          mode: 'files',
          into: '{game_root}',
          note: '少数工具类 exe 放根目录（如 PSVR2Bridge.exe）'
        },
        {
          match: '*.pak',
          mode: 'files',
          into: '{game_root}',
          note: 'PAK 文件放根目录（需 REFramework 开启 PAK Directory Loading）'
        }
      ],
      cleanup: {
        label: '生化危机9：清空 natives/ 与 reframework/autorun 下的用户 Mod',
        actions: [
          {
            op: 'purge',
            dir: 'natives',
            note: '清空所有散装纹理/模型 Mod（REFramework 本体不在 natives 里）'
          },
          {
            op: 'purge',
            dir: 'reframework/autorun',
            note: '清空 autorun 下的用户 Lua 脚本'
          }
        ]
      }
    }
  },

  Sekiro: {
    id: 'Sekiro',
    name: '只狼：影逝二度',
    cover: '/builtin-covers/Sekiro.jpg',
    steamAppId: '814380',
    nexusDomain: 'sekiro',
    exeRelative: 'sekiro.exe',
    installRules: {
      placements: [
        {
          match: '^dinput8.dll',
          mode: 'files',
          into: '{game_root}',
          note: 'ModEngine 代理 dll，放 sekiro.exe 同目录'
        },
        {
          match: '^modengine.ini',
          mode: 'files',
          into: '{game_root}',
          note: 'ModEngine 配置文件，放 sekiro.exe 同目录'
        },
        {
          match: 'mods',
          mode: 'folder',
          into: '{game_root}',
          note: '包内自带 mods/ 目录时直接并入根'
        },
        {
          match: 'parts',
          mode: 'folder',
          into: '{game_root}/mods',
          note: '皮肤/模型类 Mod 的 parts/ 放 mods/ 下'
        },
        {
          match: 'chr',
          mode: 'folder',
          into: '{game_root}/mods',
          note: '角色/NPC 类 Mod 的 chr/ 放 mods/ 下'
        },
        {
          match: 'sfx',
          mode: 'folder',
          into: '{game_root}/mods',
          note: '特效类 Mod 的 sfx/ 放 mods/ 下（如“危”字特效替换）'
        },
        {
          match: 'param',
          mode: 'folder',
          into: '{game_root}/mods',
          note: '数值类 Mod 的 param/ 放 mods/ 下'
        },
        {
          match: 'event',
          mode: 'folder',
          into: '{game_root}/mods',
          note: '事件类 Mod 的 event/ 放 mods/ 下'
        },
        {
          match: 'map',
          mode: 'folder',
          into: '{game_root}/mods',
          note: '地图类 Mod 的 map/ 放 mods/ 下'
        },
        {
          match: 'menu',
          mode: 'folder',
          into: '{game_root}/mods',
          note: '菜单类 Mod 的 menu/ 放 mods/ 下'
        },
        {
          match: 'msg',
          mode: 'folder',
          into: '{game_root}/mods',
          note: '文本类 Mod 的 msg/ 放 mods/ 下'
        },
        {
          match: 'script',
          mode: 'folder',
          into: '{game_root}/mods',
          note: '脚本类 Mod 的 script/ 放 mods/ 下'
        },
        {
          match: 'sound',
          mode: 'folder',
          into: '{game_root}/mods',
          note: '音效类 Mod 的 sound/ 放 mods/ 下'
        },
        {
          match: '*',
          mode: 'folder',
          lift: 1,
          into: '{game_root}/mods',
          note: '兜底：顶层文件夹进 mods/（若包有外层文件夹）'
        }
      ],
      cleanup: {
        label: '只狼：清空 mods/ 与 ModEngine 代理 dll',
        actions: [
          {
            op: 'purge',
            dir: 'mods',
            keepFiles: [],
            note: '清空所有用户 Mod'
          },
          {
            op: 'unlink',
            files: ['dinput8.dll'],
            note: '移除 ModEngine 的代理 dll'
          },
          {
            op: 'unlink',
            files: ['modengine.ini'],
            note: '移除 ModEngine 的代理 dll'
          }
        ]
      }
    }
  },

  StellarBlade: {
    id: 'StellarBlade',
    name: '剑星',
    cover: '/builtin-covers/StellarBlade.jpg',
    steamAppId: '3489700',
    nexusDomain: 'stellarblade',
    exeRelative: 'SB\\Binaries\\Win64\\SB-Win64-Shipping.exe',
    installRules: {
      placements: [
        {
          match: '^ue4ss',
          mode: 'folder',
          into: '{game_root}/SB/Binaries/Win64',
          note: 'UE4SS 加载器目录，只取顶层，放 SB/Binaries/Win64/'
        },
        {
          match: '^dwmapi.dll',
          mode: 'files',
          into: '{game_root}/SB/Binaries/Win64',
          note: 'UE4SS 代理 dll，只取顶层，放 SB/Binaries/Win64/'
        },
        {
          match: '^Binaries',
          mode: 'folder',
          into: '{game_root}/SB',
          note: 'CNS 本体 Binaries 目录，并入 SB/'
        },
        {
          match: '^Content',
          mode: 'folder',
          into: '{game_root}/SB',
          note: 'CNS 本体 Content 目录，并入 SB/'
        },
        {
          match: '~Mods',
          mode: 'folder',
          into: '{game_root}/SB/Content/Paks',
          note: '包内自带 ~Mods/ 目录时并入 Paks/'
        },
        {
          match: '~mods',
          mode: 'folder',
          into: '{game_root}/SB/Content/Paks',
          note: '同上，大小写变体'
        },
        {
          match: '*.pak',
          mode: 'files',
          into: '{game_root}/SB/Content/Paks/~Mods',
          note: '散装 .pak 放 ~Mods/'
        },
        {
          match: '*.ucas',
          mode: 'files',
          into: '{game_root}/SB/Content/Paks/~Mods',
          note: '散装 .ucas 放 ~Mods/'
        },
        {
          match: '*.utoc',
          mode: 'files',
          into: '{game_root}/SB/Content/Paks/~Mods',
          note: '散装 .utoc 放 ~Mods/'
        },
        {
          match: '*',
          mode: 'folder',
          lift: 1,
          into: '{game_root}/SB/Content/Paks/~Mods',
          note: '兜底：无法识别的文件夹塞进 ~Mods/'
        }
      ],
      cleanup: {
        label: '剑星：清空 SB/Content/Paks/~Mods 下的所有 Mod',
        actions: [
          {
            op: 'purge',
            dir: 'SB/Content/Paks/~Mods',
            keepFiles: [],
            note: '清空 ~Mods/ 下全部内容'
          },
          {
            op: 'purge',
            dir: 'SB/Content/Paks/~mods',
            note: '清空大小写变体目录（若存在）'
          }
        ]
      }
    }
  }
}
