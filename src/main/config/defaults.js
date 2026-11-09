// 软件默认设置。
// 所有用户可配置项都放这里；settings.json 缺失、为空或损坏时用它兜底并重建。

// 新模组入库时的默认字段
export const DEFAULT_MOD = {
  cover: '',
  modId: '/',
  version: '/',
  type: '通用',
  author: '/',
  group: '/',
  url: '',
  installed: false,
  describe: ''
}

export const DEFAULT_SETTINGS = {
  activeGameId: '',
  theme: 'dark',
  viewMode: 'table',
  background: 'default',
  backgroundOpacity: 50,
  weather: 'none',
  lastDialogPath: '',

  // 表头宽度；label 由前端维护，这里只持久化 key + width
  modColumns: [
    { key: 'status', width: 80 },
    { key: 'drag', width: 40 },
    { key: 'index', width: 30 },
    { key: 'cover', width: 60 },
    { key: 'name', width: 200 },
    { key: 'type', width: 80 },
    { key: 'modId', width: 100 },
    { key: 'version', width: 80 },
    { key: 'author', width: 80 },
    { key: 'group', width: 80 }
  ],

  // 用户实际安装路径。内置游戏只提供元数据，不再保存路径。
  gamePaths: {
    BlackMythWukong: {
      rootPath: '',
      exePath: ''
    },
    Cyberpunk2077: {
      rootPath: '',
      exePath: ''
    },
    KingdomComeDeliverance2: {
      rootPath: '',
      exePath: ''
    },
    RedDeadRedemption2: {
      rootPath: '',
      exePath: ''
    },
    ResidentEvilRequiem: {
      rootPath: '',
      exePath: ''
    },
    Sekiro: {
      rootPath: '',
      exePath: ''
    },
    StellarBlade: {
      rootPath: '',
      exePath: ''
    }
  }
}
