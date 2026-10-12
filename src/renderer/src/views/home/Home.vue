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
                    <span>{{ activeGame }}</span>
                </div>
            </div>
        </div>

        <!-- 游戏画廊 -->
        <div class="gallery glass-card">
            <div class="gallery__intro">
                <div class="gallery__title">
                    <span>游戏画廊</span>
                    <br>
                    <span class="title__sub">滑动画廊切换游戏，点击当前卡面可快速游玩；如果已经是当前游玩游戏，会直接进入模组管理。</span>
                </div>

                <div class="gallery__info">
                    <div class="info-card">{{ currentGame?.name }}</div>
                    <div class="info-card">
                        <span class="title__sub">模组总量 </span>
                        {{ currentGame?.modCount }}
                    </div>
                    <div class="info-card">
                        <span class="title__sub">已安装 </span>
                        0
                    </div>
                    <div class="info-card">
                        <span class="title__sub">未安装 </span>
                        {{ currentGame?.modCount }}
                    </div>
                </div>
            </div>

            <div class="gallery__list">
                <div class="game-card" v-for="(game, index) in games" :key="game.name" @click="currentIndex = index">
                    <img :src="game.cover" />
                    <span>{{ game.name }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { useGameStore } from '@/stores/game'
import { useSettingStore } from '@/stores/setting'
import { storeToRefs } from 'pinia'
import { onMounted } from 'vue'

const gameStore = useGameStore()
const { games, currentGame, currentIndex } = storeToRefs(gameStore)
const { fetchGames } = gameStore

const settingStore = useSettingStore()
const { activeGame } = storeToRefs(settingStore)
const { fetchSettings } = settingStore

onMounted(() => {
    fetchGames()
    fetchSettings()
})
</script>

<style scoped>
.home {
    flex: 1;
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
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: 12px;
    border: 1px solid var(--inner-border);
}

.game-card {
    gap: 6px;
    display: flex;
    align-items: center;
    flex-direction: column;
    width: 130px;
    height: 170px;
    cursor: pointer;
    font-size: 12px;
}

.game-card img {
    width: 100%;
    height: 100%;
    border-radius: 6px;
    object-fit: cover;
}

.title__sub {
    color: var(--text-sub);
    font-size: 10px;
    font-weight: 500;
}
</style>