import express from 'express'
import fs from 'fs'
import path from 'path'
import { shell } from 'electron'
import { spawn } from 'child_process'
import { findGameDir } from '../utils/findGameDir.js'
import { REPO_DIR, SETTINGS_FILE } from '../utils/paths.js'

const router = express.Router()

// 获取游戏配置
router.get('/games', (req, res) => {
    if (!fs.existsSync(REPO_DIR)) return res.json({ games: [] })

    const dirs = fs.readdirSync(REPO_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory())

    const games = dirs.map(d => {
        const gameFile = path.join(REPO_DIR, d.name, 'game.json')
        if (fs.existsSync(gameFile)) {
            const game = JSON.parse(fs.readFileSync(gameFile, 'utf-8'))

            const mods = (game.mods || []).map(mod => ({
                ...mod,
                cover: mod.cover
                    ? `/covers/${d.name}/mods/covers/${mod.cover}`
                    : ''
            }))
            return {
                ...game,
                mods,
                cover: `/covers/${d.name}/cover.jpg`
            }
        }
        return {
            name: d.name,
            rootPath: '',
            exePath: '',
            mods: [],
            cover: `/covers/${d.name}/cover.jpg`
        }
    })

    res.json({ games })
})

// 更新游戏配置
router.post('/game', (req, res) => {
    const game = req.body
    const gameDir = path.join(REPO_DIR, game.id)
    if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true })

    const gameFile = path.join(gameDir, 'game.json')
    const { cover, ...gameData } = game
    fs.writeFileSync(gameFile, JSON.stringify(gameData, null, 2))
    res.json({ success: true })
})

// 删除游戏配置
router.delete('/game/:id', async (req, res) => {
    const id = req.params.id
    const gameDir = path.join(REPO_DIR, id)
    const gameFile = path.join(gameDir, 'game.json')

    // 读 name
    let gameName = ''
    if (fs.existsSync(gameFile)) {
        gameName = JSON.parse(fs.readFileSync(gameFile, 'utf-8')).name
    }

    // 删文件夹
    if (fs.existsSync(gameDir)) {
        await shell.trashItem(gameDir)
    }

    // 比 name，清 activeGame
    if (fs.existsSync(SETTINGS_FILE)) {
        const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'))
        if (settings.activeGame === gameName) {
            settings.activeGame = ''
            fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2))
        }
    }

    res.json({ success: true })
})

// 打开游戏根目录
router.post('/game/open-folder', (req, res) => {
    const { gameName } = req.body
    const gameDir = findGameDir(gameName)
    if (!gameDir) return res.json({ success: false })

    const gameFile = path.join(REPO_DIR, gameDir, 'game.json')
    const game = JSON.parse(fs.readFileSync(gameFile, 'utf-8'))
    if (game.rootPath && fs.existsSync(game.rootPath)) {
        shell.openPath(game.rootPath)
    }
    res.json({ success: true })
})

// 启动游戏
router.post('/game/launch', (req, res) => {
    const { gameName } = req.body
    const gameDir = findGameDir(gameName)
    if (!gameDir) return res.json({ success: false })

    const gameFile = path.join(REPO_DIR, gameDir, 'game.json')
    const game = JSON.parse(fs.readFileSync(gameFile, 'utf-8'))

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