import express from 'express'
import fs from 'fs'
import path from 'path'
import { net } from 'electron'
import { DATA_DIR, REPO_DIR, SETTINGS_FILE } from '../utils/paths.js'

// ============================================================
// N 网数据源（第一版）
// - 列表 / 翻页 / 名称搜索：GraphQL 一条查询（只有它支持 count + offset）
// - 模组 ID 搜索：REST v1 单条接口
// - 没有缓存、没有重试、没有排序映射表，出错就把原因原样交给前端弹红字
// ============================================================

const router = express.Router()

const FAVORITES_FILE = path.join(DATA_DIR, 'favorites.json')
const GQL_URL = 'https://api.nexusmods.com/v2/graphql'
const REST_URL = 'https://api.nexusmods.com/v1'
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

// ============================================================
// 游戏 id / game.json（与 gameRepo 同规则，内联保持本文件独立）
// ============================================================

const hasControlChar = (s) => [...s].some((ch) => ch.charCodeAt(0) < 32)

const isValidGameId = (id) => {
  if (typeof id !== 'string') return false
  if (!id || id !== id.trim()) return false
  if (id === '.' || id === '..') return false
  if (/[\\/]/.test(id)) return false
  if (/[<>:"|?*]/.test(id)) return false
  if (hasControlChar(id)) return false
  if (/[. ]$/.test(id)) return false
  return path.basename(id) === id
}

const gameFile = (id) => path.join(REPO_DIR, id, 'game.json')

const readGame = (id) => {
  if (!isValidGameId(id) || !fs.existsSync(gameFile(id))) return null
  try {
    return JSON.parse(fs.readFileSync(gameFile(id), 'utf-8'))
  } catch (e) {
    console.warn(`[nexus] ${id}/game.json 解析失败：${e.message}`)
    return null
  }
}

// game.json 里可以显式写 nexusDomain；没写就退回目录名小写
const gameDomain = (gameId) => {
  const game = readGame(gameId)
  return String(game?.nexusDomain || gameId || '').toLowerCase()
}

// ============================================================
// 设置 / 收藏（收藏只存 modId 数组）
// ============================================================

const readJson = (file, fallback) => {
  if (!fs.existsSync(file)) return fallback
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) || fallback
  } catch (e) {
    console.warn(`[nexus] ${path.basename(file)} 解析失败：${e.message}`)
    return fallback
  }
}

const toInt = (value, fallback) => {
  const n = parseInt(value, 10)
  return Number.isFinite(n) ? n : fallback
}

const clamp = (n, min, max) => Math.min(Math.max(n, min), max)

const apiKey = () => String(readJson(SETTINGS_FILE, {}).nexusApiKey || '').trim()

const favoritesOf = (gameId) => {
  const raw = readJson(FAVORITES_FILE, {})[gameId]
  if (!Array.isArray(raw)) return []
  // 兼容两种历史结构：[1533] 和 [{ modId: 1533 }]
  return raw.map((item) => toInt(typeof item === 'object' ? item?.modId : item, 0)).filter(Boolean)
}

const writeFavorites = (data) => {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(FAVORITES_FILE, JSON.stringify(data, null, 2))
}

// ============================================================
// 出网
// ============================================================

const headers = () => ({
  apikey: apiKey(),
  'Application-Name': 'ModBox',
  'Application-Version': '1.0.0'
})

const httpError = (status, code, message) => Object.assign(new Error(message), { status, code })

// 用 Electron 的 net.fetch 而不是 axios：
// 1) 它走 Chromium 网络栈，自动跟随 Windows 系统代理 / PAC（axios 不读系统代理）
// 2) 证书走系统证书库，系统里装过根的代理也能过
const httpJson = async (url, init = {}) => {
  const res = await net.fetch(url, {
    ...init,
    headers: { ...headers(), 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(20000)
  })

  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (!res.ok) throw httpError(res.status, 'UPSTREAM', '')
  return data
}

// 列表查询：只要 offset/count 翻页，外加一个名称过滤
const LIST_QUERY = `
  query Mods($filter: ModsFilter, $sort: [ModsSort!], $count: Int, $offset: Int) {
    mods(filter: $filter, sort: $sort, count: $count, offset: $offset) {
      totalCount
      nodes {
        modId
        name
        summary
        version
        author
        category
        createdAt
        updatedAt
        downloads
        endorsements
        fileSize
        thumbnailUrl
        thumbnailBlurredUrl
        pictureUrl
      }
    }
  }
`

// ⚠️ 这几个名字是照 N 网真实 schema 写的，改之前先确认：
// filter 的过滤字段叫 gameDomainName，值是 [{ op, value }] 数组
// sort 是以「字段名」为键的对象：{ updatedAt: { direction: 'DESC' } }
// （$sort 声明成 [ModsSort!]，单个对象会被 GraphQL 自动包成单元素数组）
const SORT_FIELDS = {
  latest_added: 'createdAt',
  latest_updated: 'updatedAt',
  downloads: 'downloads',
  endorsements: 'endorsements'
}

const buildFilter = (domain, name) => {
  const filter = { gameDomainName: [{ op: 'EQUALS', value: domain }] }
  if (name) filter.name = [{ op: 'WILDCARD', value: `%${name}%` }]
  return filter
}

const buildSort = (sort) => ({
  [SORT_FIELDS[sort] || 'createdAt']: { direction: 'DESC' }
})

const gql = async (query, variables) => {
  const data = await httpJson(GQL_URL, {
    method: 'POST',
    body: JSON.stringify({ query, variables })
  })

  // 把 GraphQL 的原话抛出去，前端红字里能直接看到是哪个字段错了
  if (data?.errors?.length) {
    throw httpError(502, 'GRAPHQL', data.errors.map((e) => e.message).join('；'))
  }
  return data?.data
}

const text = (value) => (typeof value === 'string' ? value : value?.name || '')

// 让渲染层直接连 N 网 CDN 拉图，容易被 Referer / 协议 / 跨域挡住，
// 统一走本机后端代理，前端拿到的永远是 localhost 的地址
const LOCAL_API = 'http://localhost:3000'

const proxyCover = (raw) => {
  if (!raw) return ''
  const url = String(raw).startsWith('//') ? `https:${raw}` : String(raw)
  return `${LOCAL_API}/api/nexus/image?u=${encodeURIComponent(url)}`
}

const mapMod = (mod, domain) => ({
  modId: mod.modId,
  name: mod.name || '',
  summary: mod.summary || '',
  category: text(mod.category),
  author: text(mod.author),
  version: mod.version || '',
  // 缩略图 → 模糊缩略图 → 原图，三档兜底
  cover: proxyCover(mod.thumbnailUrl || mod.thumbnailBlurredUrl || mod.pictureUrl),
  createdAt: mod.createdAt || '',
  updatedAt: mod.updatedAt || '',
  downloads: mod.downloads || 0,
  endorsements: mod.endorsements || 0,
  fileSize: mod.fileSize || 0,
  url: `https://www.nexusmods.com/${domain}/mods/${mod.modId}`
})

const fetchPage = async ({ domain, sort, page, pageSize, name }) => {
  const data = await gql(LIST_QUERY, {
    filter: buildFilter(domain, name),
    sort: buildSort(sort),
    count: pageSize,
    offset: (page - 1) * pageSize
  })

  const conn = data?.mods || {}
  const nodes = conn.nodes || []
  // ModPage 上只有 totalCount；万一某个版本连它也没有，就退化成「已翻到的条数」
  const total = conn.totalCount ?? (page - 1) * pageSize + nodes.length

  return {
    total,
    page,
    list: nodes.map((mod) => mapMod(mod, domain))
  }
}

// REST v1 单条：只有它能按 ID 精确定位，字段比 GraphQL 少，能给多少给多少
const fetchOne = async ({ domain, modId }) => {
  const data = await httpJson(`${REST_URL}/games/${domain}/mods/${modId}.json`)
  if (!data) throw httpError(404, 'NOT_FOUND', '找不到这个模组')

  return {
    total: 1,
    page: 1,
    list: [
      {
        modId: data.mod_id ?? toInt(modId, 0),
        name: data.name || '',
        summary: data.summary || '',
        category: data.category_name || '',
        author: data.author || data.uploaded_by || '',
        version: data.version || '',
        cover: proxyCover(data.picture_url),
        createdAt: data.created_time || '',
        updatedAt: data.updated_time || '',
        downloads: 0,
        endorsements: 0,
        fileSize: 0,
        url: `https://www.nexusmods.com/${domain}/mods/${modId}`
      }
    ]
  }
}

const fail = (res, e) => {
  const status = e.status || 502
  const known = {
    401: 'Nexus API Key 无效',
    403: '这个游戏的模组不允许访问',
    404: '找不到：模组 ID 或游戏域名可能不对',
    429: 'Nexus 请求太频繁，稍后再试'
  }
  // 有 status = 我们自己抛的（GraphQL 原话或指定文案）；没有 = 根本没连上
  const message = e.status
    ? e.message || known[status] || '请求 N 网失败'
    : `连不上 Nexus（检查代理 / hosts / 网络）：${e.message}`

  res.status(status).json({ success: false, error: { code: e.code || 'UPSTREAM', message } })
}

const badGame = (res) =>
  res.status(400).json({ success: false, error: { code: 'BAD_GAME', message: '无效的游戏 id' } })

// ============================================================
// 封面图代理：GET /api/nexus/image?u=<N 网图片地址>
// 只代理 N 网域名，避免变成通用代理；顺手带上 Referer 和缓存头
// ============================================================
const IMAGE_HOST = /(^|\.)(nexusmods\.com|nexus-cdn\.com)$/i

router.get('/nexus/image', async (req, res) => {
  const raw = String(req.query.u || '')
  let url = null
  try {
    url = new URL(raw.startsWith('//') ? `https:${raw}` : raw)
  } catch {
    url = null
  }

  if (!url || !/^https?:$/.test(url.protocol)) return res.status(400).end()
  if (!IMAGE_HOST.test(url.hostname)) return res.status(403).end()

  // N 网图床一律走 https，http 会被挡
  if (url.protocol === 'http:') url = new URL(url.href.replace(/^http:/, 'https:'))

  try {
    const upstream = await net.fetch(url.href, {
      headers: { Referer: 'https://www.nexusmods.com/', 'User-Agent': 'Mozilla/5.0' }
    })
    if (!upstream.ok) return res.status(upstream.status).end()

    res.set('Content-Type', upstream.headers.get('content-type') || 'image/jpeg')
    res.set('Cache-Control', 'public, max-age=86400')
    res.send(Buffer.from(await upstream.arrayBuffer()))
  } catch {
    res.status(502).end()
  }
})

// ============================================================
// 模组列表
// GET /api/nexus/mods?gameId=&sort=&page=&pageSize=&modId=&name=&favoritesOnly=
// ============================================================
router.get('/nexus/mods', async (req, res) => {
  const { gameId, sort = 'latest_added', modId = '', name = '', favoritesOnly } = req.query
  if (!isValidGameId(gameId)) return badGame(res)

  if (!apiKey()) {
    return res.status(400).json({
      success: false,
      error: { code: 'NO_KEY', message: '还没配置 Nexus API Key：设置 → Nexus API Key' }
    })
  }

  const page = Math.max(1, toInt(req.query.page, 1))
  const pageSize = clamp(toInt(req.query.pageSize, DEFAULT_PAGE_SIZE), 1, MAX_PAGE_SIZE)
  const idKeyword = String(modId).trim()
  const nameKeyword = String(name).trim()

  try {
    const result = idKeyword
      ? await fetchOne({ domain: gameDomain(gameId), modId: idKeyword })
      : await fetchPage({
          domain: gameDomain(gameId),
          sort,
          page,
          pageSize,
          name: nameKeyword
        })

    // 只看收藏：不额外发请求，只筛当前这一页（翻到收藏所在的页才能看到）
    let list = result.list
    if (['1', 'true'].includes(String(favoritesOnly))) {
      const fav = new Set(favoritesOf(gameId))
      list = list.filter((mod) => fav.has(mod.modId))
    }

    res.json({
      success: true,
      source: 'nexus',
      total: result.total,
      page: result.page,
      pageSize,
      list
    })
  } catch (e) {
    fail(res, e)
  }
})

// ============================================================
// 收藏（只存 modId）
// ============================================================
router.get('/nexus/favorites', (req, res) => {
  const { gameId } = req.query
  if (!isValidGameId(gameId)) return badGame(res)

  res.json({ success: true, modIds: favoritesOf(gameId) })
})

router.post('/nexus/favorites', (req, res) => {
  const { gameId, modId, favorite } = req.body || {}
  if (!isValidGameId(gameId)) return badGame(res)

  const id = toInt(modId, 0)
  if (!id) {
    return res
      .status(400)
      .json({ success: false, error: { code: 'BAD_MOD', message: '无效的模组 id' } })
  }

  const all = readJson(FAVORITES_FILE, {})
  const list = new Set(favoritesOf(gameId))
  if (favorite) list.add(id)
  else list.delete(id)

  all[gameId] = [...list]
  writeFavorites(all)

  res.json({ success: true, modIds: all[gameId] })
})

export default router
