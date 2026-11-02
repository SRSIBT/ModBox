import { net } from 'electron'
import { getAccessToken, NexusAuthError } from './auth.js'

// N 网 REST v1，OAuth Bearer 鉴权。
//   GET /games/{domain}/mods/{modId}.json                              模组名（拿不到不阻断下载）
//   GET /games/{domain}/mods/{modId}/files/{fileId}/download_link.json 换 CDN 直链
//
// 免费账号还要额外带 nxm 链接里的 key + expires；返回数组，直链在 [0].URI。

const REST_URL = 'https://api.nexusmods.com/v1'

export class NxmApiError extends Error {
  constructor(code, message, status) {
    super(message || '请求 Nexus 失败')
    this.name = 'NxmApiError'
    this.code = code
    this.status = status
  }
}

const authHeaders = async () => {
  let token = ''
  try {
    token = await getAccessToken()
  } catch (error) {
    if (error instanceof NexusAuthError) throw error
    throw new NexusAuthError('AUTH', 'N 网登录状态无效，请重新登录')
  }

  return {
    accept: 'application/json',
    authorization: `Bearer ${token}`,
    'Application-Name': 'ModBox',
    'Application-Version': '1.0.0'
  }
}

const getJson = async (apiPath) => {
  const headers = await authHeaders()

  let res
  try {
    res = await net.fetch(`${REST_URL}${apiPath}`, {
      headers,
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
  if (e instanceof NexusAuthError) return e
  if (e.code !== 'UPSTREAM') return e

  const byStatus = {
    400: '下载授权无效：请在 N 网页面重新点一次下载',
    401: 'N 网登录已过期，请重新授权',
    403: 'N 网拒绝了这次下载授权；请确认已登录，或回 N 网页面重新下载',
    404: '这个文件已经不能下载了（可能已被作者删除）',
    410: '下载授权已过期，回 N 网页面重新下载',
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
  if (key) params.set('key', key)
  if (expires) params.set('expires', String(expires))
  const query = params.toString()

  const apiPath =
    `/games/${encodeURIComponent(domain)}/mods/${modId}/files/${fileId}/download_link.json` +
    (query ? `?${query}` : '')

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
    name: item.name || item.short_name || ''
  }
}
