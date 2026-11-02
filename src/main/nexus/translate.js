import { ipcMain, net } from 'electron'
import { createHash } from 'crypto'

// ============================================================
// 翻译服务
//
// Edge：https://edge.microsoft.com/translate/translatetext
//   - POST JSON 字符串数组，例如 ["Hello world"]
//   - ?to=zh-Hans，不传 from 时自动识别源语言
//   - 返回 [{ detectedLanguage, translations: [{ text, to }] }]
// 这就是 Edge 浏览器「翻译此页」背后的接口，不需要 token。
//
// Google：gtx 公开接口，作为 Edge 被限流/不可用时的降级。
//
// 两个都是非官方 Web 接口，没有 SLA；缓存、队列、熔断、降级都要有。
// ============================================================

const EDGE_URL = 'https://edge.microsoft.com/translate/translatetext'
const GOOGLE_URL = 'https://translate.googleapis.com/translate_a/single'

// 1.3.0 里用的就是这个 UA；微软的 Web 入口会按 Edge 放行
const EDGE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0'

const MAX_CACHE = 4000
const MAX_TEXT = 20000
const CHUNK_SIZE = 1800
const MAX_BATCH_ITEMS = 40
const MAX_BATCH_CHARS = 6000
const CONCURRENCY = 2
const REQUEST_GAP_MS = 140

const cache = new Map()
const downUntil = { edge: 0, google: 0 }

let active = 0
let pumping = false
const pending = []

const sha1 = (value) => createHash('sha1').update(value).digest('hex')

const isDown = (provider) => Date.now() < downUntil[provider]

const markDown = (provider, ms) => {
  downUntil[provider] = Date.now() + ms
}

const markUp = (provider) => {
  downUntil[provider] = 0
}

const shouldTrip = (error) => {
  const status = Number(error?.status) || 0
  return status === 0 || status === 401 || status === 403 || status === 429 || status >= 500
}

const tripMs = (error) => {
  const status = Number(error?.status) || 0
  return status === 401 || status === 403 || status === 429 ? 10 * 60 * 1000 : 60 * 1000
}

const cacheKey = (provider, targetLang, text) => `${provider}|${targetLang}|${sha1(text)}`

const cacheSet = (key, value) => {
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, value)
}

// 只让 2 个请求同时飞，避免一次整页翻译把接口打爆
const enqueue = (task) =>
  new Promise((resolve, reject) => {
    pending.push({ task, resolve, reject })
    pump()
  })

const pump = () => {
  if (pumping) return
  pumping = true
  try {
    while (active < CONCURRENCY && pending.length > 0) {
      const job = pending.shift()
      active += 1
      Promise.resolve()
        .then(job.task)
        .then(job.resolve, job.reject)
        .finally(() => {
          active -= 1
          setTimeout(pump, REQUEST_GAP_MS)
        })
    }
  } finally {
    pumping = false
  }
}

const normalizeTarget = (provider, targetLang) => {
  const lang = String(targetLang || '').trim() || 'zh-Hans'
  if (provider === 'google') return lang.toLowerCase() === 'zh-hans' ? 'zh-CN' : lang
  return lang.toLowerCase() === 'zh-cn' ? 'zh-Hans' : lang
}

const splitText = (text, max = CHUNK_SIZE) => {
  const value = String(text || '')
  if (value.length <= max) return [value]

  const chunks = []
  let rest = value

  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max)
    if (cut < max * 0.4) cut = rest.lastIndexOf('。', max)
    if (cut < max * 0.4) cut = rest.lastIndexOf('. ', max)
    if (cut < max * 0.4) cut = rest.lastIndexOf(' ', max)
    if (cut < max * 0.3) cut = max
    chunks.push(rest.slice(0, cut + 1))
    rest = rest.slice(cut + 1)
  }

  if (rest) chunks.push(rest)
  return chunks
}

const httpText = async (url, options = {}, timeout = 25000) => {
  const response = await net.fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeout)
  })
  const text = await response.text()
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`)
    error.status = response.status
    throw error
  }
  return text
}

// 一次把多段文本交给 Edge；返回顺序和入参一致
const translateEdgeTexts = async (texts, targetLang) => {
  if (texts.length === 0) return []

  const url = new URL(EDGE_URL)
  url.searchParams.set('to', targetLang)

  const raw = await httpText(
    url.toString(),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': EDGE_UA,
        Accept: '*/*'
      },
      body: JSON.stringify(texts)
    },
    30000
  )

  const data = JSON.parse(raw)
  if (!Array.isArray(data) || data.length !== texts.length) {
    throw new Error('Edge 翻译返回数量不匹配')
  }

  return data.map((item, index) => item?.translations?.[0]?.text || texts[index])
}

/**
 * 把若干条文本拆成长度合适的片段，合并成尽量少的 Edge 请求，
 * 再按原顺序拼回每条文本。
 */
const translateEdgeMany = async (texts, targetLang) => {
  const prepared = texts.map((text) => ({ text, chunks: splitText(text) }))
  const flat = []

  prepared.forEach((item, index) => {
    item.chunks.forEach((chunk, chunkIndex) => {
      flat.push({ text: chunk, index, chunkIndex })
    })
  })

  const groups = []
  let current = []
  let chars = 0

  for (const item of flat) {
    if (
      current.length >= MAX_BATCH_ITEMS ||
      (current.length > 0 && chars + item.text.length > MAX_BATCH_CHARS)
    ) {
      groups.push(current)
      current = []
      chars = 0
    }
    current.push(item)
    chars += item.text.length
  }
  if (current.length > 0) groups.push(current)

  const translated = new Map()

  for (const group of groups) {
    const payload = group.map((item) => item.text)
    const output = await translateEdgeTexts(payload, targetLang)
    group.forEach((item, index) => {
      translated.set(`${item.index}:${item.chunkIndex}`, output[index] || item.text)
    })
  }

  return prepared.map((item, index) =>
    item.chunks.map((_, chunkIndex) => translated.get(`${index}:${chunkIndex}`) || '').join('')
  )
}

const translateEdge = async (text, targetLang) => {
  const [translated] = await translateEdgeMany([text], targetLang)
  if (!translated) throw new Error('Edge 翻译没有返回译文')
  return translated
}

const translateGoogle = async (text, targetLang) => {
  const url = new URL(GOOGLE_URL)
  url.searchParams.set('client', 'gtx')
  url.searchParams.set('sl', 'auto')
  url.searchParams.set('tl', targetLang)
  url.searchParams.set('dt', 't')
  url.searchParams.set('q', text)

  const raw = await httpText(url.toString(), {
    headers: {
      'User-Agent': EDGE_UA,
      Accept: '*/*'
    }
  })

  const data = JSON.parse(raw)
  const parts = Array.isArray(data?.[0]) ? data[0] : []
  const out = parts.map((part) => part?.[0] || '').join('')
  if (!out) throw new Error('Google 翻译没有返回译文')
  return out
}

const providers = {
  edge: translateEdge,
  google: translateGoogle
}

const providerChain = (provider) =>
  provider === 'google' ? ['google', 'edge'] : ['edge', 'google']

/**
 * 翻译单段文本。
 * 返回译文；所有 provider 都失败时抛错，由调用方决定是否显示原文。
 */
async function translateText(options = {}) {
  const provider = options.provider === 'google' ? 'google' : 'edge'
  const text = String(options.text ?? '')
    .replace(/\r\n/g, '\n')
    .slice(0, MAX_TEXT)
    .trim()

  if (!text) return ''

  const targetLang = normalizeTarget(provider, options.targetLang)
  const key = cacheKey(provider, targetLang, text)
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  let lastError = null

  for (const name of providerChain(provider)) {
    if (isDown(name)) continue

    try {
      const translated = await enqueue(() =>
        providers[name](text, normalizeTarget(name, targetLang))
      )
      cacheSet(key, translated)
      markUp(name)
      return translated
    } catch (error) {
      lastError = error
      if (shouldTrip(error)) markDown(name, tripMs(error))
      console.warn(`[translate] ${name} 失败：${error?.message || error}`)
    }
  }

  throw lastError || new Error('翻译服务暂不可用')
}

/**
 * 批量翻译。顺序和入参一一对应；单条失败回落原文，不抛整批错误。
 *
 * Edge 支持一次提交一个字符串数组，所以这里是「一次请求翻一批」，
 * 比逐条调用快很多；失败再按条降级。
 */
async function translateBatch(options = {}) {
  const list = Array.isArray(options.texts) ? options.texts.slice(0, 80) : []
  if (list.length === 0) return []

  const provider = options.provider === 'google' ? 'google' : 'edge'
  const targetLang = normalizeTarget(provider, options.targetLang)
  const normalized = list.map((item) => String(item ?? '').slice(0, MAX_TEXT))
  const unique = [...new Set(normalized)]
  const result = new Map()

  const pendingTexts = []

  for (const text of unique) {
    if (!text.trim()) {
      result.set(text, text)
      continue
    }

    const key = cacheKey(provider, targetLang, text)
    const cached = cache.get(key)
    if (cached !== undefined) {
      result.set(text, cached)
      continue
    }

    pendingTexts.push(text)
  }

  // Edge 快路径：一次请求翻完这一批
  if (provider === 'edge' && !isDown('edge') && pendingTexts.length > 0) {
    try {
      const translations = await enqueue(() => translateEdgeMany(pendingTexts, targetLang))
      pendingTexts.forEach((text, index) => {
        const translated = translations[index] || text
        result.set(text, translated)
        cacheSet(cacheKey(provider, targetLang, text), translated)
      })
      markUp('edge')
    } catch (error) {
      if (shouldTrip(error)) markDown('edge', tripMs(error))
      console.warn(`[translate] edge 批量失败：${error?.message || error}`)
    }
  }

  // 剩下的逐条走 provider 链（Edge 失败时会自动降级到 Google）
  await Promise.all(
    pendingTexts
      .filter((text) => !result.has(text))
      .map(async (text) => {
        try {
          result.set(text, await translateText({ text, provider, targetLang }))
        } catch {
          result.set(text, text)
        }
      })
  )

  return normalized.map((text) => result.get(text) ?? text)
}

let registered = false

export function registerTranslateIpc() {
  if (registered) return
  registered = true

  ipcMain.handle('translate:batch', (_event, options) => translateBatch(options))
}
