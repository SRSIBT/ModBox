import express from 'express'
import cors from 'cors'
import path from 'path'
import modsRouter from './routes/mod.js'
import gamesRouter from './routes/game.js'
import dialogRouter from './routes/dialog.js'
import noticesRouter from './routes/notice.js'
import settingsRouter from './routes/setting.js'
import { REPO_DIR, DATA_DIR } from './utils/paths.js'


const app = express()
app.use(cors())
app.use(express.json())
app.use('/covers', express.static(REPO_DIR))
app.use('/backgrounds', express.static(path.join(DATA_DIR, 'backgrounds')))


app.use('/api', gamesRouter)
app.use('/api', modsRouter)
app.use('/api', noticesRouter)
app.use('/api', settingsRouter)
app.use('/api', dialogRouter)


export function startServer() {
  app.listen(3000, () => {
    console.log('Express start: http://localhost:3000')
  })
}