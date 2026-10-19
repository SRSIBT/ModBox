import fs from 'fs'
import path from 'path'
import express from 'express'
import { APP_ROOT, SETTINGS_FILE, BACKGROUNDS_DIR } from '../utils/paths.js'

const router = express.Router()

// 扫背景目录，返回 { hasCustom, file, mtime }
const bgState = () => {
  let file = null
  file = fs
    .readdirSync(BACKGROUNDS_DIR)
    .find((f) => f.toLowerCase().startsWith("custom.")) || null

  if (!file) return { hasCustom: false, file: null, mtime: 0, url: '' }

  try {
    const mtime = Math.round(fs.statSync(path.join(BACKGROUNDS_DIR, file)).mtimeMs)
    return {
      hasCustom: true,
      file,
      mtime,
      url: `/backgrounds/${encodeURIComponent(file)}?v=${mtime}`
    }
  } catch {
    return { hasCustom: false, file: null, mtime: 0, url: '' }
  }
}

// 读设置
router.get('/settings', (req, res) => {
  let data = {
    activeGameId: '',
    theme: 'light',
    viewMode: 'table',
    background: 'default',
    modColumns: [],
    minimizeToTray: false,
    nexusApiKey: ''
  }
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      data = { ...data, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) }
    } catch (e) {
      console.warn(`[settings.js] settings.json 解析失败，按默认配置返回：${e.message}`)
    }
  }

  const bg = bgState()
  res.json({
    ...data,
    defaultBgUrl: '/backgrounds/【哲风壁纸】AI-AI生成.png',
    customBgUrl: bg.url,
    hasCustom: bg.hasCustom
  })
})

// 存设置
router.post('/settings', (req, res) => {
  const body = req.body || {}

  // 剥离 modColumns 里的 label
  if (Array.isArray(body.modColumns)) {
    body.modColumns = body.modColumns.map(({ key, width }) => ({ key, width }))
  }

  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(body, null, 2))
  res.json({ success: true })
})

// 换背景（写文件系统，删不掉）
router.post('/background/custom', (req, res) => {
  const { image } = req.body || {}
  if (!image || !fs.existsSync(image)) {
    return res.status(400).json({ success: false, message: '图片不存在' })
  }

  const ext = path.extname(image).toLowerCase()
  if (!ext) {
    return res.status(400).json({ success: false, message: '无法识别图片格式' })
  }

  fs.mkdirSync(BACKGROUNDS_DIR, { recursive: true })
  const old = fs.readdirSync(BACKGROUNDS_DIR).find(f => f.toLowerCase().startsWith("custom."))
  if (old) fs.unlinkSync(path.join(BACKGROUNDS_DIR, old))

  fs.copyFileSync(image, path.join(BACKGROUNDS_DIR, `custom${ext}`))
  const bg = bgState()
  res.json({ success: true, customBgUrl: bg.url, hasCustom: bg.hasCustom })
})

// 删背景
router.delete('/background/custom', (req, res) => {
  try {
    const old = fs.readdirSync(BACKGROUNDS_DIR).find(f => f.toLowerCase().startsWith("custom."))
    if (old) fs.unlinkSync(path.join(BACKGROUNDS_DIR, old))
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message })
  }
  res.json({ success: true, customBgUrl: '', hasCustom: false })
})

// 关于页
router.get('/app-info', (req, res) => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'package.json'), 'utf-8'))
    res.json({
      name: pkg.name || '',
      version: pkg.version || '',
      author: pkg.author || '',
      description: pkg.description || ''
    })
  } catch (e) {
    console.warn(`[app-info] 读取 package.json 失败：${e.message}`)
    res.json({ name: '', version: '', author: '', description: '' })
  }
})

export default router