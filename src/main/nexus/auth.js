import { BrowserWindow, net } from 'electron'
import fs from 'fs'
import http from 'http'
import path from 'path'
import { createHash, randomBytes } from 'crypto'
import { writeJson } from '../stores/file.js'
import { DATA_DIR } from '../stores/paths.js'

// ============================================================
// N 网 OAuth（授权码 + PKCE，内嵌窗口 + 本地回环）
//
// 关键点：授权窗口和 Mod下载 共用 persist:nexus 会话。
// 如果你已经在网页里登录 N 网，这里通常只需要点一次「授权」；
// 如果还没登录，在这里登录一次，网页也会同步登录。
//
// token 只在主进程保存，渲染层拿不到。
// ============================================================

const CLIENT_ID = 'vortex_loopback'
const OAUTH_BASE = 'https://users.nexusmods.com/oauth'
const API_BASE = 'https://api.nexusmods.com/v1'
const SCOPES = 'openid profile email'
const PARTITION = 'persist:nexus'
const AUTH_FILE = path.join(DATA_DIR, 'nexus-auth.json')
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000

export class NexusAuthError extends Error {
  constructor(code, message) {
    super(message || 'N 网登录失败')
    this.name = 'NexusAuthError'
    this.code = code
  }
}

let cachedAuth = null
let refreshPromise = null
let loginPromise = null

const readAuth = () => {
  if (cachedAuth) return cachedAuth

  try {
    cachedAuth = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'))
  } catch {
    cachedAuth = null
  }

  return cachedAuth
}

const writeAuth = (auth) => {
  writeJson(AUTH_FILE, auth, { mode: 0o600 })
  cachedAuth = auth
  return auth
}

const clearAuth = () => {
  cachedAuth = null
  try {
    fs.rmSync(AUTH_FILE, { force: true })
  } catch {
    /* 文件不存在就算了 */
  }
}

const isExpiring = (auth) => !auth?.expiresAt || Date.now() > auth.expiresAt - 60 * 1000

const parseJson = async (response, fallback) => {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : fallback
  } catch {
    return fallback
  }
}

const requestToken = async (params) => {
  let response
  try {
    response = await net.fetch(`${OAUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(25000)
    })
  } catch (error) {
    throw new NexusAuthError('NETWORK', `连不上 N 网登录服务：${error.message}`)
  }

  const data = await parseJson(response, {})
  if (!response.ok || !data.access_token) {
    const message = data.error_description || data.error || `HTTP ${response.status}`
    throw new NexusAuthError('TOKEN', `N 网授权失败：${message}`)
  }

  return data
}

const fetchUserInfo = async (accessToken) => {
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
    'Application-Name': 'ModBox',
    'Application-Version': '1.0.0'
  }

  try {
    const response = await net.fetch(`${API_BASE}/users/validate.json`, {
      headers,
      signal: AbortSignal.timeout(20000)
    })
    if (response.ok) {
      const user = await parseJson(response, {})
      return {
        name: user.name || user.username || 'N 网用户',
        email: user.email || '',
        avatar: user.avatar_url || user.avatar || '',
        isPremium: Boolean(user.is_premium),
        isSupporter: Boolean(user.is_supporter)
      }
    }
  } catch {
    /* 换 userinfo 再试 */
  }

  try {
    const response = await net.fetch(`${OAUTH_BASE}/userinfo`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(20000)
    })
    if (response.ok) {
      const user = await parseJson(response, {})
      return {
        name: user.name || user.preferred_username || user.username || 'N 网用户',
        email: user.email || '',
        avatar: user.picture || user.avatar_url || '',
        isPremium: Boolean(user.is_premium),
        isSupporter: Boolean(user.is_supporter)
      }
    }
  } catch {
    /* 拿不到用户信息不阻断登录 */
  }

  return { name: 'N 网用户', email: '', avatar: '', isPremium: false, isSupporter: false }
}

const refreshAccessToken = async (auth) => {
  if (!auth?.refreshToken) throw new NexusAuthError('AUTH', '请先登录 N 网')

  try {
    const data = await requestToken({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: auth.refreshToken
    })

    return writeAuth({
      ...auth,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || auth.refreshToken,
      expiresAt: Date.now() + Math.max(60, Number(data.expires_in) || 3600) * 1000
    })
  } catch (error) {
    if (error?.code !== 'NETWORK') clearAuth()
    throw error
  }
}

export const getAuthStatus = () => {
  const auth = readAuth()
  return {
    loggedIn: Boolean(auth?.accessToken || auth?.refreshToken),
    user: auth?.user || null,
    expiresAt: auth?.expiresAt || 0
  }
}

export const getAccessToken = async () => {
  const auth = readAuth()
  if (!auth?.accessToken && !auth?.refreshToken) throw new NexusAuthError('AUTH', '请先登录 N 网')
  if (auth?.accessToken && !isExpiring(auth)) return auth.accessToken
  if (!auth?.refreshToken) throw new NexusAuthError('AUTH', 'N 网登录已过期，请重新登录')

  if (!refreshPromise) {
    refreshPromise = refreshAccessToken(auth).finally(() => {
      refreshPromise = null
    })
  }

  const next = await refreshPromise
  return next.accessToken
}

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const callbackPage = (success, message) => `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>ModBox · N 网授权</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#10151c;color:#e8edf3;font-family:Segoe UI,Microsoft YaHei,sans-serif">
  <main style="max-width:520px;padding:32px;text-align:center">
    <h1 style="color:${success ? '#34d399' : '#f87171'};font-size:24px">${success ? '授权成功' : '授权失败'}</h1>
    <p style="color:#b7c0cc;line-height:1.7">${escapeHtml(message)}</p>
    <p style="color:#7f8b99;font-size:13px">窗口即将关闭。</p>
  </main>
</body>
</html>`

const exchangeCode = async ({ code, verifier, redirectUri }) => {
  const token = await requestToken({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    code,
    code_verifier: verifier
  })

  const accessToken = token.access_token
  const refreshToken = token.refresh_token || ''
  const expiresAt = Date.now() + Math.max(60, Number(token.expires_in) || 3600) * 1000
  const user = await fetchUserInfo(accessToken)

  return writeAuth({ accessToken, refreshToken, expiresAt, user })
}

const runLogin = async () => {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const state = randomBytes(16).toString('hex')

  let finish = () => {}
  let timeout = null
  let authWindow = null

  const server = http.createServer((request, response) => {
    void (async () => {
      const requestUrl = new URL(
        request.url || '/',
        `http://${request.headers.host || '127.0.0.1'}`
      )

      if (requestUrl.pathname !== '/') {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        response.end('Not found')
        return
      }

      const returnedState = requestUrl.searchParams.get('state') || ''
      const code = requestUrl.searchParams.get('code') || ''
      const oauthError = requestUrl.searchParams.get('error') || ''
      const oauthDescription = requestUrl.searchParams.get('error_description') || ''

      if (returnedState !== state) {
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        response.end(callbackPage(false, '授权状态校验失败，请重新授权。'))
        finish(new NexusAuthError('STATE', 'N 网授权状态校验失败'))
        return
      }

      if (oauthError || !code) {
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        response.end(callbackPage(false, oauthDescription || 'N 网没有返回授权码。'))
        finish(new NexusAuthError('CALLBACK', oauthDescription || 'N 网没有返回授权码'))
        return
      }

      try {
        const auth = await exchangeCode({ code, verifier, redirectUri })
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        response.end(callbackPage(true, `已授权：${auth.user?.name || 'N 网用户'}`))
        finish(undefined, auth)
      } catch (error) {
        response.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
        response.end(callbackPage(false, error?.message || '授权处理失败。'))
        finish(error)
      }
    })()
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new NexusAuthError('SERVER', '无法启动授权回调服务')
  }

  const redirectUri = `http://127.0.0.1:${address.port}`

  const authorizeUrl = new URL(`${OAUTH_BASE}/authorize`)
  authorizeUrl.search = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  }).toString()

  return new Promise((resolve, reject) => {
    let settled = false

    finish = (error, auth) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      try {
        if (authWindow && !authWindow.isDestroyed()) authWindow.close()
      } catch {
        /* 窗口已销毁 */
      }
      server.close()
      if (error) reject(error)
      else resolve(auth)
    }

    timeout = setTimeout(() => {
      finish(new NexusAuthError('TIMEOUT', '授权等待超时，请重试'))
    }, LOGIN_TIMEOUT_MS)

    const parent = BrowserWindow.getAllWindows().find((win) => !win.isDestroyed())

    authWindow = new BrowserWindow({
      width: 520,
      height: 760,
      minWidth: 420,
      minHeight: 560,
      parent,
      modal: true,
      title: '授权 ModBox 访问 N 网',
      autoHideMenuBar: true,
      webPreferences: {
        partition: PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    authWindow.on('closed', () => {
      // 用户手动关窗口：没有完成授权就按取消处理
      finish(new NexusAuthError('CANCELLED', '已取消 N 网授权'))
    })

    authWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) authWindow?.loadURL(url)
      return { action: 'deny' }
    })

    void authWindow.loadURL(authorizeUrl.toString())
  })
}

export const loginNexus = () => {
  if (loginPromise) return loginPromise

  loginPromise = runLogin().finally(() => {
    loginPromise = null
  })

  return loginPromise
}
