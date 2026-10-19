import fs from 'fs'
import path from 'path'

// 下载文件的命名规则。纯函数 + 只依赖 fs/path，不碰 electron，方便单独验证。
//
// 实测 N 网的 download_link 接口偶尔把 name 填成
// 「Nexus Global Content Delivery Network」这种没有后缀的占位串，
// 直接拿来当文件名会建出一个没有扩展名的怪文件。
//
// 优先级：接口 name（可信时）→ 直链 URL 的 pathname 末段 → 响应头 content-disposition → 兜底

// 能不能直接拿来当文件名：必须有合法扩展名，且不是 CDN 占位串
export const isUsableFileName = (name) => {
  const base = String(name || '').trim()
  if (!base) return false
  if (/nexus/i.test(base)) return false
  const ext = path.extname(base)
  return Boolean(ext) && /^\.[A-Za-z0-9]{1,8}$/.test(ext)
}

// 直链最后一段通常就是带后缀的原始文件名（可能被 URL 编码）
export const fileNameFromUrl = (rawUrl) => {
  try {
    const url = new URL(rawUrl)
    const segments = url.pathname.split('/').filter(Boolean)
    if (!segments.length) return ''
    const last = decodeURIComponent(segments[segments.length - 1])
    return isUsableFileName(last) ? last : ''
  } catch {
    return ''
  }
}

// content-disposition 两种写法都要认：
//   filename*=UTF-8''%E4%B8%AD%E6%96%87.zip
//   filename="Something.zip"
export const fileNameFromContentDisposition = (header) => {
  if (!header) return ''

  const star = /filename\*\s*=\s*([^;]+)/i.exec(header)
  if (star) {
    const raw = star[1].trim().replace(/^["']|["']$/g, '')
    const encoded = raw.includes("''") ? raw.slice(raw.indexOf("''") + 2) : raw
    try {
      const decoded = decodeURIComponent(encoded)
      if (isUsableFileName(decoded)) return decoded
    } catch {
      // 编码坏了就继续试不带星号的写法
    }
  }

  const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(header)
  if (plain) {
    const raw = (plain[1] || plain[2] || '').trim()
    try {
      const decoded = decodeURIComponent(raw)
      if (isUsableFileName(decoded)) return decoded
    } catch {
      if (isUsableFileName(raw)) return raw
    }
  }

  return ''
}

// Windows 不允许的字符、控制字符、结尾的点和空格都要处理掉
export const sanitizeFileName = (raw) => {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[<>:"/\\|?*]/g, '_')
    // 控制字符（0x00-0x1f）按码点过滤：写进正则字面量会触发 no-control-regex
    .split('')
    .filter((ch) => ch.charCodeAt(0) >= 32)
    .join('')

  let base = cleaned.replace(/[. ]+$/, '').trim()
  if (!base) base = 'mod-download.bin'

  // 路径过长容易在 Windows 上翻车，截断时保留扩展名
  if (base.length > 180) {
    const ext = path.extname(base)
    base = base.slice(0, Math.max(1, 180 - ext.length)) + ext
  }
  return base
}

// 同名不覆盖，后缀 (1) (2) 递增
export const uniquePath = (dir, fileName) => {
  const ext = path.extname(fileName)
  const stem = fileName.slice(0, fileName.length - ext.length)
  let candidate = path.join(dir, fileName)
  let i = 1
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${stem} (${i})${ext}`)
    i += 1
  }
  return candidate
}

/**
 * 决定任务的初始文件名。
 * @returns {{ name: string, needsHeader: boolean, fallbackName: string }}
 *   needsHeader 为 true 表示只定到了兜底名，等响应头里的 content-disposition 再纠正
 */
export const resolveInitialFileName = ({ apiName, url, modName, modId, fileId }) => {
  const fallbackName = `${modName}-${modId}-${fileId}.zip`
  const fromApi = isUsableFileName(apiName) ? apiName : ''
  const fromUrl = fromApi ? '' : fileNameFromUrl(url)
  const resolved = fromApi || fromUrl

  return {
    name: sanitizeFileName(resolved || fallbackName),
    needsHeader: !resolved,
    fallbackName
  }
}
