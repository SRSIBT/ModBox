import { net } from 'electron'
import fs from 'fs'
import { SETTINGS_FILE } from '../utils/paths.js'

// N 网 REST v1。这里只用到两个接口：
//   GET /games/{domain}/mods/{modId}.json                              模组名（拿不到不阻断下载）
//   GET /games/{domain}/mods/{modId}/files/{fileId}/download_link.json 换 CDN 直链
//
// 换直链必须带 apikey 头；免费账号还要额外带 nxm 链接里的 key + expires。
// 返回的是**数组**，直链在 [0].URI（大写 URI）。

const REST_URL = 'https://api.nexusmods.com/v1'

export class NxmApiError extends Error {
  constructor(code, message, status) {
    super(message || '请求 Nexus 失败')
    this.name = 'NxmApiError'
    this.code = code
    this.status = status
  }
}

export const readApiKey = () => {
  try {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'))
    return String(settings?.nexusApiKey || '').trim()
  } catch {
    // 首次启动还没 settings.json
    return ''
  }
}

const requestHeaders = (apiKey) => ({
  apikey: apiKey,
  accept: 'application/json',
  'Application-Name': 'ModBox',
  'Application-Version': '1.0.0'
})

// 用 net.fetch（Chromium 网络栈）而不是 axios：自动跟随系统代理，证书走系统库，
// 和 routes/nexus.js 的选择保持一致
const getJson = async (apiPath) => {
  const apiKey = readApiKey()
  if (!apiKey) {
    throw new NxmApiError('NO_KEY', '还没配置 Nexus API Key：设置 → Nexus API Key')
  }

  let res
  try {
    res = await net.fetch(`${REST_URL}${apiPath}`, {
      headers: requestHeaders(apiKey),
      signal: AbortSignal.timeout(20000)
    })
  } catch (e) {
    throw new NxmApiError('NETWORK', `连不上 Nexus（检查代理 / hosts / 网络）：${e.message}`)
  }

  const body = await res.text()
  let data = null
  try {
    data = body ? JSON.parse(body) : null
  } catch {
    data = null
  }

  if (!res.ok) throw new NxmApiError('UPSTREAM', '', res.status)
  return data
}

const mapDownloadLinkError = (e) => {
  if (e.code !== 'UPSTREAM') return e

  const byStatus = {
    400: '下载授权无效：浏览器和 ModBox 要登录同一个 N 网账号',
    401: 'Nexus API Key 无效，去设置里重新配置',
    403: 'N 网拒绝了这次下载授权，回网站重新点「Mod Manager Download」',
    404: '这个文件已经不能下载了（可能已被作者删除）',
    410: '下载授权已过期，回网站重新点「Mod Manager Download」',
    429: 'N 网请求太频繁，过一会再试'
  }

  return new NxmApiError(
    'DOWNLOAD_LINK',
    byStatus[e.status] || `换取下载直链失败（HTTP ${e.status}）`,
    e.status
  )
}

export const fetchModInfo = async (domain, modId) => {
  const data = await getJson(`/games/${encodeURIComponent(domain)}/mods/${modId}.json`)
  return {
    name: data?.name || '',
    version: data?.version || '',
    author: data?.author || data?.uploaded_by || ''
  }
}

/**
 * 用 nxm 链接里的 key + expires 换真实 CDN 直链。
 * @returns {{ url: string, name: string }}
 */
export const fetchDownloadLink = async ({ domain, modId, fileId, key, expires }) => {
  const params = new URLSearchParams()
  params.set('key', key)
  params.set('expires', String(expires))

  const apiPath =
    `/games/${encodeURIComponent(domain)}/mods/${modId}/files/${fileId}/download_link.json` +
    `?${params.toString()}`

  let data
  try {
    data = await getJson(apiPath)
  } catch (e) {
    throw mapDownloadLinkError(e)
  }

  const item = Array.isArray(data) ? data.find((entry) => entry && entry.URI) : null
  if (!item) throw new NxmApiError('NO_LINK', 'N 网没有返回可用的下载直链')

  return {
    url: item.URI,
    // name 里已经带了「模组名-ID-版本.扩展名」，直接拿来当文件名最省事
    name: item.name || item.short_name || ''
  }
}
