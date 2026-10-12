import express from 'express'
import fs from 'fs'
import path from 'path'
import { shell } from 'electron'
import { REPO_DIR } from '../utils/paths.js'
import { buildTree } from '../utils/buildTree.js'
import { findGameDir } from '../utils/findGameDir.js'

const router = express.Router()

// 获取指定游戏所有 Mod
router.get('/mods/:id', (req, res) => {
    // 获取指定 Mod 文件
    if (req.params.id === 'files') {
        const { gameName, modPath } = req.query

        const gameDir = findGameDir(gameName)
        if (!gameDir) return res.json({ files: [] })

        const dir = path.join(REPO_DIR, gameDir, 'mods', modPath)
        if (!fs.existsSync(dir)) return res.json({ files: [] })

        return res.json({ files: buildTree(dir) })
    }

    // 获取所有 Mod 配置
    const gameFile = path.join(REPO_DIR, req.params.id, 'game.json')
    if (!fs.existsSync(gameFile)) return res.json({ mods: [] })
    const game = JSON.parse(fs.readFileSync(gameFile, 'utf-8'))
    res.json({ mods: game.mods || [] })
})

// 修改指定游戏所有 Mod
router.post('/mods/save', (req, res) => {
    const { gameId, mods } = req.body

    const processed = mods.map(mod => {
        // cover 是 URL，剥成文件名
        let cover = mod.cover || ''
        if (cover.startsWith('/covers/')) {
            cover = cover.split('/').pop()
        }

        // modId 有值，拼 N 网 URL
        let url = ''
        if (mod.modId && mod.modId !== '/') {
            const nexusGame = gameId.toLowerCase()
            url = `https://www.nexusmods.com/${nexusGame}/mods/${mod.modId}`
        }

        return { ...mod, cover, url }
    })

    const gameFile = path.join(REPO_DIR, gameId, 'game.json')
    const game = JSON.parse(fs.readFileSync(gameFile, 'utf-8'))
    game.mods = processed
    fs.writeFileSync(gameFile, JSON.stringify(game, null, 2))
    res.json({ success: true })
})

// 删除 Mod
router.post('/mods/delete', async (req, res) => {
    const { gameName, modPath } = req.body

    const gameDir = findGameDir(gameName)
    if (!gameDir) return res.json({ success: false })

    // 删模组文件夹
    const dir = path.join(REPO_DIR, gameDir, 'mods', modPath)
    if (fs.existsSync(dir)) {
        await shell.trashItem(dir)   // 进回收站
    }

    // 删封面
    const coversDir = path.join(REPO_DIR, gameDir, 'mods', 'covers')
    if (fs.existsSync(coversDir)) {
        const old = fs.readdirSync(coversDir).find(f => f.startsWith(modPath + '.'))
        if (old) await shell.trashItem(path.join(coversDir, old))
    }

    // 从 game.json 删
    const gameFile = path.join(REPO_DIR, gameDir, 'game.json')
    const game = JSON.parse(fs.readFileSync(gameFile, 'utf-8'))
    game.mods = (game.mods || []).filter(m => m.path !== modPath)
    fs.writeFileSync(gameFile, JSON.stringify(game, null, 2))

    res.json({ success: true })
})

// 导入 Mod 到指定游戏仓库
router.post('/mods/import', (req, res) => {
    const { gameId, paths } = req.body

    const modsDir = path.join(REPO_DIR, gameId, 'mods')
    if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true })

    const gameFile = path.join(REPO_DIR, gameId, 'game.json')
    const game = JSON.parse(fs.readFileSync(gameFile, 'utf-8'))
    if (!game.mods) game.mods = []

    const errors = []

    paths.forEach(p => {
        const stat = fs.statSync(p)
        const name = path.basename(p)

        if (stat.isDirectory()) {
            // 文件夹，复制
            const dest = path.join(modsDir, name)
            fs.cpSync(p, dest, { recursive: true })

            const nextId = game.mods.length > 0
                ? Math.max(...game.mods.map(m => m.id)) + 1
                : 1
            game.mods.push({
                id: nextId,
                name: name,
                path: name,
                cover: '',
                modId: '/',
                version: '/',
                type: '通用',
                author: '/',
                group: '/',
                url: '',
                installed: false
            })
        } else {
            // 文件，判断扩展名
            const ext = path.extname(p).toLowerCase()
            if (['.zip', '.rar', '.7z', '.gmm'].includes(ext)) {
                // 复制文件，以后解压
                const dest = path.join(modsDir, name)
                fs.copyFileSync(p, dest)

                const nextId = game.mods.length > 0
                    ? Math.max(...game.mods.map(m => m.id)) + 1
                    : 1
                game.mods.push({
                    id: nextId,
                    name: name,
                    path: name,
                    cover: '',
                    modId: '/',
                    version: '/',
                    type: '通用',
                    author: '/',
                    group: '/',
                    installed: false
                })
            } else {
                errors.push(`格式不支持：${name}`)
            }
        }
    })

    fs.writeFileSync(gameFile, JSON.stringify(game, null, 2))
    res.json({ success: true, errors })
})

// 导入 Mod 封面
router.post('/mods/cover', (req, res) => {
    const { gameId, modPath, coverPath } = req.body
    const coversDir = path.join(REPO_DIR, gameId, 'mods', 'covers')
    if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true })

    const ext = path.extname(coverPath).toLowerCase()
    const dest = path.join(coversDir, `${modPath}${ext}`)

    // 删旧封面
    const old = fs.readdirSync(coversDir).find(f => f.startsWith(modPath + '.'))
    if (old) fs.unlinkSync(path.join(coversDir, old))

    fs.copyFileSync(coverPath, dest)
    res.json({ filename: `${modPath}${ext}` })
})

// 打开 Mod 文件夹
router.post('/mods/open-folder', (req, res) => {
    const { gameName, modPath } = req.body

    // 找 gameDir
    const gameDir = findGameDir(gameName)
    if (!gameDir) return res.json({ success: false })

    const dir = path.join(REPO_DIR, gameDir, 'mods', modPath)
    if (!fs.existsSync(dir)) return res.json({ success: false })

    shell.openPath(dir)
    res.json({ success: true })
})

export default router