import express from 'express'
import { getGamePath } from 'steam-game-path'

const router = express.Router()

router.get('/game/steam-path', (req, res) => {
  const { appId } = req.query
  if (!appId) return res.json({ success: false, error: '缺少 appId' })

  try {
    const result = getGamePath(Number(appId))
    if (result.success) {
      return res.json({ success: true, path: result.game.path })
    }
    const reasons = {
      'steam-not-found': '未找到 Steam 安装目录',
      'game-not-found': 'Steam 库中未安装该游戏',
      'install-directory-missing': '游戏安装目录不存在（可能已卸载）',
      'unsupported-platform': '当前系统不支持自动检测'
    }
    return res.json({
      success: false,
      error: reasons[result.reason] || result.reason || '未找到游戏路径'
    })
  } catch (e) {
    return res.json({ success: false, error: e.message })
  }
})

export default router