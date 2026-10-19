import express from 'express'
import cors from 'cors'
import fs from 'fs'
import modsRouter from './routes/mod.js'
import gamesRouter from './routes/game.js'
import dialogRouter from './routes/dialog.js'
import noticesRouter from './routes/notice.js'
import settingsRouter from './routes/setting.js'
import nexusRouter from './routes/nexus.js'
import { DATA_DIR, REPO_DIR, BACKGROUNDS_DIR } from './utils/paths.js'

const app = express()
app.use(cors())
app.use(express.json())
app.use('/covers', express.static(REPO_DIR))
app.use('/backgrounds', express.static(BACKGROUNDS_DIR))

app.use('/api', gamesRouter)
app.use('/api', modsRouter)
app.use('/api', noticesRouter)
app.use('/api', settingsRouter)
app.use('/api', dialogRouter)
app.use('/api', nexusRouter)

export function startServer() {
  // 空 data/ 下要先建目录，否则壁纸与设置写不进去
  fs.mkdirSync(DATA_DIR, { recursive: true })

  app.listen(3000, () => {
    console.log('Express start: http://localhost:3000')
  })
}
