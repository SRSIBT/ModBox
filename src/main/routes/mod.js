import fs from 'fs'
import path from 'path'
import express from 'express'
import { shell } from 'electron'
import { REPO_DIR } from '../utils/paths.js'
import { buildTree } from '../utils/buildTree.js'
import { getManifest, installMod, uninstallMod } from '../utils/install.js'

const router = express.Router()

// game.json游戏配置文件
const gameFile = (id) => path.join(REPO_DIR, id, 'game.json')

// Mod 文件夹
const modDir = (gameId, modPath) =>
  isValidGameId(gameId) ? path.join(REPO_DIR, gameId, 'mods', modPath) : null

// 读取 Mod 数据
const readGame = (id) => {
  if (!isValidGameId(id) || !fs.existsSync(gameFile(id))) return null
  try {
    return JSON.parse(fs.readFileSync(gameFile(id), 'utf-8'))
  } catch (e) {
    console.warn(`[mod.js] ${id}/game.json 解析失败：${e.message}`)
    return null
  }
}

// 写入 Mod 数据
const writeGame = (id, game) =>
  fs.writeFileSync(gameFile(id), JSON.stringify(game, null, 2))

// 找到模组封面：用于删除模组封面
const findModCover = (gameId, modPath) => {
  const dir = path.join(REPO_DIR, gameId, 'mods', 'covers')
  if (!fs.existsSync(dir)) return null
  const name = fs.readdirSync(dir).find((f) => f.startsWith(modPath + '.'))
  return name ? { dir, name } : null
}

// 验证游戏ID
const isValidGameId = (id) => {
  if (typeof id !== 'string') return false
  if (!id || id !== id.trim()) return false
  if (id === '.' || id === '..') return false
  if (/[\\/]/.test(id)) return false
  if (/[<>:"|?*]/.test(id)) return false
  if ([...id].some((ch) => ch.charCodeAt(0) < 32)) return false
  if (/[. ]$/.test(id)) return false
  return path.basename(id) === id
}

// 获取指定 Mod 的文件树
// 注意：必须注册在 '/mods/:id' 之前，否则会被 :id 通配吞掉
router.get('/mods/files', (req, res) => {
  const { gameId, modPath } = req.query
  const dir = modDir(gameId, modPath)
  if (!dir || !fs.existsSync(dir)) return res.json({ files: [] })

  res.json({ files: buildTree(dir) })
})

// 查看安装清单（调试用）
// 必须放在 '/mods/:id' 之前，否则会被 :id 通配吞掉
router.get('/mods/manifest', (req, res) => {
  const { gameId } = req.query
  if (!isValidGameId(gameId)) {
    return res.status(400).json({ success: false, error: '无效的游戏 id' })
  }
  res.json({ success: true, manifest: getManifest(REPO_DIR, gameId) })
})

// 获取指定游戏的 Mod 配置
router.get('/mods/:id', (req, res) => {
  const id = req.params.id
  const game = readGame(id)

  if (!game) return res.json({ mods: [] })

  res.json({
    mods: (game.mods || []).map((mod) => ({
      ...mod,
      cover: mod.cover ? `/covers/${id}/mods/covers/${mod.cover}` : '',
      url:
        mod.modId && mod.modId !== '/'
          ? `https://www.nexusmods.com/${id.toLowerCase()}/mods/${mod.modId}`
          : ''
    }))
  })
})

// 修改激活游戏所有 Mod
router.post('/mods/save', (req, res) => {
  const { gameId, mods } = req.body
  if (!isValidGameId(gameId)) {
    return res.status(400).json({ success: false, error: '无效的游戏 id' })
  }

  const game = readGame(gameId)
  if (!game) {
    return res.status(404).json({ success: false, error: '游戏不存在' })
  }

  game.mods = mods.map((mod) => {
    let cover = mod.cover || ''
    if (cover.startsWith('/covers/')) cover = cover.split('/').pop()
    delete mod.url
    return { ...mod, cover }
  })

  writeGame(gameId, game)
  res.json({ success: true })
})

// 删除激活游戏指定 Mod
router.post('/mods/delete', async (req, res) => {
  const { gameId, modPath } = req.body
  if (!isValidGameId(gameId)) return res.json({ success: false })

  const game = readGame(gameId)
  if (!game) return res.json({ success: false })

  // 删模组文件夹
  const dir = modDir(gameId, modPath)
  if (dir && fs.existsSync(dir)) {
    await shell.trashItem(dir) // 进回收站
  }

  // 删封面
  const cover = findModCover(gameId, modPath)
  if (cover) await shell.trashItem(path.join(cover.dir, cover.name))

  // 从 game.json 删
  game.mods = (game.mods || []).filter((m) => m.path !== modPath)
  writeGame(gameId, game)

  res.json({ success: true })
})

// 导入 Mod 到指定游戏仓库
router.post('/mods/import', (req, res) => {
  const { gameId, paths } = req.body
  if (!isValidGameId(gameId)) {
    return res.status(400).json({ success: false, error: '无效的游戏 id' })
  }

  // 先确认游戏存在，再建目录，避免给不存在的游戏留下空仓库
  const game = readGame(gameId)
  if (!game) {
    return res.status(404).json({ success: false, error: '游戏不存在' })
  }
  if (!game.mods) game.mods = []

  const dir = path.join(REPO_DIR, gameId, 'mods')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const errors = []

  paths.forEach((p) => {
    const stat = fs.statSync(p)
    const name = path.basename(p)
    const dest = path.join(dir, name)

    const nextId = game.mods.length > 0 ? Math.max(...game.mods.map((m) => m.id)) + 1 : 1
    const record = {
      id: nextId,
      name,
      path: name,
      cover: '',
      modId: '/',
      version: '/',
      type: '通用',
      author: '/',
      group: '/',
      url: '',
      installed: false
    }

    if (stat.isDirectory()) {
      // 文件夹，复制
      fs.cpSync(p, dest, { recursive: true })
      game.mods.push(record)
    } else if (['.zip', '.rar', '.7z', '.gmm'].includes(path.extname(p).toLowerCase())) {
      // 压缩包，复制文件，以后解压
      fs.copyFileSync(p, dest)
      game.mods.push(record)
    } else {
      errors.push(`格式不支持：${name}`)
    }
  })

  writeGame(gameId, game)
  res.json({ success: true, errors })
})

// 安装 Mod：按 install.json 的 placements 复制文件，并写 manifest.json
router.post('/mods/install', async (req, res) => {
  const { gameId, modPath } = req.body
  if (!isValidGameId(gameId)) {
    return res.status(400).json({ success: false, error: '无效的游戏 id' })
  }
  if (typeof modPath !== 'string' || !modPath) {
    return res.status(400).json({ success: false, error: '无效的 Mod 路径' })
  }

  try {
    const result = await installMod({ repoDir: REPO_DIR, gameId, modPath })
    res.json({ success: true, ...result })
  } catch (e) {
    console.error('[mod.js] 安装失败：', e)
    res.status(500).json({ success: false, error: e.message })
  }
})

// 卸载 Mod：只按 manifest.json 删除文件并还原 .bak
router.post('/mods/uninstall', async (req, res) => {
  const { gameId, modPath } = req.body
  if (!isValidGameId(gameId)) {
    return res.status(400).json({ success: false, error: '无效的游戏 id' })
  }
  if (typeof modPath !== 'string' || !modPath) {
    return res.status(400).json({ success: false, error: '无效的 Mod 路径' })
  }

  try {
    const result = await uninstallMod({ repoDir: REPO_DIR, gameId, modPath })
    res.json({ success: true, ...result })
  } catch (e) {
    console.error('[mod.js] 卸载失败：', e)
    res.status(500).json({ success: false, error: e.message })
  }
})

// 导入 Mod 封面
router.post('/mods/cover', (req, res) => {
  const { gameId, modPath, coverPath } = req.body
  if (!isValidGameId(gameId)) {
    return res.status(400).json({ success: false, error: '无效的游戏 id' })
  }
  // 不校验的话会给不存在的游戏凭空建出 mods/covers 空目录
  if (!fs.existsSync(gameFile(gameId))) {
    return res.status(404).json({ success: false, error: '游戏不存在' })
  }

  const dir = path.join(REPO_DIR, gameId, 'mods', 'covers')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  // 删旧封面
  const old = findModCover(gameId, modPath)
  if (old) fs.unlinkSync(path.join(old.dir, old.name))

  const filename = `${modPath}${path.extname(coverPath).toLowerCase()}`
  fs.copyFileSync(coverPath, path.join(dir, filename))
  res.json({ filename })
})

// 打开 Mod 文件夹
router.post('/mods/open-folder', (req, res) => {
  const { gameId, modPath } = req.body
  const dir = modDir(gameId, modPath)
  if (!dir || !fs.existsSync(dir)) return res.json({ success: false })

  shell.openPath(dir)
  res.json({ success: true })
})

export default router