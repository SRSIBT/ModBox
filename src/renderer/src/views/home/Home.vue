<template>
  <div class="home">
    <!-- 欢迎卡片 -->
    <div class="welcome glass-card">
      <div class="title__sub">SRS</div>
      <div class="welcome__title">欢迎回家 铁驭</div>
      <div class="title__sub">今天过得怎么样，想玩点什么嘛...</div>
      <div class="welcome__card">
        <div>
          <span class="title__sub">已加入游戏</span>
          <span>{{ games.length }}</span>
        </div>
        <div>
          <span class="title__sub">当前激活</span>
          <span>{{ activeGame?.name || '未选择' }}</span>
        </div>
      </div>
    </div>

    <!-- 游戏画廊 -->
    <div class="gallery glass-card">
      <div class="gallery__intro">
        <div class="gallery__title">
          <span>游戏画廊</span>
          <br />
          <span class="title__sub">滚轮或点击切换游戏，点击当前卡片可快速激活；如果已经是当前激活游戏，会直接进入模组管理。</span>
        </div>

        <div class="gallery__info">
          <div class="info-card">{{ currentGame?.name }}</div>
          <div class="info-card">
            <span class="title__sub">模组总量 </span>
            {{ totalCount }}
          </div>
          <div class="info-card">
            <span class="title__sub">已安装 </span>
            {{ installedCount }}
          </div>
          <div class="info-card">
            <span class="title__sub">未安装 </span>
            {{ uninstalledCount }}
          </div>
        </div>
      </div>

      <div class="gallery__list">
        <div class="gallery__orbit">
          <ArcWheel :items="games" @change="onOrbitChange" @card-click="onCardClick">
            <template #default="{ item }">
              <div class="game-card">
                <div class="game-card__cover">
                  <img :src="item.cover" :alt="item.name" />
                </div>
                <div class="game-card__name">{{ item.name }}</div>
              </div>
            </template>
          </ArcWheel>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useModStore } from '@/stores/mod'
import { useGameStore } from '@/stores/game'
import { useSettingStore } from '@/stores/setting'
import ArcWheel from './ArcWheel.vue'

const gameStore = useGameStore()
const { games, currentGame, currentId, activeGame } = storeToRefs(gameStore)
const { fetchGames } = gameStore

const settingStore = useSettingStore()
const { fetchSettings, saveSettings } = settingStore
const { activeGameId } = storeToRefs(settingStore)

const modStore = useModStore()
const { totalCount, installedCount, uninstalledCount } = storeToRefs(modStore)
const { fetchMods } = modStore

const emit = defineEmits(['change-menu'])

// 滚轮滑动卡片
function onOrbitChange({ item }) {
  if (item) currentId.value = item.id
}

// 点击切换卡片
async function onCardClick({ item, centered }) {
  if (!centered) return
  currentId.value = item.id
  if (activeGameId.value === item.id) {
    emit('change-menu', 'modGanage')
  } else {
    activeGameId.value = item.id
    await saveSettings()
    await fetchMods()
  }
}

onMounted(async () => {
  await fetchSettings()
  fetchGames()
  fetchMods()
})
</script>

<style scoped>
.home {
  flex: 1;
  min-width: 0;
  gap: 12px;
  display: flex;
  flex-direction: column;
  padding: 12px;
}

.welcome {
  color: var(--text);
  padding: 6px;
}

.welcome .welcome__title {
  padding-bottom: 4px;
  font-size: 24px;
  font-weight: 900;
  letter-spacing: 2px;
}

.welcome .welcome__card {
  gap: 12px;
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: left;
}

.welcome__card div {
  min-width: 80px;
  min-height: 42px;
  font-weight: 600;
  padding: 6px 12px;
  display: flex;
  gap: 4px;
  flex-direction: column;
  border-radius: 12px;
  border: 1px solid var(--inner-border);
}

.gallery {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  color: var(--text);
  padding: 12px;
}

.gallery__intro {
  padding: 6px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.gallery__title {
  line-height: 1.1;
  font-weight: 600;
}

.gallery__info {
  gap: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.info-card {
  font-size: 10px;
  padding: 6px;
  border-radius: 12px;
  border: 1px solid var(--inner-border);
}

.gallery__list {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid var(--inner-border);
}

/* 轮盘容器 */
.gallery__orbit {
  width: 100%;
  height: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.game-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  filter: brightness(calc(1 - 0.35 * var(--arc-k, 0) + 0.1 * var(--arc-near, 0)));
}

.game-card__cover {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border-radius: 8px;
  background: var(--inner-bg);
  box-shadow:
    0 0 calc(4px + var(--arc-near, 0) * 26px) rgba(3, 151, 79, calc(var(--arc-near, 0) * 0.75)),
    0 0 0 calc(var(--arc-near, 0) * 2px) rgba(3, 151, 79, calc(var(--arc-near, 0) * 0.9)),
    0 6px 18px rgba(0, 0, 0, 0.35);
}

.game-card__cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.game-card__name {
  flex: 0 0 auto;
  height: 26px;
  line-height: 26px;
  padding: 0 2px;
  text-align: center;
  font-size: 12px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.title__sub {
  color: var(--text-sub);
  font-size: 10px;
  font-weight: 500;
}
</style>
