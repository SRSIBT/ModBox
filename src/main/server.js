import express from 'express'
import fs from 'fs'
import steamRouter from './routes/steam.js'
import modsRouter from './routes/mod.js'
import gamesRouter from './routes/game.js'
import dialogRouter from './routes/dialog.js'
import noticesRouter from './routes/notice.js'
import settingsRouter from './routes/setting.js'
import { readSettings } from './stores/setting.js'
import { BACKGROUNDS_DIR, BUILTIN_BACKGROUNDS_DIR, BUILTIN_COVERS_DIR, DATA_DIR, REPO_DIR } from './stores/paths.js'

const app = express()
app.use(express.json())
app.use('/covers', express.static(REPO_DIR))
app.use('/backgrounds', express.static(BACKGROUNDS_DIR))

// 内置游戏封面和默认背景
app.use('/builtin-covers', express.static(BUILTIN_COVERS_DIR))
app.use('/builtin-bg', express.static(BUILTIN_BACKGROUNDS_DIR))

app.use('/api', gamesRouter)
app.use('/api', modsRouter)
app.use('/api', noticesRouter)
app.use('/api', settingsRouter)
app.use('/api', dialogRouter)
app.use('/api', steamRouter)

export function startServer() {
  // 启动时补齐数据目录，并确保 settings.json 存在
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.mkdirSync(REPO_DIR, { recursive: true })
  fs.mkdirSync(BACKGROUNDS_DIR, { recursive: true })

  readSettings()

  app.listen(3000, () => {
    console.log('Express start: http://localhost:3000')
  })
}
