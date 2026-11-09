<template>
  <div id="app-root">
    <!-- 天气画布 -->
    <canvas ref="weatherCanvas" class="global-weather"></canvas>

    <!-- 标题栏 -->
    <TitleBar />

    <!-- 主体 -->
    <div class="app-main">
      <!-- 左侧导航 -->
      <NavBar :active="activeMenu" @change="activeMenu = $event" />

      <!-- 右侧内容 -->
      <Transition name="dialog" mode="out-in">
        <component :is="views" :key="views?.name || views" @change-menu="activeMenu = $event" />
      </Transition>
    </div>

    <!-- 提示框 -->
    <Toast />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useSettingStore } from '@/stores/setting'
import { useWeather } from '@/stores/weather'
import Toast from './views/common/Toast.vue'
import TitleBar from './views/TitleBar.vue'
import NavBar from './views/NavBar.vue'
import Home from './views/home/Home.vue'
import Game from './views/game/Game.vue'
import Mod from './views/mod/Mods.vue'
import Setting from './views/setting/Setting.vue'

const activeMenu = ref('home')
const weatherCanvas = ref(null)
const menus = [
  { key: 'home', views: Home },
  { key: 'game', views: Game },
  { key: 'mod', views: Mod },
  { key: 'setting', views: Setting }
]

const views = computed(() => {
  return menus.find((m) => m.key === activeMenu.value)?.views
})

const settingStore = useSettingStore()
const { weather } = storeToRefs(settingStore)
const { fetchSettings } = settingStore

// 全局天气特效
useWeather(weatherCanvas, weather)

onMounted(() => {
  fetchSettings()
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
}

/*------------------- 根元素 -------------------*/
html,
body,
#app {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

#app-root {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/*------------------- 天气画布 -------------------*/
.global-weather {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  /* 垫在最底层，且绝对不能挡住鼠标操作 */
  pointer-events: none;
}

/*------------------- 主体 -------------------*/
.app-main {
  position: relative;
  z-index: 10;
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

/*------------------- 通用样式类 -------------------*/
.glass {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border-radius: 12px;
}

.glass-inner {
  background: var(--inner-bg);
  border: 1px solid var(--inner-border);
  border-radius: 10px;
}

.glass-card {
  background: var(--card-bg);
  border: 1px solid var(--panel-border);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border-radius: 12px;
}

.glass-title {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--divider);
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}

/*------------------- 主题变量 -------------------*/
:root {
  /* 面板 */
  --panel-bg: #edeef1;
  --card-bg: #edeef15f;
  --panel-border: #0000001f;

  /* 内层（输入框、卡片） */
  --inner-bg: #ffffff5f;
  --inner-border: #00000014;

  /* 分隔线 */
  --divider: #0000000f;

  /* 滚动条 */
  --scrollbar: #99999980;

  /* 文字（三档） */
  --text: #1a1a1a;
  --text-sub: #6a6a6a;
  --text-faint: #999999;

  /* 交互 */
  --bg-hover: #0000001f;
  --accent: #03974f;

  /* 状态语义色 */
  --success: #03974f;
  --success-soft: rgba(3, 151, 79, 0.12);
  --warning: #d97706;
  --warning-soft: rgba(217, 119, 6, 0.12);
  --danger: #dc2626;
  --danger-soft: rgba(220, 38, 38, 0.12);

  /* 公告 */
  --notice-current-item: #e3e5ea98;
  --notice-current-item-border: #c8ccd4;
  --notice-item-hover: #ffffff1f;
  --notice-readall: #e3e5ea;
}

:root.dark {
  /* 面板 */
  --panel-bg: #ffffff1f;
  --card-bg: #ffffff0f;
  --panel-border: #ffffff1f;

  /* 内层 */
  --inner-bg: #ffffff1f;
  --inner-border: #ffffff1f;

  /* 分隔线 */
  --divider: #ffffff12;

  /* 滚动条 */
  --scrollbar: #ffffff40;

  /* 文字（三档） */
  --text: #ffffff;
  --text-sub: #b0b0b0;
  --text-faint: #707070;

  /* 交互 */
  --bg-hover: #ffffff2f;
  --accent: #03974f;

  /* 状态语义色 */
  --success: #34d399;
  --success-soft: rgba(52, 211, 153, 0.16);
  --warning: #fbbf24;
  --warning-soft: rgba(251, 191, 36, 0.16);
  --danger: #f87171;
  --danger-soft: rgba(248, 113, 113, 0.16);

  /* 公告 */
  --notice-current-item: #ffffff14;
  --notice-current-item-border: #ffffff33;
  --notice-item-hover: #ffffff14;
  --notice-readall: #ffffff1a;
}

/*------------------- 背景透明度 -------------------*/
:root.bg--default body,
:root.bg--custom body {
  background-image:
    linear-gradient(rgba(255, 255, 255, var(--bg-overlay-opacity)),
      rgba(255, 255, 255, var(--bg-overlay-opacity))),
    var(--bg-default-img, none);
  background-size: cover;
  background-position: center;
}

:root.dark.bg--default body,
:root.dark.bg--custom body {
  background-image:
    linear-gradient(rgba(10, 14, 18, var(--bg-overlay-opacity)),
      rgba(10, 14, 18, var(--bg-overlay-opacity))),
    var(--bg-default-img, none);
  background-size: cover;
  background-position: center;
}

:root.bg--custom body {
  background-image:
    linear-gradient(rgba(255, 255, 255, var(--bg-overlay-opacity)),
      rgba(255, 255, 255, var(--bg-overlay-opacity))),
    var(--bg-custom-img, none);
}

:root.dark.bg--custom body {
  background-image:
    linear-gradient(rgba(10, 14, 18, var(--bg-overlay-opacity)),
      rgba(10, 14, 18, var(--bg-overlay-opacity))),
    var(--bg-custom-img, none);
}

/*------------------- 全局滚动条 -------------------*/
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-corner {
  background: var(--scrollbar);
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--scrollbar);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-sub);
}

/*------------------- 全局组件动画 -------------------*/
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.4s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
</style>
