<template>
  <div class="game">
    <div class="gameList glass-card">
      <div class="gameList__title">
        <span>选择游戏</span>
        <span>{{ games.length }}</span>
      </div>
      <div class="gameList__card">
        <div class="card" :class="{ 'card--active': currentId === game.id }" v-for="game in sortedGames" :key="game.id"
          @click="currentId = game.id">
          <img :src="game.cover" />
          <span class="current--actice" v-if="activeGameId === game.id">当前激活</span>
          <span>{{ game.name }}</span>
        </div>
      </div>
    </div>

    <div class="gameSetting glass-card">
      <div class="gameSetting__title">
        <span>游戏设置</span>
        <span>{{ currentGame?.name ?? '未选择游戏' }}</span>
      </div>

      <div class="gameSetting__tool">
        <button @click="handleActivate">{{ isActive ? '进入 Mod管理' : '激活当前游戏' }}</button>
        <button :disabled="isSaving" @click="handleSave">
          {{ saveStatus }}
        </button>
        <button @click="showDeleteConfirm = true">删除游戏</button>
      </div>

      <div class="gameSetting__root">
        <div class="field">
          <div class="field__info">
            <div class="field__title">游戏根目录</div>
            <div class="field__sub">游戏的安装根目录，通常包含游戏的主要文件</div>
          </div>
          <div class="field__control">
            <input class="field__input" v-model="gamePath" type="text" placeholder="请选择游戏根目录" />
            <button class="field__btn" @click="handleBrowseRoot">
              <svg viewBox="0 0 1026 1024" version="1.1" p-id="7491">
                <path
                  d="M950.857143 394.971429l-124.342857 438.857142c-7.314286 21.942857-36.571429 43.885714-58.514286 43.885715h-658.285714c-7.314286 0-14.628571 0-21.942857-7.314286 0-7.314286-7.314286-14.628571 0-21.942857l124.342857-438.857143c7.314286-21.942857 36.571429-43.885714 58.514285-43.885714h658.285715c7.314286 0 14.628571 0 14.628571 7.314285 7.314286 0 7.314286 7.314286 7.314286 21.942858zM73.142857 109.714286c0-21.942857 14.628571-36.571429 36.571429-36.571429h234.057143l65.828571 124.342857c0 14.628571 14.628571 21.942857 29.257143 21.942857h402.285714c21.942857 0 36.571429 14.628571 36.571429 36.571429V292.571429H270.628571C219.428571 292.571429 160.914286 336.457143 146.285714 394.971429L73.142857 643.657143V109.714286z m936.228572 219.428571c-14.628571-21.942857-36.571429-29.257143-58.514286-36.571428v-36.571429c0-58.514286-51.2-109.714286-109.714286-109.714286H460.8L394.971429 21.942857C394.971429 7.314286 380.342857 0 365.714286 0H109.714286C51.2 0 0 51.2 0 109.714286v731.428571c0 36.571429 21.942857 73.142857 43.885714 87.771429h7.314286c14.628571 14.628571 36.571429 21.942857 58.514286 21.942857h658.285714c58.514286 0 109.714286-43.885714 131.657143-102.4l124.342857-438.857143c7.314286-29.257143 0-58.514286-14.628571-80.457143z"
                  p-id="7492"></path>
              </svg>
            </button>
          </div>
        </div>

        <div class="field">
          <div class="field__info">
            <div class="field__title">游戏执行程序</div>
            <div class="field__sub">游戏的主执行文件(.exe)，用于启动游戏</div>
          </div>
          <div class="field__control">
            <input class="field__input" v-model="gameExe" type="text" placeholder="请选择游戏执行程序" />
            <button class="field__btn" @click="handleBrowseExe">
              <svg viewBox="0 0 1024 1024" version="1.1" p-id="8643">
                <path
                  d="M53.039687 176.551724 375.098244 176.551724C374.484286 176.551724 473.585858 291.710552 473.585858 291.710552 486.581177 307.112413 509.433838 317.793103 529.530968 317.793103L971.158687 317.793103C961.315964 317.793103 953.37931 309.775113 953.37931 300.309822L953.37931 882.58673C953.37931 872.955622 961.207896 865.103448 970.914322 865.103448L53.085678 865.103448C62.785907 865.103448 70.62069 872.915968 70.62069 882.765489L70.62069 158.889684C70.62069 168.590089 62.665481 176.551724 53.039687 176.551724ZM0 882.765489C0 911.963754 23.828092 935.724138 53.085678 935.724138L970.914322 935.724138C1000.258278 935.724138 1024 911.910877 1024 882.58673L1024 300.309822C1024 270.932674 1000.480803 247.172414 971.158687 247.172414L529.530968 247.172414C530.299604 247.172414 431.241728 132.013586 431.241728 132.013586 418.224358 116.585578 395.290394 105.931034 375.098244 105.931034L53.039687 105.931034C23.649986 105.931034 0 129.600124 0 158.889684L0 882.765489Z"
                  p-id="8644"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div class="gameSetting__rules"></div>
    </div>

    <ConfirmDialog :visible="showDeleteConfirm" :title="currentGame?.name" @confirm="handleDelete"
      @cancel="showDeleteConfirm = false" />
  </div>
</template>

<script setup>
import { storeToRefs } from 'pinia'
import { useGameStore } from '@/stores/game'
import { useSettingStore } from '@/stores/setting'
import { ref, watch, computed, onMounted } from 'vue'
import ConfirmDialog from '../common/ConfirmDialog.vue'

const gameStore = useGameStore()
const { games, currentGame, currentId } = storeToRefs(gameStore)
const { fetchGames, updateGame, deleteGame, browseRoot, browseExe } = gameStore

const settingStore = useSettingStore()
const { activeGameId } = storeToRefs(settingStore)
const { fetchSettings, saveSettings } = settingStore

const gamePath = ref('')
const gameExe = ref('')
const isSaving = ref(false)
const saveStatus = ref('保存配置')
const showDeleteConfirm = ref(false)

const isActive = computed(() => {
  // 当前选中的游戏，是不是"已激活"的
  return !!activeGameId.value && activeGameId.value === currentGame.value?.id
})

// 排序，当前激活排在前
const sortedGames = computed(() => {
  const active = activeGameId.value
  return [...games.value].sort((a, b) => {
    if (a.id === active) return -1
    if (b.id === active) return 1
    return 0
  })
})

const emit = defineEmits(['change-menu'])

// 激活游戏
const handleActivate = async () => {
  if (!isActive.value) {
    // 不是激活的，设为激活
    activeGameId.value = currentGame.value?.id || ''
    await saveSettings()
  } else {
    // 已经是激活的，跳模组管理
    emit('change-menu', 'modGanage')
  }
}

// 删除游戏
const handleDelete = async () => {
  await deleteGame()
  await fetchSettings()
  showDeleteConfirm.value = false
}

// 获取游戏根目录
const handleBrowseRoot = async () => {
  const path = await browseRoot()
  if (path) gamePath.value = path
}

// 获取游戏 exe 执行文件
const handleBrowseExe = async () => {
  const path = await browseExe()
  if (path) gameExe.value = path
}

// 保存游戏
const handleSave = async () => {
  isSaving.value = true

  try {
    await updateGame(gamePath.value, gameExe.value)
    saveStatus.value = '保存成功'

    setTimeout(() => {
      saveStatus.value = '保存配置'
      isSaving.value = false
    }, 3000)
  } catch (e) {
    console.error(e)
    saveStatus.value = '保存失败'
    setTimeout(() => {
      saveStatus.value = '保存配置'
      isSaving.value = false
    }, 3000)
  }
}

// 实时显示游戏配置信息
watch(currentGame, (game) => {
  gamePath.value = game?.rootPath || ''
  gameExe.value = game?.exePath || ''
})

onMounted(() => {
  fetchGames()
  fetchSettings()
  currentId.value = activeGameId.value || ''
})
</script>

<style scoped>
.game {
  flex: 1;
  gap: 12px;
  padding: 16px;
  display: flex;
  color: var(--text);
  overflow: hidden;
}

/* ========== 左侧游戏列表 ========== */
.gameList {
  width: 50%;
  gap: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.gameList__title {
  gap: 6px;
  display: flex;
  align-items: center;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--divider);
}

.gameList__title span:nth-child(1) {
  font-size: 14px;
  font-weight: 500;
}

.gameList__title span:nth-child(2) {
  color: #015e2c;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 500;
  border-radius: 12px;
  background: #c0d6c7;
  border: 1px solid #67986b;
}

.gameList__card {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(2, 200px);
  justify-content: center;
  gap: 20px;
  align-content: flex-start;
  padding: 8px;
}

.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  border-radius: 8px;
  padding: 8px;
  background: var(--inner-bg);
  transition: box-shadow 0.2s ease;
}

.card:not(.card--active):hover {
  box-shadow: 0 0px 6px #03974f;
}

.card img {
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: 6px;
  object-fit: cover;
  display: block;
}

.card span {
  padding-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card--active {
  box-shadow: 0 0 0 2px var(--accent);
}

.card .current--actice {
  color: #fff;
  position: absolute;
  font-size: 10px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 12px;
  background: #4caf50;
}

/* ========== 右侧游戏设置 ========== */
.gameSetting {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  overflow: hidden;
}

.gameSetting__title {
  gap: 12px;
  display: flex;
  align-items: center;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--divider);
}

.gameSetting__title span:nth-child(1) {
  font-size: 14px;
  font-weight: 500;
}

.gameSetting__title span:nth-child(2) {
  font-size: 12px;
  color: var(--text-sub);
}

/* ---- 工具按钮 ---- */
.gameSetting__tool {
  display: flex;
  gap: 8px;
}

.gameSetting__tool button {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
  cursor: pointer;
  border-radius: 12px;
  border: 1px solid var(--panel-border);
  background: none;
  transition:
    transform 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease;
}

.gameSetting__tool button:hover {
  box-shadow: 0 0 0 1px currentColor;
}

/* 选择该游戏 —— 绿 */
.gameSetting__tool button:nth-child(1) {
  color: #16a34a;
  border-color: #16a34a55;
}

.gameSetting__tool button:nth-child(1):hover {
  background: #16a34a1a;
}

/* 删除游戏 —— 红 */
.gameSetting__tool button:nth-child(3) {
  color: #dc2626;
  border-color: #dc262655;
}

.gameSetting__tool button:nth-child(3):hover {
  background: #dc26261a;
}

/* ---- 路径字段 ---- */
.gameSetting__root {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--inner-border);
  background: var(--inner-bg);
}

.field__title {
  font-size: 12px;
  font-weight: 500;
}

.field__sub {
  font-size: 10px;
  color: var(--text-sub);
  padding-top: 2px;
}

.field__control {
  display: flex;
  gap: 8px;
}

.field__input {
  flex: 1;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text);
  border-radius: 8px;
  border: 1px solid var(--inner-border);
  background: var(--inner-bg);
  outline: none;
  transition: border-color 0.2s ease;
}

.field__input:focus {
  border-color: var(--accent);
}

.field__input::placeholder {
  color: var(--text-sub);
}

.field__btn {
  display: block;
  align-items: center;
  line-height: 1.1;
  padding: 6px 14px;
  font-size: 12px;
  color: var(--text);
  cursor: pointer;
  border-radius: 8px;
  background: var(--inner-bg);
  border: 1px solid var(--inner-border);
  transition: background-color 0.2s ease;
}

.field__btn:hover {
  background: var(--bg-hover);
}

.field__btn svg {
  width: 12px;
  height: 12px;
  stroke: none;
  padding-top: 3px;
  fill: currentColor;
}

/* ---- rules 占位 ---- */
.gameSetting__rules {
  flex: 1;
  border-radius: 10px;
  border: 1px dashed var(--divider);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
