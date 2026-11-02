'use strict'

// ============================================================
// ModBox webview preload
//
// 只做两件事：
//   1. 整页翻译：遍历文本节点 → 批量交给主进程（Edge）→ 写回 DOM
//   2. 接管 nxm:// 链接：交给主进程的下载管理器
//
// 不再注入「一键下载」按钮：N 网官方的「Mod Manager Download」本身就能用，
// 免费账号也可以；额外按钮反而容易误点。
// ============================================================

const { ipcRenderer } = require('electron')

const PROVIDER = 'edge'
const TARGET_LANG = 'zh-Hans'
const PAGE_STYLE_ID = 'modbox-page-style'

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'CODE',
  'PRE',
  'KBD',
  'SAMP',
  'TEXTAREA',
  'INPUT',
  'SELECT',
  'OPTION',
  'SVG',
  'CANVAS',
  'IFRAME',
  'VIDEO',
  'AUDIO'
])

const SKIP_SELECTOR = [
  '[translate="no"]',
  '.notranslate',
  '[contenteditable="true"]',
  '[aria-hidden="true"]',
  '.SubmissionAuthor',
  '.Credits',
  '[itemprop="author"]'
].join(',')

let state = { state: 'idle', done: 0, total: 0, translated: false, message: '' }
const originals = new Map()
let seen = new WeakSet()

let running = false
let inited = false
let mutationTimer = null
let initTimer = null
let autoTimer = null

function isCloudflareChallenge() {
  const title = String(document.title || '').toLowerCase()
  if (
    title.includes('just a moment') ||
    title.includes('attention required') ||
    title.includes('verify you are human') ||
    title.includes('checking your browser') ||
    title.includes('人机验证') ||
    title.includes('检查浏览器')
  ) {
    return true
  }

  if (
    document.querySelector(
      '#challenge-running, #challenge-stage, #cf-challenge-running, iframe[src*="challenges.cloudflare.com"]'
    )
  ) {
    return true
  }

  const bodyText = String(document.body?.innerText || '').slice(0, 600)
  return /verify you are human|确认您是真人|请完成安全验证|checking your browser/i.test(bodyText)
}

function sendState(patch = {}) {
  state = { ...state, ...patch }
  try {
    ipcRenderer.sendToHost('mayfly:translate-state', { ...state })
  } catch {
    /* 页面正在卸载时忽略 */
  }
}

function chineseRatio(text) {
  const sample = String(text || '').slice(0, 5000)
  const cjk = (sample.match(/[\u4e00-\u9fff]/g) || []).length
  const latin = (sample.match(/[A-Za-z]/g) || []).length
  return cjk / Math.max(1, cjk + latin)
}

function isProbablyChinese() {
  const text = document.body?.innerText || ''
  return text.length > 120 && chineseRatio(text) > 0.55
}

function collectNodes() {
  if (!document.body) return []

  const nodes = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (seen.has(node)) return NodeFilter.FILTER_REJECT

      const element = node.parentElement
      if (!element) return NodeFilter.FILTER_REJECT
      if (SKIP_TAGS.has(element.tagName)) return NodeFilter.FILTER_REJECT
      if (element.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT

      const raw = node.nodeValue || ''
      const text = raw.trim()

      if (text.length < 2) return NodeFilter.FILTER_REJECT
      if (!/[A-Za-z\u00c0-\u024f\u0400-\u04ff]{2,}/.test(text)) return NodeFilter.FILTER_REJECT
      if (/^(https?:|www\.)/i.test(text)) return NodeFilter.FILTER_REJECT
      if (/^[\d\s.,:;+\-–—/()%#]+$/.test(text)) return NodeFilter.FILTER_REJECT
      if (/^v?\d+(\.\d+)+$/i.test(text)) return NodeFilter.FILTER_REJECT
      if (chineseRatio(text) > 0.6) return NodeFilter.FILTER_REJECT

      return NodeFilter.FILTER_ACCEPT
    }
  })

  while (walker.nextNode()) nodes.push(walker.currentNode)
  return nodes
}

function applyTranslation(node, translated) {
  const current = node.nodeValue || ''
  const lead = current.match(/^\s*/)?.[0] || ''
  const tail = current.match(/\s*$/)?.[0] || ''
  node.nodeValue = `${lead}${translated}${tail}`
}

async function translatePage({ silent = false } = {}) {
  if (running || !document.body) return

  if (isCloudflareChallenge()) {
    sendState({
      state: 'idle',
      done: 0,
      total: 0,
      translated: false,
      message: '当前页面正在做人机验证，完成后再翻译'
    })
    return
  }

  if (!silent && isProbablyChinese()) {
    sendState({
      state: 'done',
      done: 0,
      total: 0,
      translated: false,
      message: '当前页面已经是中文'
    })
    return
  }

  const nodes = collectNodes()
  if (nodes.length === 0) {
    if (!silent) {
      sendState({ state: 'done', translated: originals.size > 0, message: '' })
    }
    return
  }

  const groups = new Map()

  for (const node of nodes) {
    seen.add(node)
    const raw = node.nodeValue || ''
    const core = raw.trim()
    if (!core) continue

    originals.set(node, raw)
    if (!groups.has(core)) groups.set(core, [])
    groups.get(core).push(node)
  }

  const texts = [...groups.keys()]
  if (texts.length === 0) return

  running = true
  let translatedAny = state.translated === true

  sendState({
    state: 'working',
    done: 0,
    total: texts.length,
    translated: translatedAny,
    message: ''
  })

  const BATCH_SIZE = 20

  try {
    for (let start = 0; start < texts.length; start += BATCH_SIZE) {
      const chunk = texts.slice(start, start + BATCH_SIZE)
      let results = chunk
      let changed = 0

      try {
        const response = await ipcRenderer.invoke('translate:batch', {
          texts: chunk,
          provider: PROVIDER,
          targetLang: TARGET_LANG
        })
        if (Array.isArray(response) && response.length === chunk.length) results = response
      } catch (error) {
        sendState({ message: error?.message || '翻译请求失败' })
      }

      chunk.forEach((source, index) => {
        const translated = String(results[index] ?? source)
        if (translated !== source) changed += 1
        for (const node of groups.get(source) || []) {
          if (node.isConnected) applyTranslation(node, translated)
        }
      })

      if (changed > 0) translatedAny = true
      sendState({ done: Math.min(texts.length, start + chunk.length) })
    }

    sendState({
      state: translatedAny ? 'done' : 'idle',
      translated: translatedAny,
      message: translatedAny ? '' : '翻译服务没有返回结果，可能是网络或代理问题'
    })
  } finally {
    running = false
  }
}

function restorePage() {
  for (const [node, text] of originals) {
    if (node.isConnected) node.nodeValue = text
  }
  originals.clear()
  seen = new WeakSet()
  sendState({ state: 'idle', done: 0, total: 0, translated: false, message: '' })
}

function toggleTranslation() {
  if (state.translated) restorePage()
  else translatePage()
}

function injectPageStyles() {
  if (document.getElementById(PAGE_STYLE_ID)) return

  const style = document.createElement('style')
  style.id = PAGE_STYLE_ID
  style.textContent = `
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb {
      background: rgba(128, 128, 128, 0.34);
      border: 2px solid transparent;
      border-radius: 8px;
      background-clip: content-box;
    }
    ::-webkit-scrollbar-thumb:hover { background: rgba(128, 128, 128, 0.55); background-clip: content-box; }
    ::selection { background: rgba(3, 151, 79, 0.32); }
    html { scroll-behavior: smooth; }
  `
  document.documentElement.appendChild(style)
}

function setupObserver() {
  const observer = new MutationObserver(() => {
    if (!state.translated || running) return
    if (mutationTimer) clearTimeout(mutationTimer)
    mutationTimer = setTimeout(() => translatePage({ silent: true }), 700)
  })

  observer.observe(document.documentElement, { childList: true, subtree: true })
}

// 站点的「Mod Manager Download」最终会生成 nxm:// 链接；
// 这里拦截点击直接交给主进程，避免 Chromium 弹“未知协议”。
function setupNxmCapture() {
  document.addEventListener(
    'click',
    (event) => {
      const anchor =
        event.target instanceof Element ? event.target.closest('a[href^="nxm://"]') : null
      if (!anchor) return

      event.preventDefault()
      event.stopPropagation()

      const href = anchor.getAttribute('href')
      if (href) ipcRenderer.invoke('download:nxm', href)
    },
    true
  )
}

function init() {
  if (inited) return

  // 验证页里不要注入样式 / 观察器 / 翻译，避免干扰 Turnstile 导致反复验证
  if (isCloudflareChallenge()) {
    clearTimeout(initTimer)
    initTimer = setTimeout(init, 2500)
    return
  }

  inited = true

  injectPageStyles()
  setupObserver()
  setupNxmCapture()

  sendState({ state: 'idle', done: 0, total: 0, translated: false, message: '' })

  // 自动翻译：页面稳定后开始；宿主 did-stop-loading 也会发一次 auto，
  // 两次调用由 running / translated 状态去重。
  clearTimeout(autoTimer)
  autoTimer = setTimeout(() => {
    if (!state.translated && !running) translatePage()
  }, 700)
}

ipcRenderer.on('mayfly:translate', (_event, action) => {
  if (action === 'translate') translatePage()
  else if (action === 'auto') {
    if (!state.translated) translatePage()
    else translatePage({ silent: true })
  } else if (action === 'restore') restorePage()
  else if (action === 'reset') restorePage()
  else if (action === 'toggle') toggleTranslation()
  else if (action === 'status') sendState()
})

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
  init()
}

window.addEventListener('load', () => {
  if (!inited) init()
})
