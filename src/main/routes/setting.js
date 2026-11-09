import fs from 'fs'
import path from 'path'
import express from 'express'
import { APP_ROOT } from '../stores/paths.js'
import { readSettings, saveSettings, getBackground, setBackground, removeBackground } from '../stores/setting.js'

const router = express.Router()

// 获取设置
router.get('/settings', (req, res) => {
  const bg = getBackground()
  res.json({
    ...readSettings(),
    defaultBgUrl: '/builtin-bg/default.jpg',
    customBgUrl: bg.url,
    hasCustom: bg.hasCustom
  })
})

// 保存设置
router.post('/settings', (req, res) => {
  res.json({ success: true, settings: saveSettings(req.body || {}) })
})

// 保存用户背景
router.post('/background/custom', (req, res) => {
  try {
    const bg = setBackground(req.body?.image)
    res.json({ success: true, customBgUrl: bg.url, hasCustom: bg.hasCustom })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
})

// 删除用户背景
router.delete('/background/custom', (req, res) => {
  try {
    const bg = removeBackground()
    res.json({ success: true, customBgUrl: bg.url, hasCustom: bg.hasCustom })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// 获取软件信息
router.get('/app-info', (req, res) => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'package.json'), 'utf-8'))
    res.json({
      name: pkg.name || '',
      version: pkg.version || '',
      author: pkg.author || '',
      description: pkg.description || ''
    })
  } catch {
    res.json({ name: '', version: '', author: '', description: '' })
  }
})

export default router
