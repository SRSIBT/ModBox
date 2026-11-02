<template>
  <div class="web">
    <!-- Edge 风格工具栏：导航按钮 + 地址栏 + 翻译 / 外部打开 -->
    <header class="web__chrome">
      <div class="web__nav">
        <button class="chrome-btn" :disabled="!canGoBack" title="后退" @click="goBack">
          <svg viewBox="0 0 24 24">
            <path d="m14 6-6 6 6 6" />
          </svg>
        </button>
        <button class="chrome-btn" :disabled="!canGoForward" title="前进" @click="goForward">
          <svg viewBox="0 0 24 24">
            <path d="m10 6 6 6-6 6" />
          </svg>
        </button>
        <button
          class="chrome-btn"
          :class="{ 'chrome-btn--spin': loading }"
          title="刷新"
          @click="reload"
        >
          <svg viewBox="0 0 24 24">
            <path d="M20 11a8 8 0 1 0-2.34 5.66" />
            <path d="M20 4v7h-7" />
          </svg>
        </button>
        <button class="chrome-btn" :disabled="!activeGameId" title="回到模组首页" @click="goHome">
          <svg viewBox="0 0 24 24">
            <path d="m3 11 9-8 9 8" />
            <path d="M5 10v10h14V10" />
            <path d="M10 20v-6h4v6" />
          </svg>
        </button>
      </div>

      <div class="web__addr" :title="pageTitle ? `${pageTitle} — ${displayUrl}` : displayUrl">
        <svg class="web__lock" viewBox="0 0 16 16">
          <rect x="3.2" y="7" width="9.6" height="6.4" rx="1.6" />
          <path d="M5.4 7V5.3a2.6 2.6 0 0 1 5.2 0V7" />
        </svg>

        <input
          class="web__url"
          :value="displayUrl"
          readonly
          spellcheck="false"
          autocomplete="off"
          aria-label="当前网址（只读）"
          @focus="$event.target.select()"
        />

        <span v-if="isNexus" class="web__site">N 网</span>

        <button
          class="web__copy"
          type="button"
          :title="copied ? '已复制' : '复制链接'"
          @click="copyUrl"
        >
          <svg v-if="!copied" viewBox="0 0 24 24">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h8" />
          </svg>
          <svg v-else viewBox="0 0 24 24">
            <path d="m5 12 4.5 4.5L19 7" />
          </svg>
        </button>
      </div>

      <div class="web__actions">
        <button
          class="chrome-btn"
          :disabled="clearingSession"
          title="清除 N 网会话（反复人机验证时用）"
          @click="clearNexusSession"
        >
          <svg viewBox="0 0 24 24">
            <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6L12 3z" />
            <path d="M12 8v4.5" />
            <path d="M12 15.5v.01" />
          </svg>
        </button>

        <button
          class="web__translate"
          :class="{ 'web__translate--on': translateOn, 'web__translate--busy': translateBusy }"
          :disabled="!canTranslate || translateBusy"
          :title="translateTitle"
          @click="toggleTranslate"
        >
          <span v-if="translateOn || translateBusy" class="web__pulse"></span>
          <svg viewBox="0 0 24 24">
            <path d="M4 5h10" />
            <path d="M9 3v2" />
            <path d="M6 5c0 4 3 7 7 8" />
            <path d="M11 5c0 3-2 6-6 7" />
            <path d="m13 20 4-10 4 10" />
            <path d="M14.6 16h4.8" />
          </svg>
          <span class="web__translate-label">{{ translateLabel }}</span>
        </button>

        <button class="chrome-btn" title="在浏览器打开" @click="openInBrowser">
          <svg viewBox="0 0 24 24">
            <path d="M14 4h6v6" />
            <path d="M20 4 11 13" />
            <path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" />
          </svg>
        </button>
      </div>
    </header>

    <div class="web__progress" :class="{ 'web__progress--on': loading }">
      <span></span>
    </div>

    <div class="web__body">
      <div v-if="!activeGameId" class="web__empty">
        <div class="web__empty-icon">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path d="M3.5 9h17M3.5 15h17" />
            <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
          </svg>
        </div>
        <p class="web__empty-title">尚未选择游戏</p>
        <p class="web__empty-desc">先在「游戏管理」里选一个游戏，这里会直接打开它的 N 网模组页</p>
      </div>

      <webview
        v-else
        ref="viewRef"
        class="web__view"
        :src="startUrl"
        :partition="PARTITION"
        :preload="preloadUrl || null"
        webpreferences="webSecurity=yes"
        allowpopups
        @did-navigate="onNavigate"
        @did-navigate-in-page="onNavigate"
        @page-title-updated="onTitle"
        @did-start-loading="onStartLoading"
        @did-stop-loading="onStopLoading"
        @did-fail-load="onFail"
        @ipc-message="onGuestMessage"
      ></webview>
    </div>

    <footer v-if="loadError" class="web__error">
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5" />
        <path d="M12 16.5v.01" />
      </svg>
      <span>{{ loadError }}</span>
    </footer>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useGameStore } from '@/stores/game'
import { useSettingStore } from '@/stores/setting'

defineOptions({ name: 'ModDownload' })

// 必须和主进程 download/manager.js 里的 NEXUS_PARTITION 一致
const PARTITION = 'persist:nexus'

const gameStore = useGameStore()
const { activeGame } = storeToRefs(gameStore)
const { fetchGames } = gameStore

const settingStore = useSettingStore()
const { activeGameId } = storeToRefs(settingStore)
const { fetchSettings } = settingStore

const viewRef = ref(null)
// preload 路径在渲染层 preload 启动时已同步拿到；拿不到再异步兜底
const preloadUrl = ref(window.webviewAPI?.preloadPath || '')
const currentUrl = ref('')
const pageTitle = ref('Nexus Mods')
const canGoBack = ref(false)
const canGoForward = ref(false)
const loading = ref(false)
const loadError = ref('')
const copied = ref(false)
const clearingSession = ref(false)

const translateState = ref({
  state: 'idle',
  done: 0,
  total: 0,
  translated: false,
  message: ''
})

// game.json 里写了 nexusDomain 就用它，否则退回目录名小写
const domain = computed(() => {
  const game = activeGame.value
  if (!game) return ''
  return String(game.nexusDomain || game.id || '').toLowerCase()
})

const homeUrl = computed(() => (domain.value ? `https://www.nexusmods.com/${domain.value}/` : ''))

// 地址栏只读展示：优先当前页面，页面还没导航时先显示首页
const displayUrl = computed(() => currentUrl.value || homeUrl.value)

// ---------- 浏览记录 ----------
// 切到别的页面再回来，组件会被重新创建、webview 也会重新加载，
// 所以把「每个游戏最后停留的页面」存在 localStorage 里，回来时直接接着打开。
const PAGE_KEY = 'modbox:nexus:last-page'

// 故意不做成响应式：它在导航时被写入，如果参与计算会让 webview 的 src 变来变去
const savedPages = (() => {
  try {
    return JSON.parse(localStorage.getItem(PAGE_KEY) || '{}') || {}
  } catch {
    return {}
  }
})()

const startUrl = computed(() => {
  const gameDomain = domain.value
  if (!gameDomain) return ''

  const saved = savedPages[activeGameId.value] || ''
  // 只认「当前游戏自己的页面」，换过游戏不会串到别的游戏去
  return saved.startsWith(`https://www.nexusmods.com/${gameDomain}/`) ? saved : homeUrl.value
})

const rememberPage = (url) => {
  if (!url || !activeGameId.value) return
  if (!/^https:\/\/www\.nexusmods\.com\//i.test(url)) return

  savedPages[activeGameId.value] = url
  try {
    localStorage.setItem(PAGE_KEY, JSON.stringify(savedPages))
  } catch {
    /* 存不下就算了，不影响浏览 */
  }
}

const isNexus = computed(() => /(^|\.)nexusmods\.com$/i.test(safeHost(displayUrl.value)))

const canTranslate = computed(() => Boolean(displayUrl.value && preloadUrl.value))

const translateOn = computed(() => translateState.value.translated === true)

const translateBusy = computed(() => translateState.value.state === 'working')

const translateLabel = computed(() => {
  const snapshot = translateState.value
  if (snapshot.state === 'working') {
    return `翻译中 ${snapshot.done}/${snapshot.total || '…'}`
  }
  if (snapshot.translated) return '显示原文'
  return '翻译'
})

const translateTitle = computed(() => {
  const snapshot = translateState.value
  if (snapshot.message) return snapshot.message
  if (snapshot.state === 'working') return '正在翻译当前页面'
  if (snapshot.translated) return '恢复页面原文'
  return '把当前页面翻译成简体中文（Edge 翻译引擎）'
})

function safeHost(value) {
  try {
    return new URL(value).hostname
  } catch {
    return ''
  }
}

const refreshNav = () => {
  const view = viewRef.value
  if (!view || typeof view.canGoBack !== 'function') return
  canGoBack.value = view.canGoBack()
  canGoForward.value = view.canGoForward()
}

const resetTranslate = () => {
  translateState.value = {
    state: 'idle',
    done: 0,
    total: 0,
    translated: false,
    message: ''
  }
}

const goBack = () => viewRef.value?.goBack()
const goForward = () => viewRef.value?.goForward()
const reload = () => viewRef.value?.reload()
const goHome = () => {
  if (viewRef.value && homeUrl.value) viewRef.value.loadURL(homeUrl.value)
}

const onStartLoading = () => {
  loading.value = true
  loadError.value = ''
}

const onNavigate = (event) => {
  currentUrl.value = event.url || currentUrl.value
  rememberPage(currentUrl.value)
  resetTranslate()
  viewRef.value?.send?.('mayfly:translate', 'reset')
  refreshNav()
}

const onTitle = (event) => {
  pageTitle.value = event.title || pageTitle.value
}

const onStopLoading = () => {
  loading.value = false
  refreshNav()
  // 每次页面加载完成自动翻译；preload 里还有一次防抖兜底
  viewRef.value?.send?.('mayfly:translate', 'auto')
}

const onFail = (event) => {
  loading.value = false
  // -3 是 ABORTED（用户中途点了别的链接），不算错误
  if (event.errorCode !== -3) loadError.value = event.errorDescription || '页面加载失败'
}

const onGuestMessage = (event) => {
  if (event.channel !== 'mayfly:translate-state') return
  const payload = event.args?.[0]
  if (payload && typeof payload === 'object') {
    translateState.value = { ...translateState.value, ...payload }
  }
}

const toggleTranslate = () => {
  viewRef.value?.send?.('mayfly:translate', 'toggle')
}

const openInBrowser = () => {
  const url = currentUrl.value || homeUrl.value
  if (url) window.electronAPI.openExternal(url)
}

// Cloudflare 的人机验证和 UA/IP 绑得很死；清掉这个分区再重来，
// 比一直在验证页里刷新有效。会退出 N 网登录，所以先确认。
const clearNexusSession = async () => {
  if (clearingSession.value) return
  const confirmed = window.confirm('会退出 N 网登录并清除验证缓存，然后重新加载页面。确定继续吗？')
  if (!confirmed) return

  clearingSession.value = true
  try {
    await window.webviewAPI?.clearNexusSession?.()
    translateState.value = {
      state: 'idle',
      done: 0,
      total: 0,
      translated: false,
      message: ''
    }
    loadError.value = ''
    viewRef.value?.reload()
  } catch (error) {
    loadError.value = error?.message || '清除 N 网会话失败'
  } finally {
    clearingSession.value = false
  }
}

const copyUrl = async () => {
  const url = displayUrl.value
  if (!url) return

  try {
    await navigator.clipboard.writeText(url)
  } catch {
    // clipboard 在部分 file:// 环境会被拒绝，退回 textarea
    const textarea = document.createElement('textarea')
    textarea.value = url
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  }

  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 1200)
}

// 换游戏后地址变了，标题和翻译状态都要重置
watch(homeUrl, () => {
  pageTitle.value = activeGame.value?.name || 'Nexus Mods'
  currentUrl.value = homeUrl.value
  loadError.value = ''
  resetTranslate()
})

onMounted(async () => {
  await fetchSettings()
  await fetchGames()

  // 正常情况下 preload 启动时已经同步拿到；这里只兜底 preload 注入失败的情况
  if (!preloadUrl.value) {
    try {
      preloadUrl.value = (await window.webviewAPI?.preload()) || ''
    } catch {
      preloadUrl.value = ''
    }
  }

  currentUrl.value = homeUrl.value
})

onBeforeUnmount(() => {
  copied.value = false
})
</script>

<style scoped>
.web {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin: 8px 10px 10px;
  border-radius: 14px;
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
  backdrop-filter: none;
  box-shadow: 0 18px 44px -28px rgba(0, 0, 0, 0.55);
  box-sizing: border-box;
}

/* ================= Edge 风格工具栏 ================= */

.web__chrome {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 10px;
  border-bottom: 1px solid var(--divider);
  background: color-mix(in srgb, var(--panel-bg) 88%, transparent);
  user-select: none;
}

.web__nav {
  display: flex;
  align-items: center;
  gap: 2px;
}

.chrome-btn {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-sub);
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    color 0.18s ease,
    border-color 0.18s ease;
}

.chrome-btn svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.chrome-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--inner-border);
  color: var(--text);
}

.chrome-btn:active:not(:disabled) {
  transform: scale(0.94);
}

.chrome-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.chrome-btn--spin svg {
  animation: spin 0.9s linear infinite;
}

/* ---------- 地址栏 ---------- */

.web__addr {
  flex: 1;
  min-width: 0;
  height: 32px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px 0 10px;
  border: 1px solid var(--inner-border);
  border-radius: 9px;
  background: var(--inner-bg);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background-color 0.18s ease;
}

.web__addr:focus-within {
  border-color: var(--accent);
  background: var(--panel-bg);
  box-shadow: 0 0 0 3px var(--success-soft);
}

.web__lock {
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
  fill: none;
  stroke: var(--success);
  stroke-width: 1.3;
  stroke-linejoin: round;
}

.web__url {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 12px;
  letter-spacing: 0.1px;
  cursor: default;
  user-select: all;
}

.web__url::placeholder {
  color: var(--text-faint);
}

.web__site {
  flex: 0 0 auto;
  padding: 2px 7px;
  border-radius: 6px;
  background: var(--success-soft);
  color: var(--success);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.4px;
}

.web__copy {
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-faint);
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    color 0.16s ease;
}

.web__copy svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.web__copy:hover {
  background: var(--bg-hover);
  color: var(--text);
}

/* ---------- 右侧动作 ---------- */

.web__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.web__translate {
  position: relative;
  height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid var(--inner-border);
  border-radius: 8px;
  background: var(--inner-bg);
  color: var(--text-sub);
  font-size: 12px;
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease;
}

.web__translate svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.web__translate:hover:not(:disabled) {
  color: var(--text);
  border-color: var(--text-faint);
}

.web__translate:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.web__translate--on {
  color: var(--success);
  border-color: color-mix(in srgb, var(--success) 40%, transparent);
  background: var(--success-soft);
}

.web__translate--busy svg {
  animation: spin 1.1s linear infinite;
}

.web__pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 0 0 var(--success);
  animation: dot-pulse 1.8s ease-out infinite;
}

.web__translate-label {
  white-space: nowrap;
}

/* ================= 进度条 ================= */

.web__progress {
  flex: 0 0 auto;
  height: 2px;
  overflow: hidden;
  opacity: 0;
  background: transparent;
  transition: opacity 0.2s ease;
}

.web__progress--on {
  opacity: 1;
}

.web__progress span {
  display: block;
  width: 34%;
  height: 100%;
  background: linear-gradient(90deg, transparent, var(--success), transparent);
  animation: edge-loading 1.15s ease-in-out infinite;
}

/* ================= 网页容器 ================= */

.web__body {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: #1b1d21;
}

.web__view {
  width: 100%;
  height: 100%;
  display: flex;
  background: #1b1d21;
}

/* ================= 空态 ================= */

.web__empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-sub);
  animation: fade-up 0.35s ease both;
}

.web__empty-icon {
  width: 54px;
  height: 54px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
  border-radius: 50%;
  border: 1px solid var(--inner-border);
  background: var(--inner-bg);
  color: var(--text-faint);
}

.web__empty-icon svg {
  width: 26px;
  height: 26px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.web__empty-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}

.web__empty-desc {
  max-width: 320px;
  font-size: 12px;
  line-height: 1.7;
  text-align: center;
  color: var(--text-sub);
}

/* ================= 错误条 ================= */

.web__error {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-top: 1px solid var(--divider);
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 11px;
}

.web__error svg {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
}

/* ================= 动画 ================= */

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes dot-pulse {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--success) 55%, transparent);
  }

  70% {
    box-shadow: 0 0 0 6px transparent;
  }

  100% {
    box-shadow: 0 0 0 0 transparent;
  }
}

@keyframes edge-loading {
  0% {
    transform: translateX(-120%);
  }

  100% {
    transform: translateX(330%);
  }
}

@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 900px) {
  .web__translate-label {
    display: none;
  }

  .web__translate {
    width: 30px;
    padding: 0;
    justify-content: center;
  }

  .web__pulse {
    position: absolute;
    top: 5px;
    right: 5px;
    width: 5px;
    height: 5px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .chrome-btn--spin svg,
  .web__translate--busy svg,
  .web__progress span,
  .web__pulse {
    animation: none;
  }
}
</style>
