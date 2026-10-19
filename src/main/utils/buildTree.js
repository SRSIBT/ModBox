import fs from 'fs'
import path from 'path'

export const buildTree = (dir) => {
  const items = fs.readdirSync(dir, { withFileTypes: true })
  items.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1
    if (!a.isDirectory() && b.isDirectory()) return 1
    return a.name.localeCompare(b.name)
  })

  return items.map((f) => {
    const full = path.join(dir, f.name)
    if (f.isDirectory()) {
      return { name: f.name, isDir: true, open: false, children: buildTree(full) }
    }
    const stat = fs.statSync(full)
    return { name: f.name, isDir: false, size: stat.size }
  })
}
