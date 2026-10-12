import path from 'path'
import { app } from 'electron'

const isDev = !app.isPackaged
export const DATA_DIR = isDev
  ? path.join(__dirname, '../../src/main/data')
  : path.join(app.getPath('userData'), 'data')

export const REPO_DIR = path.join(DATA_DIR, 'repo')
export const NOTICES_FILE = path.join(DATA_DIR, 'notices.json')
export const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')