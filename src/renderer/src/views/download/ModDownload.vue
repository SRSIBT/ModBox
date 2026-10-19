<template>
  <div class="dl">
    <!-- ① 标题栏：模组获取 + 当前激活游戏 -->
    <div class="dl__title glass-card">
      <span class="dl__title-text">模组获取</span>

      <div v-if="activeGame" class="game">
        <img v-if="!gameCoverError" class="game__cover" :src="activeGame.cover" :alt="activeGame.name"
          @error="gameCoverError = true" />
        <div v-else class="game__cover game__cover--ph">{{ activeGame.name?.[0] || '?' }}</div>

        <div class="game__info">
          <span class="game__name">{{ activeGame.name }}</span>
          <span class="game__domain">{{ nexusDomain }}</span>
        </div>
      </div>

      <div v-else class="game">
        <div class="game__cover game__cover--ph">?</div>
        <div class="game__info">
          <span class="game__name">未选择游戏</span>
          <span class="game__domain">请先在游戏管理中选择一个游戏</span>
        </div>
      </div>
    </div>

    <!-- ② 工具栏 -->
    <ModToolbar :sort="sort" :mod-id-keyword="modIdKeyword" :name-keyword="nameKeyword" :favorite-count="favoriteCount"
      :favorites-only="favoritesOnly" :disabled="!activeGameId" @update:sort="setSort"
      @update:mod-id-keyword="setModIdKeyword" @update:name-keyword="setNameKeyword"
      @toggle-favorites="toggleFavoritesOnly" @search="searchNow" @reset="resetFilter" />

    <!-- 错误提示（无 API Key / 限流 / 网络失败都走这里） -->
    <div v-if="error" class="dl__error">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5" />
        <path d="M12 16.5v.01" />
      </svg>
      <span>{{ error }}</span>
      <button @click="refresh()">重试</button>
    </div>

    <!-- ③ 模组卡片 -->
    <div class="dl__body">
      <div v-if="list.length" class="dl__grid">
        <ModCard v-for="mod in list" :key="mod.modId" :mod="mod" :favorite="favoriteSet.has(mod.modId)" :now="now"
          @toggle-favorite="toggleFavorite" @open="openMod" />
      </div>

      <!-- 首次加载：骨架屏，避免高度塌陷 -->
      <div v-else-if="loading" class="dl__grid">
        <div v-for="i in 8" :key="i" class="sk">
          <div class="sk__cover"></div>
          <div class="sk__line" style="width: 70%"></div>
          <div class="sk__line" style="width: 45%"></div>
          <div class="sk__line" style="width: 88%"></div>
          <div class="sk__line" style="width: 60%"></div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="dl__empty">
        <template v-if="!activeGameId">
          <p class="dl__empty-title">尚未选择游戏</p>
          <p class="dl__empty-desc">先在「游戏管理」里选择一个游戏，再回来获取模组</p>
        </template>
        <template v-else-if="favoritesOnly">
          <p class="dl__empty-title">本页没有收藏的模组</p>
          <p class="dl__empty-desc">继续翻页找找，或者先关掉「只看收藏」</p>
        </template>
        <template v-else>
          <p class="dl__empty-title">没有找到符合条件的模组</p>
          <p class="dl__empty-desc">换个关键词，或者重置筛选条件试试</p>
          <button class="dl__empty-btn" @click="resetFilter">重置筛选条件</button>
        </template>
      </div>
    </div>

    <!-- ④ 翻页栏 -->
    <Pager :total="total" :page="page" :page-size="pageSize" :disabled="loading" @update:page="setPage"
      @update:page-size="setPageSize" />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useNexusStore } from '@/stores/nexus'
import { useGameStore } from '@/stores/game'
import { useSettingStore } from '@/stores/setting'

import ModToolbar from './ModToolbar.vue'
import ModCard from './ModCard.vue'
import Pager from '../common/Pager.vue'

const nexusStore = useNexusStore()
const {
  activeGameId,
  sort,
  modIdKeyword,
  nameKeyword,
  favoritesOnly,
  page,
  pageSize,
  list,
  total,
  loading,
  error,
  favoriteCount,
  favoriteSet,
  now
} = storeToRefs(nexusStore)

const {
  setSort,
  setModIdKeyword,
  setNameKeyword,
  toggleFavoritesOnly,
  setPage,
  setPageSize,
  resetFilter,
  toggleFavorite,
  searchNow,
  refresh,
  startTick,
  stopTick
} = nexusStore

const gameStore = useGameStore()
const { activeGame } = storeToRefs(gameStore)
const { fetchGames } = gameStore

const settingStore = useSettingStore()
const { fetchSettings } = settingStore

const gameCoverError = ref(false)

// 展示用：game.json 里写了 nexusDomain 就用它，否则退回目录名小写
const nexusDomain = computed(() => {
  const game = activeGame.value
  if (!game) return ''
  return String(game.nexusDomain || game.id || '').toLowerCase()
})

const openMod = (mod) => {
  if (!mod?.url) return
  window.electronAPI.openExternal(mod.url)
}

onMounted(async () => {
  // 顺序要紧：activeGameId 就绪后，列表与收藏才有正确的游戏上下文
  await fetchSettings()
  await fetchGames()
  await refresh()
  startTick()
})

onUnmounted(stopTick)
</script>

<style scoped>
.dl {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  overflow: hidden;
}

/* ---------- ① 标题栏 ---------- */
.dl__title {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
}

.dl__title-text {
  font-size: 16px;
  font-weight: 500;
  color: var(--text);
}

.game {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.game__cover {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 6px;
  object-fit: cover;
  border: 1px solid var(--inner-border);
}

.game__cover--ph {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-sub);
  background: var(--inner-bg);
}

.game__info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.game__name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.game__domain {
  font-size: 10px;
  color: var(--text-faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---------- 错误条 ---------- */
.dl__error {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-size: 12px;
  color: #dc2626;
  border-radius: 10px;
  border: 1px solid rgba(220, 38, 38, 0.35);
  background: rgba(220, 38, 38, 0.12);
}

.dl__error svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.dl__error button {
  margin-left: auto;
  padding: 4px 12px;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid rgba(220, 38, 38, 0.5);
  background: transparent;
  color: #dc2626;
  cursor: pointer;
}

.dl__error button:hover {
  background: rgba(220, 38, 38, 0.18);
}

/* ---------- ③ 卡片区 ---------- */
.dl__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.dl__grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  /* 行高必须由卡片内容决定，否则会被容器高度反压成一条条细条 */
  grid-auto-rows: max-content;
  align-content: start;
  gap: 12px;
}

/* 骨架屏 */
.sk {
  border-radius: 10px;
  border: 1px solid var(--inner-border);
  background: var(--inner-bg);
  overflow: hidden;
  animation: sk 1.4s ease-in-out infinite;
}

.sk__cover {
  /* 与卡片封面一致：用 padding 撑 16:9，不用 aspect-ratio */
  padding-top: 56.25%;
  background: var(--bg-hover);
}

.sk__line {
  height: 9px;
  margin: 10px 10px 0;
  border-radius: 4px;
  background: var(--bg-hover);
}

.sk__line:last-child {
  margin-bottom: 12px;
}

@keyframes sk {

  0%,
  100% {
    opacity: 0.6;
  }

  50% {
    opacity: 1;
  }
}

/* 空状态 */
.dl__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--text-sub);
}

.dl__empty-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}

.dl__empty-desc {
  font-size: 12px;
}

.dl__empty-btn {
  margin-top: 8px;
  padding: 6px 16px;
  font-size: 12px;
  color: #fff;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  cursor: pointer;
  transition: filter 0.2s ease;
}

.dl__empty-btn:hover {
  filter: brightness(1.1);
}
</style>
