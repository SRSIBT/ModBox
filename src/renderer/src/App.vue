<template>
  <!-- 标题栏 -->
  <TitleBar />

  <div class="views">
    <!-- 导航栏 -->
    <NavBar :active="activeMenu" @change="activeMenu = $event" />

    <!--内容区 -->
    <Transition name="dialog" mode="out-in">
      <component :is="views" :key="views?.name || views" @change-menu="activeMenu = $event" />
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDownloadStore } from '@/stores/download'
import TitleBar from './views/TitleBar.vue'
import NavBar from './views/NavBar.vue'
import Home from './views/home/Home.vue'
import Game from './views/game/Game.vue'
import ModGanage from './views/mod/ModGanage.vue'
import ModDownload from './views/download/ModDownload.vue'
import DownloadList from './views/download/DownloadList.vue'
import Setting from './views/setting/Setting.vue'

const activeMenu = ref('home')
const menus = [
  { key: 'home', views: Home },
  { key: 'game', views: Game },
  { key: 'modGanage', views: ModGanage },
  { key: 'modDownload', views: ModDownload },
  { key: 'downloadList', views: DownloadList },
  { key: 'setting', views: Setting }
]

const views = computed(() => {
  return menus.find((m) => m.key === activeMenu.value)?.views
})

// 下载订阅必须挂在应用级：下载列表页切走就卸载了，
// 但主进程还在下，进度也得继续进 store。
const downloadStore = useDownloadStore()
const { focusRequest } = storeToRefs(downloadStore)
downloadStore.initBridge()

// 收到 nxm 链接时自动切到下载列表
watch(focusRequest, () => {
  activeMenu.value = 'downloadList'
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
}

html,
body,
#app {
  height: 100%;
  overflow: hidden;
}

#app {
  display: flex;
  flex-direction: column;
}

.views {
  flex: 1;
  display: flex;
  justify-content: space-between;
  overflow: hidden;
}

/* 通用样式类 */
.glass {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  backdrop-filter: var(--panel-blur);
  -webkit-backdrop-filter: var(--panel-blur);
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
  backdrop-filter: var(--panel-blur);
  -webkit-backdrop-filter: var(--panel-blur);
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

/* 设计变量 */
:root {
  /* 面板 */
  --panel-bg: #edeef1;
  --card-bg: #edeef15f;
  --panel-border: #0000001f;
  --panel-blur: none;

  /* 内层（输入框、卡片） */
  --inner-bg: #ffffff5f;
  --inner-border: #00000014;

  /* 分隔线 */
  --divider: #0000000f;

  --scrollbar: #99999980;

  /* 文字（三档） */
  --text: #1a1a1a;
  --text-sub: #6a6a6a;
  --text-faint: #999999;

  /* 交互 */
  --bg-hover: #0000001f;
  --accent: #03974f;

  /* 状态语义色：下载中/完成/失败等需要区分的状态统一走这里，不要在组件里写死色值 */
  --success: #03974f;
  --success-soft: rgba(3, 151, 79, 0.12);
  --warning: #d97706;
  --warning-soft: rgba(217, 119, 6, 0.12);
  --danger: #dc2626;
  --danger-soft: rgba(220, 38, 38, 0.12);

  /* 公告 */
  --notice-bg: #edeef1;
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
  --panel-blur: none;

  /* 内层 */
  --inner-bg: #ffffff1f;
  --inner-border: #ffffff1f;

  /* 分隔线 */
  --divider: #ffffff12;

  --scrollbar: #ffffff40;

  /* 文字（三档） */
  --text: #ffffff;
  --text-sub: #b0b0b0;
  --text-faint: #707070;

  /* 交互 */
  --bg-hover: #ffffff2f;
  --accent: #03974f;

  /* 状态语义色：暗色下要提亮，否则深色背景上对比度不够 */
  --success: #34d399;
  --success-soft: rgba(52, 211, 153, 0.16);
  --warning: #fbbf24;
  --warning-soft: rgba(251, 191, 36, 0.16);
  --danger: #f87171;
  --danger-soft: rgba(248, 113, 113, 0.16);

  /* 公告 */
  --notice-bg: #ffffff0f;
  --notice-current-item: #ffffff14;
  --notice-current-item-border: #ffffff33;
  --notice-item-hover: #ffffff14;
  --notice-readall: #ffffff1a;
}

:root.bg--default body,
:root.bg--custom body {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.55)),
    var(--bg-default-img, none);
  background-size: cover;
  background-position: center;
}

:root.dark.bg--default body,
:root.dark.bg--custom body {
  background-image:
    linear-gradient(rgba(10, 14, 18, 0.5), rgba(10, 14, 18, 0.5)),
    var(--bg-default-img, none);
  background-size: cover;
  background-position: center;
}

:root.bg--custom body {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.55)),
    var(--bg-custom-img, none);
}

:root.dark.bg--custom body {
  background-image:
    linear-gradient(rgba(10, 14, 18, 0.5), rgba(10, 14, 18, 0.5)),
    var(--bg-custom-img, none);
}

/* 全局滚动条 */
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

/* 全局组件动画 */
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.4s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-active .notice,
.dialog-leave-active .notice {
  transition: transform 0.4s ease;
}

.dialog-enter-from .notice,
.dialog-leave-to .notice {
  transform: scale(0.95);
}
</style>
