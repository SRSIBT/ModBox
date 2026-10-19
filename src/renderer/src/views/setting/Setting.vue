<template>
  <div class="setting">
    <!-- 左侧定位栏 -->
    <aside class="setting__nav glass-inner">
      <div v-for="(s, i) in sections" :key="s.key" class="nav-item" :class="{ 'nav-item--active': activeIndex === i }"
        @click="scrollTo(i)">
        {{ s.label }}
      </div>
    </aside>

    <!-- 右侧内容区 -->
    <div ref="scrollRef" class="setting__content" @scroll="onScroll">
      <!-- 常规 -->
      <section :ref="setSection('general')" class="block glass">
        <div class="block__title">常规</div>

        <div class="row">
          <div class="row__label">
            <div class="row__name">最小化到托盘</div>
            <div class="row__desc">点关闭按钮时收进托盘，而不是退出软件</div>
          </div>
          <button class="switch" :class="{ 'switch--on': minimizeToTray }" role="switch" :aria-checked="minimizeToTray"
            @click="toggleMinimizeToTray">
            <span class="switch__dot"></span>
          </button>
        </div>

        <div class="row">
          <div class="row__label">
            <div class="row__name">主题</div>
            <div class="row__desc">切换亮色 / 暗色外观</div>
          </div>
          <div class="segment">
            <button class="segment__item" :class="{ 'segment__item--active': theme === 'light' }"
              @click="setTheme('light')">
              亮
            </button>
            <button class="segment__item" :class="{ 'segment__item--active': theme === 'dark' }"
              @click="setTheme('dark')">
              暗
            </button>
          </div>
        </div>
      </section>

      <!-- 外观 -->
      <section :ref="setSection('appearance')" class="block glass">
        <div class="block__title">外观</div>
        <div class="row__desc row__desc--top">背景图</div>

        <div class="bg-list">
          <!-- 系统默认壁纸 -->
          <div class="bg-card" :class="{ 'bg-card--active': background === 'default' }"
            @click="setBackground('default')">
            <div class="bg-card__preview">
              <img :src="defaultBgUrl" alt="默认壁纸" />
            </div>
            <div class="bg-card__foot">
              <span class="bg-card__name">默认壁纸</span>
              <span class="bg-card__tag">内置</span>
            </div>
          </div>

          <!-- 用户上传图 -->
          <div class="bg-card" :class="{
            'bg-card--active': background === 'custom',
            'bg-card--empty': !hasCustom
          }" @click="hasCustom && setBackground('custom')">
            <div class="bg-card__preview">
              <img v-if="hasCustom" :src="customBgUrl" alt="我的背景" />
              <div v-else class="bg-card__placeholder">尚未上传</div>
            </div>
            <div class="bg-card__foot">
              <span class="bg-card__name">我的背景</span>
              <button class="bg-card__upload" @click.stop="pickBackground">
                {{ hasCustom ? '更换' : '上传' }}
              </button>
              <span class="tip" :title="hasCustom ? '' : '尚未上传自定义背景'">
                <button class="bg-card__del" :disabled="!hasCustom" @click.stop="onRemoveBackground">
                  删除
                </button>
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- 游戏 & 数据 -->
      <section :ref="setSection('game')" class="block glass">
        <div class="block__title">游戏 &amp; 数据</div>

        <div class="field">
          <label>N 网 API 授权</label>
          <div class="field__row">
            <input v-model="nexusApiKey" :type="showKey ? 'text' : 'password'" placeholder="粘贴 Nexus Mods API Key"
              spellcheck="false" @change="saveSettings" />
            <button class="field__eye" :title="showKey ? '隐藏' : '显示'" @click="showKey = !showKey">
              <svg viewBox="0 0 1024 1024" width="16" height="16">
                <path v-if="showKey"
                  d="M512 192c-196 0-364 118-448 288 84 170 252 288 448 288s364-118 448-288c-84-170-252-288-448-288z m0 480a192 192 0 1 1 0-384 192 192 0 0 1 0 384z m0-96a96 96 0 1 0 0-192 96 96 0 0 0 0 192z" />
                <path v-else
                  d="M128 512c84 170 252 288 448 288 84 0 162-22 229-60l-70-70a192 192 0 0 1-253-253l-70-70c-38 67-60 145-60 229zM512 224c-84 0-162 22-229 60l70 70a192 192 0 0 1 253 253l70 70c38-67 60-145 60-229-84-170-252-288-448-288z" />
              </svg>
            </button>
          </div>
          <div class="field__hint">仅本地保存，用于后续接入 Nexus Mods 接口</div>
        </div>
      </section>

      <!-- 关于 -->
      <section :ref="setSection('about')" class="block glass">
        <div class="block__title">关于</div>
        <div class="about">
          <div class="about__row">
            <span class="about__key">应用名</span>
            <span class="about__val">{{ appInfo.name || '—' }}</span>
          </div>
          <div class="about__row">
            <span class="about__key">版本</span>
            <span class="about__val">{{ appInfo.version || '—' }}</span>
          </div>
          <div class="about__row">
            <span class="about__key">作者</span>
            <span class="about__val">{{ appInfo.author || '—' }}</span>
          </div>
          <div class="about__row about__row--intro">
            <span class="about__key">简介</span>
            <span class="about__val">{{ appInfo.description || '—' }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import axios from 'axios'
import { useSettingStore } from '@/stores/setting'

const sections = [
  { key: 'general', label: '常规' },
  { key: 'appearance', label: '外观' },
  { key: 'game', label: '游戏 & 数据' },
  { key: 'about', label: '关于' }
]

const settingStore = useSettingStore()
const { theme, background, hasCustom, minimizeToTray, nexusApiKey, defaultBgUrl, customBgUrl } = storeToRefs(settingStore)
const { setBackground, uploadBackground, removeBackground, saveSettings } = settingStore

const scrollRef = ref(null)
const showKey = ref(false)
const appInfo = ref({ name: '', version: '', author: '', description: '' })
const activeIndex = ref(0)
// 程序滚动期间暂停滚动监听，否则点「关于」时左侧会先闪回中间项
const syncing = ref(false)
// 程序滚动时想去的目标项：滚动期间锁住它，避免 observer 把高亮拽回中间
let targetIndex = -1
let syncTimer = null

// 收集各 section 的 DOM，offsetTop 用来算滚动目标
const sectionEls = new Map()
const setSection = (key) => (el) => {
  if (el) sectionEls.set(key, el)
}

const scrollTo = (i) => {
  const el = sectionEls.get(sections[i].key)
  if (!el) return
  activeIndex.value = i
  targetIndex = i
  syncing.value = true
  clearTimeout(syncTimer)
  scrollRef.value?.scrollTo({ top: el.offsetTop - 12, behavior: 'smooth' })
  // scrollend 不是所有环境都可靠，用定时兜底
  syncTimer = setTimeout(() => {
    syncing.value = false
    targetIndex = -1
  }, 600)
}

let observer = null

onMounted(async () => {
  // 右侧滚动 → 左侧高亮
  observer = new IntersectionObserver(
    (entries) => {
      if (syncing.value) {
        // 滚动途中 observer 会持续回调，锁住目标项；滚过了才放手
        if (targetIndex >= 0) activeIndex.value = targetIndex
        return
      }
      const visible = entries
        .filter((e) => e.isIntersecting)
        .map((e) => sections.findIndex((s) => s.key === e.target.dataset.section))
        .filter((i) => i >= 0)
      if (!visible.length) return
      activeIndex.value = Math.min(...visible)
    },
    {
      root: scrollRef.value,
      // 可视区上方 40% 作为判定带，避免「刚露头就高亮」
      rootMargin: '0px 0px -60% 0px',
      threshold: 0
    }
  )
  sectionEls.forEach((el, key) => {
    el.dataset.section = key
    observer.observe(el)
  })

  try {
    const res = await axios.get('/api/app-info')
    appInfo.value = res.data
  } catch {
    // 关于页拿不到就显示 —，不影响其他设置
  }
})

onUnmounted(() => {
  observer?.disconnect()
  clearTimeout(syncTimer)
})

// 「关于」内容短，永远进不了上 40% 判定带，滚到底时兜底点亮最后一项
const onScroll = () => {
  const el = scrollRef.value
  if (!el || syncing.value) return
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) {
    activeIndex.value = sections.length - 1
  }
}

const setTheme = async (value) => {
  theme.value = value
  await saveSettings()
}

const toggleMinimizeToTray = async () => {
  minimizeToTray.value = !minimizeToTray.value
  await saveSettings()
}

const pickBackground = async () => {
  const res = await axios.get('/api/dialog/file', { params: { type: 'image' } })
  const image = res.data.path
  if (!image) return
  await uploadBackground(image)
}

// 真删磁盘文件，删完自动切回默认壁纸（store 里处理）
const onRemoveBackground = async () => {
  await removeBackground()
}
</script>

<style scoped>
.setting {
  flex: 1;
  display: flex;
  gap: 12px;
  padding: 12px;
  min-width: 0;
  color: var(--text);
  overflow: hidden;
}

/* 左侧定位栏 */
.setting__nav {
  width: 150px;
  flex-shrink: 0;
  padding: 8px;
  height: 100%;
  box-sizing: border-box;
  overflow-y: auto;
}

.nav-item {
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-sub);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}

.nav-item:hover {
  background: var(--bg-hover);
}

.nav-item--active {
  background: var(--bg-hover);
  color: var(--accent);
  font-weight: 500;
}

/* 右侧内容区 */
.setting__content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding-right: 4px;
  scroll-behavior: smooth;
  /* 定位上下文：让 section 的 offsetTop 相对本容器计算 */
  position: relative;
}

.block {
  padding: 16px;
  margin-bottom: 12px;
}

.block:last-child {
  margin-bottom: 0;
}

.block__title {
  font-size: 14px;
  font-weight: 500;
  padding-bottom: 10px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--divider);
}

/* 通用行：左说明 + 右控件 */
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
}

.row+.row {
  border-top: 1px solid var(--divider);
}

.row__name {
  font-size: 13px;
}

.row__desc {
  font-size: 11px;
  color: var(--text-faint);
  margin-top: 3px;
}

.row__desc--top {
  margin: 0 0 10px;
}

/* 开关 */
.switch {
  width: 38px;
  height: 22px;
  flex-shrink: 0;
  padding: 0;
  border: 1px solid var(--inner-border);
  border-radius: 11px;
  background: var(--inner-bg);
  cursor: pointer;
  position: relative;
  transition: background-color 0.2s ease;
}

.switch--on {
  background: var(--accent);
  border-color: transparent;
}

.switch__dot {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s ease;
}

.switch--on .switch__dot {
  transform: translateX(16px);
}

/* 分段控件（亮/暗） */
.segment {
  display: flex;
  flex-shrink: 0;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: var(--inner-bg);
  border: 1px solid var(--inner-border);
}

.segment__item {
  padding: 4px 14px;
  font-size: 12px;
  color: var(--text-sub);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}

.segment__item:hover {
  background: var(--bg-hover);
}

.segment__item--active {
  background: var(--panel-bg);
  color: var(--text);
}

/* 背景卡片 */
.bg-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.bg-card {
  width: 200px;
  border-radius: 10px;
  border: 1px solid var(--inner-border);
  background: var(--inner-bg);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.bg-card--active {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.bg-card--empty {
  cursor: default;
}

.bg-card__preview {
  height: 100px;
  background: var(--card-bg);
}

.bg-card__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.bg-card__placeholder {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--text-faint);
  border-bottom: 1px dashed var(--inner-border);
}

.bg-card__foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
}

.bg-card__name {
  flex: 1;
  font-size: 12px;
}

.bg-card__tag {
  font-size: 10px;
  color: var(--text-faint);
}

.bg-card__upload,
.bg-card__del {
  padding: 3px 8px;
  font-size: 11px;
  color: var(--text-sub);
  background: var(--inner-bg);
  border: 1px solid var(--inner-border);
  border-radius: 6px;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}

.bg-card__upload:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.bg-card__del:hover:not(:disabled) {
  background: #e74f4f55;
  color: #fff;
}

.bg-card__del:disabled {
  color: var(--text-faint);
  cursor: not-allowed;
  opacity: 0.6;
}

.tip {
  display: inline-flex;
}

/* N 网 API */
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field label {
  font-size: 13px;
}

.field__row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.field__row input {
  flex: 1;
  min-width: 0;
  padding: 7px 10px;
  font-size: 12px;
  font-family: inherit;
  color: var(--text);
  background: var(--inner-bg);
  border: 1px solid var(--inner-border);
  border-radius: 8px;
  outline: none;
}

.field__row input:focus {
  border-color: var(--accent);
}

.field__eye {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-sub);
  background: var(--inner-bg);
  border: 1px solid var(--inner-border);
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.field__eye:hover {
  background: var(--bg-hover);
}

.field__eye svg {
  fill: currentColor;
}

.field__hint {
  font-size: 11px;
  color: var(--text-faint);
}

/* 关于 */
.about {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.about__row {
  display: flex;
  gap: 16px;
  font-size: 12px;
  line-height: 1.6;
}

.about__key {
  width: 56px;
  flex-shrink: 0;
  color: var(--text-sub);
}

.about__val {
  flex: 1;
  min-width: 0;
  color: var(--text);
  word-break: break-word;
}
</style>
