<template>
  <!-- 标题栏 -->
  <TitleBar />

  <div class="views">
    <!-- 导航栏 -->
    <NavBar :active="activeMenu" @change="activeMenu = $event" />

    <!--内容区 -->
    <component :is="views" @change-menu="activeMenu = $event" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import TitleBar from './views/TitleBar.vue'
import NavBar from './views/NavBar.vue'
import Home from './views/home/Home.vue'
import Game from './views/game/Game.vue'
import ModGanage from './views/mod/ModGanage.vue'
import ModDownload from './views/download/ModDownload.vue'
import DownloadList from './views/download/DownloadList.vue'
import SaveGame from './views/savegame/SaveGame.vue'
import Ai from './views/setting/Ai.vue'
import Account from './views/setting/Account.vue'
import About from './views/about/About.vue'
import Setting from './views/setting/Setting.vue'

const activeMenu = ref('home')
const menus = [
  { key: 'home', views: Home },
  { key: 'game', views: Game },
  { key: 'modGanage', views: ModGanage },
  { key: 'modDownload', views: ModDownload },
  { key: 'downloadList', views: DownloadList },
  { key: 'saveGame', views: SaveGame },
  { key: 'ai', views: Ai },
  { key: 'account', nviews: Account },
  { key: 'about', views: About },
  { key: 'setting', views: Setting }
]

const views = computed(() => {
  return menus.find(m => m.key === activeMenu.value)?.views
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

body {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.55)),
    url(/backgrounds/【哲风壁纸】AI-AI生成.png);
  background-size: cover;
  background-position: center;
}

:root.dark body {
  background-image:
    linear-gradient(rgba(10, 14, 18, 0.5), rgba(10, 14, 18, 0.5)),
    url(/backgrounds/【哲风壁纸】AI-AI生成.png);
  background-size: cover;
  background-position: center;
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
  --panel-bg: #EDEEF1;
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
  --accent: #03974F;

  /* 公告 */
  --notice-bg: #EDEEF1;
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
  --accent: #03974F;

  /* 公告 */
  --notice-bg: #ffffff0f;
  --notice-current-item: #ffffff14;
  --notice-current-item-border: #ffffff33;
  --notice-item-hover: #ffffff14;
  --notice-readall: #ffffff1a;
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
</style>