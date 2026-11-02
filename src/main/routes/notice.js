import express from 'express'
import { NOTICES } from '../config/notices.js'
import { readJson, writeJson } from '../stores/file.js'
import { NOTICE_STATE_FILE } from '../stores/paths.js'

const router = express.Router()

const readStates = () => {
  try {
    const data = readJson(NOTICE_STATE_FILE, [])
    return Array.isArray(data) ? data : []
  } catch (e) {
    console.warn(`[notice] 已读状态读取失败：${e.message}`)
    return []
  }
}

router.get('/notices', (req, res) => {
  const states = new Map(readStates().map((item) => [Number(item.id), item]))
  res.json({
    notices: NOTICES.map((notice) => {
      const state = states.get(notice.id)
      return { ...notice, read: state?.read === true, readAt: state?.readAt || null }
    })
  })
})

router.post('/notices', (req, res) => {
  const incoming = Array.isArray(req.body) ? req.body : []
  const known = new Set(NOTICES.map((notice) => notice.id))
  const states = new Map(readStates().map((item) => [Number(item.id), item]))

  for (const item of incoming) {
    const id = Number(item?.id)
    if (!known.has(id)) continue
    states.set(id, { id, read: item?.read === true, readAt: item?.readAt || null })
  }

  writeJson(
    NOTICE_STATE_FILE,
    [...states.values()].sort((a, b) => a.id - b.id)
  )
  res.json({ success: true })
})

export default router
