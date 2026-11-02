import fs from 'fs'
import path from 'path'
import { readJson, writeJson } from './file.js'
import { DEFAULT_SETTINGS } from '../config/defaults.js'
import { BUILTIN_GAMES } from '../config/builtinGames.js'
import { BACKGROUNDS_DIR, SETTINGS_FILE } from './paths.js'

const clone = (value) => JSON.parse(JSON.stringify(value))
const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value)

const normalizeColumns = (value) => {
  if (!Array.isArray(value)) return clone(DEFAULT_SETTINGS.modColumns)
  const columns = value
    .filter((item) => isObject(item) && typeof item.key === 'string' && item.key)
    .map((item) => {
      const width = Number(item.width)
      return { key: item.key, width: Number.isFinite(width) && width > 0 ? width : 80 }
    })
  return columns.length ? columns : clone(DEFAULT_SETTINGS.modColumns)
}

const normalizePaths = (value) => {
  const input = isObject(value) ? value : {}
  const result = {}

  for (const id of Object.keys(BUILTIN_GAMES)) {
    const fallback = DEFAULT_SETTINGS.gamePaths[id] || {}
    const item = isObject(input[id]) ? input[id] : {}
    result[id] = {
      rootPath: typeof item.rootPath === 'string' ? item.rootPath : fallback.rootPath || '',
      exePath: typeof item.exePath === 'string' ? item.exePath : fallback.exePath || ''
    }
  }

  return result
}

const normalize = (raw) => {
  const input = isObject(raw) ? raw : {}
  const base = clone(DEFAULT_SETTINGS)
  const activeGameId = typeof input.activeGameId === 'string' ? input.activeGameId : ''

  return {
    activeGameId: BUILTIN_GAMES[activeGameId] ? activeGameId : '',
    theme: ['light', 'dark'].includes(input.theme) ? input.theme : base.theme,
    viewMode: ['table', 'card'].includes(input.viewMode) ? input.viewMode : base.viewMode,
    background: ['default', 'custom'].includes(input.background)
      ? input.background
      : base.background,
    backgroundOpacity: Math.min(
      100,
      Math.max(
        0,
        Number.isFinite(Number(input.backgroundOpacity))
          ? Number(input.backgroundOpacity)
          : base.backgroundOpacity
      )
    ),
    weather: ['none', 'rain', 'snow'].includes(input.weather) ? input.weather : base.weather,
    minimizeToTray:
      typeof input.minimizeToTray === 'boolean' ? input.minimizeToTray : base.minimizeToTray,
    autoImport: typeof input.autoImport === 'boolean' ? input.autoImport : base.autoImport,
    modColumns: normalizeColumns(input.modColumns),
    gamePaths: normalizePaths(input.gamePaths)
  }
}

export const readSettings = () => {
  if (!fs.existsSync(SETTINGS_FILE)) {
    const settings = normalize(null)
    writeJson(SETTINGS_FILE, settings)
    return settings
  }

  try {
    const raw = readJson(SETTINGS_FILE, {})
    const settings = normalize(raw)
    if (JSON.stringify(raw) !== JSON.stringify(settings)) writeJson(SETTINGS_FILE, settings)
    return settings
  } catch (e) {
    console.warn(`[settings] 文件损坏，使用默认设置：${e.message}`)
    const settings = normalize(null)
    writeJson(SETTINGS_FILE, settings)
    return settings
  }
}

export const saveSettings = (patch = {}) => {
  const current = readSettings()
  const input = isObject(patch) ? patch : {}
  const gamePaths = { ...current.gamePaths }

  if (isObject(input.gamePaths)) {
    for (const [gameId, item] of Object.entries(input.gamePaths)) {
      if (!BUILTIN_GAMES[gameId] || !isObject(item)) continue
      gamePaths[gameId] = { ...(gamePaths[gameId] || {}), ...item }
    }
  }

  const next = normalize({
    ...current,
    ...input,
    gamePaths,
    modColumns: input.modColumns !== undefined ? input.modColumns : current.modColumns
  })

  writeJson(SETTINGS_FILE, next)
  return next
}

const findCustomBackground = () => {
  if (!fs.existsSync(BACKGROUNDS_DIR)) return null
  return (
    fs.readdirSync(BACKGROUNDS_DIR).find((file) => file.toLowerCase().startsWith('custom.')) || null
  )
}

export const getBackgroundState = () => {
  const file = findCustomBackground()
  if (!file) return { hasCustom: false, url: '' }

  try {
    const mtime = Math.round(fs.statSync(path.join(BACKGROUNDS_DIR, file)).mtimeMs)
    return { hasCustom: true, url: `/backgrounds/${encodeURIComponent(file)}?v=${mtime}` }
  } catch {
    return { hasCustom: false, url: '' }
  }
}

export const setCustomBackground = (image) => {
  if (!image || !fs.existsSync(image)) throw new Error('图片不存在')
  const ext = path.extname(image).toLowerCase()
  if (!ext) throw new Error('无法识别图片格式')

  fs.mkdirSync(BACKGROUNDS_DIR, { recursive: true })
  const target = path.join(BACKGROUNDS_DIR, `custom${ext}`)
  const old = findCustomBackground()
  fs.copyFileSync(image, target)
  if (old && old !== path.basename(target)) fs.unlinkSync(path.join(BACKGROUNDS_DIR, old))

  return getBackgroundState()
}

export const removeCustomBackground = () => {
  const file = findCustomBackground()
  if (file) fs.unlinkSync(path.join(BACKGROUNDS_DIR, file))
  return { hasCustom: false, url: '' }
}
