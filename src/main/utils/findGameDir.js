import fs from 'fs'
import path from 'path'
import { REPO_DIR } from './paths.js'

export const findGameDir = (gameName) => {
  if (!fs.existsSync(REPO_DIR)) return null
  const dirs = fs.readdirSync(REPO_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
  for (const d of dirs) {
    const gameFile = path.join(REPO_DIR, d.name, 'game.json')
    if (fs.existsSync(gameFile)) {
      const game = JSON.parse(fs.readFileSync(gameFile, 'utf-8'))
      if (game.name === gameName) return d.name
    }
  }
  return null
}