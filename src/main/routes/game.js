import fs from 'fs'
import path from 'path'
import express from 'express'
import { shell } from 'electron'
import { spawn } from 'child_process'
import { getGame, getGames, saveGamePaths } from '../stores/game.js'

const router = express.Router()

// 获取游戏列表
router.get('/games', (req, res) => {
  res.json({ games: getGames() })
})

// 保存游戏路径
router.post('/game', (req, res) => {
  const { id, rootPath, exePath } = req.body || {}
  const paths = {}
  if (typeof rootPath === 'string') paths.rootPath = rootPath
  if (typeof exePath === 'string') paths.exePath = exePath

  const saved = saveGamePaths(id, paths)
  if (!saved) return res.status(404).json({ success: false, error: '游戏不存在' })

  res.json({ success: true, rootPath: saved.rootPath || '', exePath: saved.exePath || '' })
})

// 打开游戏根目录
router.post('/game/open-folder', async (req, res) => {
  const { gameId } = req.body || {}
  const game = getGame(gameId)

  if (!game) return res.status(404).json({ success: false, error: '游戏不存在' })
  if (!game.rootPath) {
    return res.json({ success: false, error: '尚未设置游戏根目录' })
  }
  if (!fs.existsSync(game.rootPath)) {
    return res.json({ success: false, error: `游戏根目录不存在：${game.rootPath}` })
  }

  try {
    const error = await shell.openPath(game.rootPath)
    if (error) return res.json({ success: false, error })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

// 启动游戏：优先 Steam；Steam 启动失败时用用户配置的 exe 兜底
router.post('/game/launch', async (req, res) => {
  const { gameId } = req.body || {}
  const game = getGame(gameId)

  if (!game) return res.status(404).json({ success: false, error: '游戏不存在' })

  let steamError = ''

  if (game.steamAppId) {
    try {
      await shell.openExternal(`steam://rungameid/${game.steamAppId}`)
      return res.json({ success: true, via: 'steam' })
    } catch (e) {
      steamError = e.message
      console.warn('[game.js] Steam 启动失败，尝试 exe 兜底：', e.message)
    }
  }

  if (game.exePath && fs.existsSync(game.exePath)) {
    try {
      const child = spawn(game.exePath, [], {
        cwd: path.dirname(game.exePath),
        detached: true,
        stdio: 'ignore'
      })
      await new Promise((resolve, reject) => {
        child.once('spawn', resolve)
        child.once('error', reject)
      })
      child.unref()
      return res.json({ success: true, via: 'exe' })
    } catch (e) {
      return res.status(500).json({
        success: false,
        error: `exe 启动失败：${e.message}` + (steamError ? `；Steam 错误：${steamError}` : '')
      })
    }
  }

  res.json({
    success: false,
    error: steamError
      ? `Steam 启动失败：${steamError}；也没有可用的 exePath`
      : '没有可用的 Steam App ID 或 exePath'
  })
})

export default router
