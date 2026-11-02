import fs from 'fs'
import path from 'path'
import express from 'express'
import { shell } from 'electron'
import { getGame } from '../stores/game.js'
import { createMod, findModCover, getModDir as modDir, saveGameMods } from '../stores/mod.js'
import { cleanupGameMods, installMod, uninstallMod } from '../stores/install.js'
import { REPO_DIR } from '../stores/paths.js'

const router = express.Router()

const buildTree = (dir) => {
  const items = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return items.map((item) => {
    const full = path.join(dir, item.name)
    if (item.isDirectory()) {
      return { name: item.name, isDir: true, open: false, children: buildTree(full) }
    }
    return { name: item.name, isDir: false, size: fs.statSync(full).size }
  })
}

// 获取指定 Mod 的文件树
// 注意：必须注册在 '/mods/:id' 之前，否则会被 :id 通配吞掉
router.get('/mods/files', (req, res) => {
  const { gameId, modPath } = req.query
  if (!getGame(gameId)) return res.json({ files: [] })
  const dir = modDir(gameId, modPath)
  if (!dir || !fs.existsSync(dir)) return res.json({ files: [] })

  res.json({ files: buildTree(dir) })
})

// 获取某个游戏的安装规则
// 必须放在 '/mods/:id' 之前，否则会被 :id 通配吞掉
router.get('/mods/rules', (req, res) => {
  const { gameId } = req.query

  // 安装规则完全由 builtinGames.js 接管
  const builtin = getGame(gameId)?.installRules
  const placements = Array.isArray(builtin?.placements) ? builtin.placements : []

  res.json({
    success: true,
    exists: placements.length > 0,
    source: 'builtin',
    placements
  })
})

// 获取指定游戏的所有 Mod
router.get('/mods/:id', (req, res) => {
  const id = req.params.id
  const game = getGame(id)

  if (!game) return res.json({ mods: [] })

  const domain = game.nexusDomain || id.toLowerCase()
  res.json({
    mods: (game.mods || []).map((mod) => ({
      ...mod,
      cover: mod.cover ? `/covers/${id}/mods/covers/${mod.cover}` : '',
      url:
        mod.modId && mod.modId !== '/'
          ? `https://www.nexusmods.com/${domain}/mods/${mod.modId}`
          : ''
    }))
  })
})

// 修改指定游戏所有 Mod
router.post('/mods/save', (req, res) => {
  const { gameId, mods } = req.body

  if (!getGame(gameId)) {
    return res.status(404).json({ success: false, error: '游戏不存在' })
  }
  if (!Array.isArray(mods)) {
    return res.status(400).json({ success: false, error: 'mods 必须是数组' })
  }

  const saved = mods.map((mod) => {
    const next = { ...(mod || {}) }
    delete next.url
    let cover = next.cover || ''
    if (cover.startsWith('/covers/')) cover = cover.split('/').pop()
    return { ...next, cover }
  })

  saveGameMods(gameId, saved)
  res.json({ success: true })
})

// 一键卸载全部 Mod 并清理游戏目录残留
router.post('/mods/cleanup', async (req, res) => {
  const { gameId } = req.body || {}
  if (!getGame(gameId)) {
    return res.status(404).json({ success: false, error: '游戏不存在' })
  }

  try {
    const result = await cleanupGameMods({ repoDir: REPO_DIR, gameId })
    res.json({ success: true, ...result })
  } catch (e) {
    console.error('[mod.js] 清理 Mod 失败：', e)
    res.status(500).json({ success: false, error: e.message })
  }
})

// 删除激活游戏指定 Mod
router.post('/mods/delete', async (req, res) => {
  const { gameId, modPath } = req.body || {}

  const game = getGame(gameId)
  if (!game) return res.json({ success: false })

  // 空串 / "." / ".." / 路径分隔符都必须在这里挡掉：
  // 否则空串会解析成整个 mods/ 目录，"." 或 ".." 会删到仓库根。
  const dir = modDir(gameId, modPath)
  if (!dir) {
    return res.status(400).json({ success: false, error: '无效的 Mod 路径' })
  }

  try {
    // 只要游戏路径在，就先清游戏目录里的副本；
    // 没有 manifest 的旧安装也要按源文件做一次兜底清理。
    if (game.rootPath && fs.existsSync(game.rootPath)) {
      await uninstallMod({ repoDir: REPO_DIR, gameId, modPath })
    }

    // 删模组文件夹
    if (fs.existsSync(dir)) {
      await shell.trashItem(dir) // 进回收站
    }

    // 删封面。封面失败只提示，不阻止 Mod 本身删除，
    // 否则会出现「源文件夹已经进了回收站，mods.json 里却还留着」的状态。
    let warning = ''
    const cover = findModCover(gameId, modPath)
    if (cover) {
      try {
        await shell.trashItem(path.join(cover.dir, cover.name))
      } catch (e) {
        warning = `Mod 已删除，但封面删除失败：${e.message}`
        console.warn('[mod.js] 删除 Mod 封面失败：', e)
      }
    }

    // 从 mods.json 的 mods 里删
    const mods = (game.mods || []).filter((m) => m.path !== modPath)
    saveGameMods(gameId, mods)

    res.json({ success: true, ...(warning ? { warning } : {}) })
  } catch (e) {
    console.error('[mod.js] 删除 Mod 失败：', e)
    res.status(500).json({ success: false, error: e.message })
  }
})

// 导入 Mod 到指定游戏仓库
router.post('/mods/import', (req, res) => {
  const { gameId, paths } = req.body
  if (!Array.isArray(paths) || paths.length === 0) {
    return res.status(400).json({ success: false, error: '没有可导入的路径' })
  }

  // 先确认游戏存在，再建目录，避免给不存在的游戏留下空仓库
  const game = getGame(gameId)
  if (!game) {
    return res.status(404).json({ success: false, error: '游戏不存在' })
  }
  const mods = Array.isArray(game.mods) ? game.mods : []

  const dir = path.join(REPO_DIR, gameId, 'mods')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const errors = []
  const archiveExts = ['.zip', '.7z', '.rar']

  paths.forEach((p) => {
    if (typeof p !== 'string' || !p) {
      errors.push('无效的导入路径')
      return
    }

    const name = path.basename(p)

    try {
      const stat = fs.statSync(p)
      const isFolder = stat.isDirectory()
      const isArchive = stat.isFile() && archiveExts.includes(path.extname(p).toLowerCase())

      // 后端兜底：非文件夹且后缀不在白名单内，直接跳过
      if (!isFolder && !isArchive) {
        errors.push(`只支持导入文件夹和压缩包：${name}`)
        return
      }

      const dest = path.join(dir, name)
      if (isFolder) {
        // 文件夹，原样复制
        fs.cpSync(p, dest, { recursive: true })
      } else {
        // 压缩包，原样复制，不解压
        fs.copyFileSync(p, dest)
      }

      const nextId = mods.length > 0 ? Math.max(...mods.map((m) => Number(m.id) || 0)) + 1 : 1
      mods.push(createMod({ id: nextId, name, path: name }))
    } catch (e) {
      errors.push(`导入失败：${name}（${e.message}）`)
    }
  })

  saveGameMods(gameId, mods)
  res.json({ success: true, errors })
})

// 安装 Mod：按内置 installRules 的 placements 复制文件，并写 manifest.json
router.post('/mods/install', async (req, res) => {
  const { gameId, modPath } = req.body
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
  const { gameId, modPath, coverPath } = req.body || {}
  // 不校验的话会给不存在的游戏凭空建出 mods/covers 空目录
  if (!getGame(gameId)) {
    return res.status(404).json({ success: false, error: '游戏不存在' })
  }
  if (!modDir(gameId, modPath)) {
    return res.status(400).json({ success: false, error: '无效的 Mod 路径' })
  }
  if (typeof coverPath !== 'string' || !coverPath || !fs.existsSync(coverPath)) {
    return res.status(400).json({ success: false, error: '封面文件不存在' })
  }
  if (!fs.statSync(coverPath).isFile()) {
    return res.status(400).json({ success: false, error: '封面路径不是文件' })
  }

  const ext = path.extname(coverPath).toLowerCase()
  if (!ext) {
    return res.status(400).json({ success: false, error: '无法识别图片格式' })
  }

  const dir = path.join(REPO_DIR, gameId, 'mods', 'covers')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const filename = `${modPath}${ext}`
  const target = path.join(dir, filename)
  const old = findModCover(gameId, modPath)

  // 先复制新图，成功后再删旧图，避免源文件异常时把旧封面也弄丢
  fs.copyFileSync(coverPath, target)
  if (old && old.name !== filename) fs.unlinkSync(path.join(old.dir, old.name))

  res.json({ filename })
})

// 打开 Mod 文件夹
router.post('/mods/open-folder', async (req, res) => {
  const { gameId, modPath } = req.body || {}
  if (!getGame(gameId)) return res.json({ success: false, error: '游戏不存在' })
  const dir = modDir(gameId, modPath)
  if (!dir || !fs.existsSync(dir)) return res.json({ success: false, error: 'Mod 不存在' })

  const error = await shell.openPath(dir)
  res.json({ success: !error, error })
})

export default router
