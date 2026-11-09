import express from 'express'
import { dialog } from 'electron'
import { readSettings, saveSettings } from '../stores/setting.js'

const router = express.Router()

// 取上次记住的位置；文件路径下次打开会退到其父目录，目录路径直接打开
const lastPath = () => readSettings().lastDialogPath || undefined

// 选完后记住路径
const remember = (p) => {
  if (p) saveSettings({ lastDialogPath: p })
}

// 获取单个文件夹路径（游戏根目录等）
router.get('/dialog/folder', async (req, res) => {
  const result = await dialog.showOpenDialog({
    defaultPath: lastPath(),
    properties: ['openDirectory']
  })
  const path = result.filePaths[0] || ''
  remember(path)
  res.json({ path })
})

// 获取单个文件夹路径（内联拖拽区点击导入用）
router.get('/dialog/folders', async (req, res) => {
  const result = await dialog.showOpenDialog({
    defaultPath: lastPath(),
    properties: ['openDirectory']
  })
  const paths = result.filePaths.slice(0, 1)
  remember(paths[0])
  res.json({ paths })
})

// 获取 .exe / img 文件
router.get('/dialog/file', async (req, res) => {
  const { type } = req.query

  const filters =
    type === 'image'
      ? [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }]
      : [{ name: '可执行文件', extensions: ['exe'] }]

  const result = await dialog.showOpenDialog({
    defaultPath: lastPath(),
    properties: ['openFile'],
    filters
  })
  const path = result.filePaths[0] || ''
  remember(path)
  res.json({ path })
})

export default router