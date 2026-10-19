import express from 'express'
import fs from 'fs'
import { NOTICES_FILE } from '../utils/paths.js'

const router = express.Router()

// 获取公告
router.get('/notices', (req, res) => {
  res.json({ notices: readNotices() })
})

// 保存已读状态
router.post('/notices', (req, res) => {
  const incoming = Array.isArray(req.body) ? req.body : []

  const merged = readNotices().map((notice) => {
    const patch = incoming.find((n) => n.id === notice.id)
    if (!patch) return notice
    return {
      ...notice,
      read: !!patch.read,
      readAt: patch.readAt || null
    }
  })

  fs.writeFileSync(NOTICES_FILE, JSON.stringify(merged, null, 2))
  res.json({ success: true })
})

// 读取公告；文件缺失或损坏时返回空列表，不让接口崩
const readNotices = () => {
  if (!fs.existsSync(NOTICES_FILE)) return []
  try {
    const data = JSON.parse(fs.readFileSync(NOTICES_FILE, 'utf-8'))
    return Array.isArray(data) ? data : []
  } catch (e) {
    console.warn(`[notices] notices.json 解析失败，按空列表处理：${e.message}`)
    return []
  }
}

export default router
