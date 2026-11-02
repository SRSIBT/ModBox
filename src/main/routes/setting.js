import fs from 'fs'
import path from 'path'
import express from 'express'
import { APP_ROOT } from '../stores/paths.js'
import {
  getBackgroundState,
  readSettings,
  removeCustomBackground,
  saveSettings,
  setCustomBackground
} from '../stores/setting.js'

const router = express.Router()

router.get('/settings', (req, res) => {
  const bg = getBackgroundState()
  res.json({
    ...readSettings(),
    defaultBgUrl: '/builtin-bg/default.jpg',
    customBgUrl: bg.url,
    hasCustom: bg.hasCustom
  })
})

router.post('/settings', (req, res) => {
  res.json({ success: true, settings: saveSettings(req.body || {}) })
})

router.post('/background/custom', (req, res) => {
  try {
    const bg = setCustomBackground(req.body?.image)
    res.json({ success: true, customBgUrl: bg.url, hasCustom: bg.hasCustom })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
})

router.delete('/background/custom', (req, res) => {
  try {
    const bg = removeCustomBackground()
    res.json({ success: true, customBgUrl: bg.url, hasCustom: bg.hasCustom })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

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
