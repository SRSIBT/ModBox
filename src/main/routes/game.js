import fs from 'fs'
import path from 'path'
import express from 'express'
import { shell } from 'electron'
import { spawn } from 'child_process'
import { REPO_DIR, SETTINGS_FILE } from '../utils/paths.js'

const router = express.Router()

const gameDir = (id) => path.join(REPO_DIR, id)                 // repo游戏仓库文件夹
const gameFile = (id) => path.join(REPO_DIR, id, 'game.json')   // game.json游戏配置文件

// 读取 game.json 游戏配置文件
const readGame = (id) => {
  if (!isValidGameId(id) || !fs.existsSync(gameFile(id))) return null

  try {
    return JSON.parse(fs.readFileSync(gameFile(id), 'utf-8'))
  } catch (e) {
    console.warn(`[game.js] ${id}/game.json 解析失败：${e.message}`)
    return null
  }
}

// 验证游戏ID
const isValidGameId = (id) => {
  if (typeof id !== 'string') return false
  if (!id || id !== id.trim()) return false
  if (id === '.' || id === '..') return false
  if (/[\\/]/.test(id)) return false
  if (/[<>:"|?*\x00-\x1f]/.test(id)) return false
  if (/[. ]$/.test(id)) return false
  return path.basename(id) === id
}

// 获取游戏配置
router.get('/games', (req, res) => {
  if (!fs.existsSync(REPO_DIR)) return res.json({ games: [] })

  const games = fs.readdirSync(REPO_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const id = d.name
      const game = readGame(id)

      // 没有 game.json / 解析失败，回退成最小视图
      if (!game) {
        return {
          id,
          name: id,
          rootPath: '',
          exePath: '',
          cover: `/covers/${id}/cover.jpg`
        }
      }

      // game 存在，去掉 mods，其余返回
      const { mods, ...rest } = game
      return {
        ...rest,
        id: d.name,
        cover: `/covers/${id}/cover.jpg`
      }
    })

  res.json({ games })
})

// 更新游戏配置
router.post('/game', (req, res) => {
  const { cover, id, ...gameData } = req.body
  if (!isValidGameId(id)) {
    return res.status(400).json({ success: false, error: '无效的游戏 id' })
  }

  const isFile = !fs.existsSync(gameFile(id))
  if (!fs.existsSync(gameDir(id))) fs.mkdirSync(gameDir(id), { recursive: true })
  if (isFile) gameData.id = id
  fs.writeFileSync(gameFile(id), JSON.stringify(gameData, null, 2))

  res.json({ success: true })
})

// 删除游戏配置
router.delete('/game/:id', async (req, res) => {
  const id = req.params.id
  // id 会被当成目录名丢进回收站，必须先校验，否则 '../x' 能删到工作区外
  if (!isValidGameId(id)) return res.status(400).json({ success: false, error: '无效的游戏 id' })

  const dir = gameDir(id)
  if (fs.existsSync(dir)) {
    await shell.trashItem(dir)
  }

  // 删掉的正好是激活中的游戏，就清空 activeGameId
  if (!fs.existsSync(SETTINGS_FILE)) return
  try {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'))
    if (settings.activeGameId !== id) return
    settings.activeGameId = ''
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2))
  } catch (e) {
    console.warn(`[game.js] settings.json 解析失败，未清理 activeGameId：${e.message}`)
  }

  res.json({ success: true })
})

// 打开游戏根目录
router.post('/game/open-folder', (req, res) => {
  const { gameId } = req.body
  const game = readGame(gameId)
  if (!game) return res.json({ success: false })

  if (game.rootPath && fs.existsSync(game.rootPath)) {
    shell.openPath(game.rootPath)
  }
  res.json({ success: true })
})

// 启动游戏
router.post('/game/launch', (req, res) => {
  const { gameId } = req.body
  const game = readGame(gameId)
  if (!game) return res.json({ success: false })

  if (game.steamAppId) {
    shell.openExternal(`steam://rungameid/${game.steamAppId}`)
    return res.json({ success: true })
  }

  // 没有 steamAppId，用 exePath
  if (game.exePath && fs.existsSync(game.exePath)) {
    spawn(game.exePath, [], { detached: true, stdio: 'ignore' }).unref()
    return res.json({ success: true })
  }

  res.json({ success: false })
})

export default router