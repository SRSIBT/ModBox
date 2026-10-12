import express from 'express'
import fs from 'fs'
import { NOTICES_FILE } from '../utils/paths.js'

const router = express.Router()

// 获取公告
router.get('/notices', (req, res) => {
  const data = fs.readFileSync(NOTICES_FILE, 'utf-8')
  res.json({ notices: JSON.parse(data) })
})

export default router