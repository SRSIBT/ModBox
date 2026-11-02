import fs from 'fs'
import path from 'path'
import { REPO_DIR } from './paths.js'
import { DEFAULT_MOD } from '../config/defaults.js'
import { BUILTIN_GAMES } from '../config/builtinGames.js'
import { isInside, readJson, writeJson } from './file.js'

const modsFile = (repoDir, gameId) => path.join(repoDir, gameId, 'mods.json')

export const getModDir = (gameId, modPath) => {
  if (typeof modPath !== 'string') return null

  const name = modPath.trim()
  if (!name || name !== modPath) return null
  if (name === '.' || name === '..' || name.includes('\0')) return null
  if (/[/\\]/.test(name)) return null
  if (/[<>:"|?*]/.test(name) || /[. ]$/.test(name)) return null
  if (path.isAbsolute(name) || /^[A-Za-z]:/.test(name)) return null

  const modsRoot = path.resolve(REPO_DIR, gameId, 'mods')
  const dir = path.resolve(modsRoot, name)
  if (dir === modsRoot || !isInside(modsRoot, dir)) return null

  return dir
}

export const findModCover = (gameId, modPath) => {
  if (typeof modPath !== 'string' || !modPath) return null

  const dir = path.join(REPO_DIR, gameId, 'mods', 'covers')
  if (!fs.existsSync(dir)) return null
  const name = fs.readdirSync(dir).find((file) => path.parse(file).name === modPath)
  return name ? { dir, name } : null
}

export const readGameMods = (gameId, { repoDir = REPO_DIR } = {}) => {
  if (!BUILTIN_GAMES[gameId]) return []
  const file = modsFile(repoDir, gameId)

  try {
    const data = readJson(file, null)
    if (data === null) return []
    if (Array.isArray(data.mods)) return data.mods
    console.warn(`[mods] ${gameId}/mods.json 格式不对，按空列表处理`)
  } catch (e) {
    console.warn(`[mods] ${gameId}/mods.json 读取失败，按空列表处理：${e.message}`)
  }

  return []
}

export const saveGameMods = (gameId, mods, { repoDir = REPO_DIR } = {}) => {
  if (!BUILTIN_GAMES[gameId]) return false
  writeJson(modsFile(repoDir, gameId), { mods: Array.isArray(mods) ? mods : [] })
  return true
}

export const createMod = ({ id, name, path: modPath, modId = '/' } = {}) => ({
  ...DEFAULT_MOD,
  id,
  name,
  path: modPath,
  modId
})
