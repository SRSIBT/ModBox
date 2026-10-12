import express from 'express'
import fs from 'fs'
import { SETTINGS_FILE } from '../utils/paths.js'

const router = express.Router()

// 获取软件设置
router.get('/settings', (req, res) => {
  if (!fs.existsSync(SETTINGS_FILE)) {
    return res.json({ activeGame: '', theme: 'light', modColumns: [] })
  }
  const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'))
  res.json(data)
})

// 修改软件设置
router.post('/settings', (req, res) => {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(req.body, null, 2))
  res.json({ success: true })
})

export default router