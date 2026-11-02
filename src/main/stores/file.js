import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

// 写 JSON 先写临时文件再改名，避免写一半留下坏文件
export const writeFileAtomic = (file, data, options = {}) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
  )

  try {
    fs.writeFileSync(tmp, data, options)
    fs.renameSync(tmp, file)
  } finally {
    try {
      fs.rmSync(tmp, { force: true })
    } catch {
      /* 已经改名成功 */
    }
  }
}

// 坏文件只备份一次，后缀用原文件的修改时间
export const backupCorruptFile = (file) => {
  if (!fs.existsSync(file)) return ''
  try {
    const stamp = new Date(fs.statSync(file).mtimeMs).toISOString().replace(/[:.]/g, '-')
    const backup = `${file}.corrupt-${stamp}`
    if (!fs.existsSync(backup)) fs.copyFileSync(file, backup)
    return backup
  } catch (e) {
    console.warn(`[file] 备份失败：${e.message}`)
    return ''
  }
}

export const readJson = (file, fallback = null) => {
  if (!fs.existsSync(file)) return fallback
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8').replace(/^\uFEFF/, ''))
  } catch (e) {
    const backup = backupCorruptFile(file)
    throw new Error(
      `${path.basename(file)} 解析失败：${e.message}` + (backup ? `（已备份到 ${backup}）` : '')
    )
  }
}

export const writeJson = (file, data, options) => {
  writeFileAtomic(file, JSON.stringify(data, null, 2), options)
}

// target 是否在 root 里面
export const isInside = (root, target) => {
  const rel = path.relative(root, target)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

// 清掉 Windows 文件名里不能用的字符，并限制长度
export const sanitizeFileName = (raw) => {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[<>:"/\\|?*]/g, '_')
    .split('')
    .filter((ch) => ch.charCodeAt(0) >= 32)
    .join('')

  let base = cleaned.replace(/[. ]+$/, '').trim()
  if (!base) base = 'mod-download.bin'
  if (base.length > 180) {
    const ext = path.extname(base)
    base = base.slice(0, Math.max(1, 180 - ext.length)) + ext
  }
  return base
}
