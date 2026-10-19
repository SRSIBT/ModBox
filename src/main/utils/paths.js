import path from 'path'
import { app } from 'electron'

// 开发：项目根 data/ —— out/main/../../ = E:\ModBox
// 打包：exe 同级 data/ —— 便携式，数据跟着软件走
export const DATA_DIR = app.isPackaged
  ? path.join(path.dirname(app.getPath('exe')), 'data')
  : path.join(__dirname, '../..', 'data')

export const REPO_DIR = path.join(DATA_DIR, 'repo')                 // 游戏仓库路径
export const NOTICES_FILE = path.join(DATA_DIR, 'notices.json')     // 公告栏文件路径
export const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')   // 设置文件路径
export const BACKGROUNDS_DIR = path.join(DATA_DIR, 'backgrounds')   // 背景图仓库路径
export const DOWNLOADS_DIR = path.join(DATA_DIR, 'downloads')       // nxm 下载落盘目录（只存压缩包，不解压）

// 应用信息（关于页展示用），开发/打包都指向项目或安装目录根
export const APP_ROOT = app.isPackaged ? app.getAppPath() : path.join(__dirname, '../..')
