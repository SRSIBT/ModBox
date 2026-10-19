<template>
  <div class="tb glass">
    <div class="tb-title">
      <svg class="tb-title__logo" viewBox="0 0 1024 1024" version="1.1" p-id="10502">
        <path
          d="M864 307.2c-19.2-38.4-89.6-44.8-192-19.2-44.8-38.4-96-51.2-153.6-51.2-153.6 0-281.6 121.6-281.6 275.2v6.4c-70.4 70.4-96 128-76.8 166.4 12.8 25.6 44.8 38.4 89.6 38.4 19.2 0 38.4 0 64-6.4h12.8c51.2 44.8 115.2 76.8 192 76.8 153.6 0 275.2-121.6 275.2-275.2 0-12.8 0-32-6.4-44.8 70.4-70.4 96-128 76.8-166.4z m-345.6-38.4c121.6 0 224 89.6 236.8 204.8-19.2 12.8-38.4 32-57.6 44.8-6.4-6.4-19.2-12.8-32-12.8-25.6 0-44.8 19.2-44.8 44.8 0 6.4 0 12.8 6.4 19.2-19.2 12.8-38.4 19.2-57.6 32-76.8 38.4-153.6 70.4-217.6 89.6-51.2-44.8-76.8-108.8-76.8-179.2 0-134.4 108.8-243.2 243.2-243.2z m-345.6 409.6c-12.8-25.6 6.4-76.8 64-134.4 6.4 57.6 32 115.2 70.4 153.6-70.4 12.8-115.2 6.4-134.4-19.2z m345.6 76.8c-57.6 0-108.8-19.2-147.2-51.2 64-19.2 140.8-44.8 211.2-89.6 19.2-12.8 38.4-19.2 57.6-32 6.4 6.4 19.2 12.8 32 12.8 25.6 0 44.8-19.2 44.8-44.8v-19.2c19.2-12.8 32-25.6 51.2-38.4V512c-12.8 134.4-121.6 243.2-249.6 243.2zM787.2 448c-19.2-64-51.2-115.2-96-153.6 83.2-19.2 140.8-12.8 160 19.2 12.8 25.6-12.8 76.8-64 134.4z"
          p-id="10503"></path>
      </svg>
      <span class="tb-title__name">ModBox</span>
      <div class="tb-title__version">v0.0.3</div>
    </div>

    <div class="tb-buttons">
      <!-- 公告栏 -->
      <button @click="toggleNotice">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"
          stroke-linejoin="round">
          <path d="M8 2a4 4 0 0 0-4 4v2.5L2.5 10.5h11L12 8.5V6a4 4 0 0 0-4-4z" />
          <path d="M6.5 12.5a1.5 1.5 0 0 0 3 0" />
        </svg>
        <span v-if="unreadCount > 0" class="badge">
          {{ unreadCount > 99 ? '99+' : unreadCount }}
        </span>
      </button>

      <!-- 主题切换 -->
      <button @click="toggleTheme">
        <svg v-if="theme !== 'dark'" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z" />
        </svg>
        <svg v-else viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round">
          <circle cx="8" cy="8" r="3" />
          <line x1="8" y1="1.5" x2="8" y2="3" />
          <line x1="8" y1="13" x2="8" y2="14.5" />
          <line x1="1.5" y1="8" x2="3" y2="8" />
          <line x1="13" y1="8" x2="14.5" y2="8" />
          <line x1="3.4" y1="3.4" x2="4.5" y2="4.5" />
          <line x1="11.5" y1="11.5" x2="12.6" y2="12.6" />
          <line x1="12.6" y1="3.4" x2="11.5" y2="4.5" />
          <line x1="4.5" y1="11.5" x2="3.4" y2="12.6" />
        </svg>
      </button>

      <!-- 分隔线 -->
      <div class="tb-buttons__divider"></div>

      <!-- 窗口按钮 -->
      <button @click="minimize">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">
          <line x1="3" y1="8" x2="13" y2="8" />
        </svg>
      </button>
      <button @click="maximize">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">
          <rect x="4" y="4" width="8" height="8" rx="1" />
        </svg>
      </button>
      <button @click="close" class="close">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">
          <line x1="4" y1="4" x2="12" y2="12" />
          <line x1="12" y1="4" x2="4" y2="12" />
        </svg>
      </button>
    </div>
  </div>

  <!-- 公告栏 -->
  <Notice v-model:visible="noticeVisible" />
</template>

<script setup>
import { storeToRefs } from 'pinia'
import { ref, watchEffect } from 'vue'
import { useNoticeStore } from '@/stores/notices'
import { useSettingStore } from '@/stores/setting'
import Notice from './notive/Notice.vue'

// 解构方法（不需要 storeToRefs）
const noticeStore = useNoticeStore()
const { unreadCount } = storeToRefs(noticeStore)

const settingStore = useSettingStore()
const { theme } = storeToRefs(settingStore)
const { saveSettings } = settingStore

const noticeVisible = ref(false)

const minimize = () => window.windowAPI.minimize()
const maximize = () => window.windowAPI.maximize()
const close = () => window.windowAPI.close()

const toggleNotice = () => {
  noticeVisible.value = !noticeVisible.value
}

const toggleTheme = () => {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  saveSettings()
}

// theme 变化时同步到 :root.dark，供全局 CSS 变量使用
watchEffect(() => {
  document.documentElement.classList.toggle('dark', theme.value === 'dark')
})
</script>

<style scoped>
.tb {
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  border-radius: 0;
  color: var(--text);
  -webkit-app-region: drag;
  user-select: none;
  z-index: 100;
}

.tb-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}

.tb-title__logo {
  width: 32px;
  height: 32px;
  fill: currentColor;
  stroke: none;
}

.tb-title__version {
  padding: 0 8px;
  font-size: 8px;
  border-radius: 10px;
  border: 1px solid var(--panel-border);
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(2px);
}

.tb-title__logo,
.tb-title__name,
.tb-title__version {
  line-height: 20px;
}

.tb-buttons {
  display: flex;
  align-items: center;
}

.tb-buttons__divider {
  margin: 0 3px;
  position: relative;
}

.tb-buttons__divider::before {
  content: ' ';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 1px;
  height: 20px;
  background: var(--divider);
}

.tb-buttons button {
  -webkit-app-region: no-drag;
  width: 32px;
  height: 32px;
  margin: 0 4px;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: var(--text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

.tb-buttons button:nth-child(1) {
  position: relative;
}

.badge {
  position: absolute;
  top: 2px;
  right: 2px;
  padding: 0 4px;
  background: #ef2020;
  color: #fff;
  font-size: 9px;
  line-height: 14px;
  text-align: center;
  border-radius: 7px;
}

.tb-buttons button svg {
  width: 14px;
  height: 14px;
  display: block;
}

.tb-buttons button:hover {
  background: var(--bg-hover);
}

.tb .close:hover {
  color: #fff;
  background: #e81123;
}
</style>
