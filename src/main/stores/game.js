import { REPO_DIR } from './paths.js'
import { readGameMods } from './mod.js'
import { BUILTIN_GAMES } from '../config/builtinGames.js'
import { readSettings, saveSettings } from './setting.js'

export const getGames = () => {
  const settings = readSettings()
  return Object.values(BUILTIN_GAMES).map((game) => {
    const item = settings.gamePaths[game.id] || {}
    return {
      ...game,
      rootPath: item.rootPath || '',
      exePath: item.exePath || ''
    }
  })
}

export const getGame = (gameId, { repoDir = REPO_DIR } = {}) => {
  const game = BUILTIN_GAMES[gameId]
  if (!game) return null

  const item = readSettings().gamePaths[gameId] || {}
  return {
    ...game,
    rootPath: item.rootPath || '',
    exePath: item.exePath || '',
    mods: readGameMods(gameId, { repoDir })
  }
}

export const saveGamePaths = (gameId, paths = {}) => {
  if (!BUILTIN_GAMES[gameId]) return null

  const item = {}
  if (typeof paths.rootPath === 'string') item.rootPath = paths.rootPath
  if (typeof paths.exePath === 'string') item.exePath = paths.exePath

  return saveSettings({ gamePaths: { [gameId]: item } }).gamePaths[gameId]
}
