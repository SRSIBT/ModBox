import path from 'path'
import { app } from 'electron'

// 开发时主进程代码在 out/main，往上两级回到项目根；打包后数据放在 exe 旁边。
export const DATA_DIR = app.isPackaged
  ? path.join(path.dirname(app.getPath('exe')), 'data')
  : path.join(__dirname, '../..', 'data')

export const REPO_DIR = path.join(DATA_DIR, 'repo') // 游戏仓库路径
export const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json') // 设置文件路径
export const NOTICE_STATE_FILE = path.join(DATA_DIR, 'notice-state.json') // 公告已读状态
export const BACKGROUNDS_DIR = path.join(DATA_DIR, 'backgrounds') // 背景图仓库路径

// 内置静态资源：开发时读源码目录，打包后由 extraResources 放到 resources 根目录
export const BUILTIN_RESOURCES_DIR = app.isPackaged
  ? process.resourcesPath
  : path.join(__dirname, '../../src/main/resources')
export const BUILTIN_COVERS_DIR = path.join(BUILTIN_RESOURCES_DIR, 'covers')
export const BUILTIN_BACKGROUNDS_DIR = path.join(BUILTIN_RESOURCES_DIR, 'backgrounds')

// 应用根目录，关于页要读 package.json
export const APP_ROOT = app.isPackaged ? app.getAppPath() : path.join(__dirname, '../..')
