import express from 'express'
import { dialog } from 'electron'

const router = express.Router()

// 获取单个文件夹路径
router.get('/dialog/folder', async (req, res) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  res.json({ path: result.filePaths[0] || '' })
})

// 获取多个文件夹路径
router.get('/dialog/folders', async (req, res) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'multiSelections']
  })
  res.json({ paths: result.filePaths })
})

// 获取 .exe/img 文件
router.get('/dialog/file', async (req, res) => {
  const { type } = req.query

  const filters = type === 'image'
    ? [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }]
    : [{ name: '可执行文件', extensions: ['exe'] }]

  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters
  })
  res.json({ path: result.filePaths[0] || '' })
})

export default router