// nxm:// 链接解析。纯函数，不碰网络也不碰文件，方便单独验证。
//
// 形如：
//   nxm://blackmythwukong/mods/1535/files/12345?key=xxx&expires=1750000000&user_id=123
//
// 两个容易踩的点：
//   1. expires 是 Unix **秒**级时间戳，不是毫秒，比较前别乘 1000 弄反
//   2. 域名在 host 段，不是 path 的第一段

const POSITIVE_INT = /^\d+$/

// 只认纯数字。"12abc" 这类 parseInt 会得到 12，必须提前挡掉
const toPositiveInt = (value) => {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!POSITIVE_INT.test(text)) return null
  const n = Number(text)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

/**
 * @returns {null | {
 *   domain: string, modId: number, fileId: number,
 *   authorization: null | { key: string, expires: number, userId: number | null }
 * }}
 */
export function parseNxmUrl(raw) {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  // 正常链接不到 200 字符，给足余量但挡掉明显异常的输入
  if (!trimmed || trimmed.length > 8192) return null

  let url
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol.toLowerCase() !== 'nxm:') return null

  const domain = String(url.hostname || '').toLowerCase()
  if (!domain) return null

  const segments = url.pathname.split('/').filter(Boolean)
  const modsIndex = segments.findIndex((s) => s.toLowerCase() === 'mods')
  if (modsIndex < 0 || modsIndex + 1 >= segments.length) return null

  const modId = toPositiveInt(segments[modsIndex + 1])
  if (!modId) return null

  // 文件 id 通常在 /files/<id>，少数链接放在 ?file_id=
  let fileId = null
  if (segments[modsIndex + 2]?.toLowerCase() === 'files') {
    fileId = toPositiveInt(segments[modsIndex + 3] || '')
  }
  if (!fileId) fileId = toPositiveInt(url.searchParams.get('file_id') || '')

  const key = String(url.searchParams.get('key') || '').trim()
  const expires = toPositiveInt(String(url.searchParams.get('expires') || ''))

  // 缺 key 或 expires 时不算解析失败：链接本身可能是手搓的，
  // 但要能区分出「没有授权」和「链接坏了」，提示文案不一样
  const authorization =
    key && key.length <= 2048 && expires
      ? {
          key,
          expires,
          userId: toPositiveInt(String(url.searchParams.get('user_id') || ''))
        }
      : null

  return { domain, modId, fileId: fileId || null, authorization }
}

export const isAuthorizationExpired = (
  authorization,
  nowSeconds = Math.floor(Date.now() / 1000)
) => {
  if (!authorization || !authorization.expires) return true
  return authorization.expires <= nowSeconds
}

// 从命令行参数里捞 nxm 链接。
// 打包态 argv 是 [exe, url]，开发态是 [exe, 主进程脚本, url]，所以不写死下标，扫一遍最稳。
export const findNxmArg = (argv) => {
  if (!Array.isArray(argv)) return null
  for (const arg of argv) {
    if (typeof arg !== 'string') continue
    const text = arg.trim().replace(/^"|"$/g, '')
    if (/^nxm:\/\//i.test(text)) return text
  }
  return null
}
