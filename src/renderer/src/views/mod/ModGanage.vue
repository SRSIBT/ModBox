<template>
  <div class="mod">
    <!-- 标题栏 -->
    <div class="mod__title glass-card">
      <span>{{ activeGame?.name || '未选择游戏' }}</span>
      <div class="title-tool">
        <button @click="launchGame">
          <svg viewBox="0 0 1024 1024" version="1.1" p-id="2573">
            <path
              d="M882.734114 459.147258l0.024559-0.024559L244.016061 21.12718l-0.199545 0.188288C230.582097 8.748245 212.62819 1.014096 192.840518 1.014096c-40.704051 0-73.699536 32.66905-73.699536 72.996524 0 22.148439-0.954745 65.513086 0 64.572668l0 373.422851 0 393.071354c0 0.325411 0 25.249057 0 44.935422 0 40.302915 32.995485 72.972988 73.699536 72.972988 19.862373 0 37.892005-7.78429 51.125401-20.466124l0.050142 0.025583 638.742613-437.982216-0.024559-0.038886c13.886265-13.270235 22.549575-31.889291 22.549575-52.531424 0-0.050142 0-0.088004 0-0.150426 0-0.050142 0-0.11154 0-0.149403C905.28369 491.048829 896.620379 472.41647 882.734114 459.147258z"
              p-id="2574" fill="#C1FFCB"></path>
          </svg>
          <span>开始游戏</span>
        </button>
        <button @click="openGameFolder">
          <svg viewBox="0 0 1026 1024" version="1.1" p-id="7491">
            <path
              d="M950.857143 394.971429l-124.342857 438.857142c-7.314286 21.942857-36.571429 43.885714-58.514286 43.885715h-658.285714c-7.314286 0-14.628571 0-21.942857-7.314286 0-7.314286-7.314286-14.628571 0-21.942857l124.342857-438.857143c7.314286-21.942857 36.571429-43.885714 58.514285-43.885714h658.285715c7.314286 0 14.628571 0 14.628571 7.314285 7.314286 0 7.314286 7.314286 7.314286 21.942858zM73.142857 109.714286c0-21.942857 14.628571-36.571429 36.571429-36.571429h234.057143l65.828571 124.342857c0 14.628571 14.628571 21.942857 29.257143 21.942857h402.285714c21.942857 0 36.571429 14.628571 36.571429 36.571429V292.571429H270.628571C219.428571 292.571429 160.914286 336.457143 146.285714 394.971429L73.142857 643.657143V109.714286z m936.228572 219.428571c-14.628571-21.942857-36.571429-29.257143-58.514286-36.571428v-36.571429c0-58.514286-51.2-109.714286-109.714286-109.714286H460.8L394.971429 21.942857C394.971429 7.314286 380.342857 0 365.714286 0H109.714286C51.2 0 0 51.2 0 109.714286v731.428571c0 36.571429 21.942857 73.142857 43.885714 87.771429h7.314286c14.628571 14.628571 36.571429 21.942857 58.514286 21.942857h658.285714c58.514286 0 109.714286-43.885714 131.657143-102.4l124.342857-438.857143c7.314286-29.257143 0-58.514286-14.628571-80.457143z"
              p-id="7492" fill="#FF9800"></path>
          </svg>
          <span>游戏根目录</span>
        </button>
      </div>
      <div class="title-info">
        <div class="info-card">
          <span>{{ totalCount }}</span>
          <span class="title__sub">模组总量</span>
        </div>
        <div class="info-card">
          <span>{{ installedCount }}</span>
          <span class="title__sub">已安装</span>
        </div>
        <div class="info-card">
          <span>{{ uninstalledCount }}</span>
          <span class="title__sub">未安装</span>
        </div>
      </div>
    </div>

    <!-- 工具栏 -->
    <ModToolbar @action="handleBatchAction" @refresh="fetchMods" />

    <Transition name="dialog" mode="out-in">
      <!-- 模组列表 -->
      <ModTable v-if="viewMode === 'table'" />

      <!-- 模组卡片 -->
      <ModCard v-else />
    </Transition>

    <!-- 翻页栏 -->
    <Pager :total="totalCount" />

    <!-- 模组上传 -->
    <ModUpload />

    <!-- 批量修改 -->
    <BatchEdit v-model:visible="batchEditVisible" :mode="batchMode" :mods="selectedMods" @save="handleBatchSave" />

    <!-- 批量删除 -->
    <ConfirmDialog v-model:visible="batchDeleteConfirm" :title="selectedIds.size" :type="'mods'"
      @confirm="handleBatchSave({ mode: 'delete' })" @cancel="batchDeleteConfirm = false" />
  </div>

</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useModStore } from '@/stores/mod'
import { useGameStore } from '@/stores/game'
import { useSettingStore } from '@/stores/setting'
import ModToolbar from './ModToolbar.vue'
import ModTable from './ModTable.vue'
import ModCard from './ModCard.vue'
import Pager from '../common/Pager.vue'
import ModUpload from './ModUpload.vue'
import BatchEdit from './BatchEdit.vue'
import ConfirmDialog from '../common/ConfirmDialog.vue'

const modStore = useModStore()
const { modList, selectedIds, totalCount, installedCount, uninstalledCount } = storeToRefs(modStore)
const { fetchMods, updateMod, deleteMod, setInstalledBatch, openGameFolder, launchGame } = modStore

const gameStore = useGameStore()
const { activeGame } = storeToRefs(gameStore)
const { fetchGames } = gameStore

const settingStore = useSettingStore()
const { viewMode } = storeToRefs(settingStore)

const batchMode = ref('group')
const batchEditVisible = ref(false)
const batchDeleteConfirm = ref(false)
const selectedMods = computed(() => modList.value.filter((m) => selectedIds.value.has(m.id)))

// 批量操作
const handleBatchAction = async (action) => {
  if (action === 'install' || action === 'uninstall') {
    const targets = modList.value.filter((m) => selectedIds.value.has(m.id))
    if (targets.length === 0) return

    const results = await setInstalledBatch(targets, action === 'install')
    const failed = results.filter((r) => !r.success)
    if (failed.length > 0) {
      const names = failed.map((r) => r.mod.name).join('、')
      window.alert(`${failed.length} 个模组失败：${names}\n${failed[0].error}`)
    }
    return
  }
  if (action === 'group' || action === 'type') {
    batchMode.value = action
    batchEditVisible.value = true
  }
  if (action === 'delete') {
    batchMode.value = 'delete'
    batchDeleteConfirm.value = true
  }
}

// 批量保存
const handleBatchSave = async ({ mode, value }) => {
  for (const m of modList.value) {
    if (!selectedIds.value.has(m.id)) continue
    if (mode === 'group') m.group = value
    if (mode === 'type') m.type = value
    if (mode === 'delete') await deleteMod(m)
  }
  await updateMod()
  batchDeleteConfirm.value = false
  batchEditVisible.value = false
}

onMounted(async () => {
  await fetchGames()
  await fetchMods()
})
</script>

<style scoped>
.mod {
  box-sizing: border-box;
  flex: 1;
  max-width: 100%;
  min-width: 0;
  gap: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 标题栏 */
.mod__title {
  gap: 26px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
}

.title-tool button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.mod__title>span:nth-child(1) {
  font-size: 16px;
  font-weight: 500;
  color: var(--text);
}

.mod__title .title-tool {
  gap: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.title-tool button {
  gap: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  color: #fff;
  cursor: pointer;
  font-size: 16px;
  padding: 6px 16px;
}

.title-tool button:nth-child(1) {
  font-weight: 300;
  border: none;
  background: linear-gradient(135deg, #4dc731 0%, #1bb24d 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    0 2px 6px rgba(0, 0, 0, 0.3);
  transition: filter 0.2s ease;
}

.title-tool button:nth-child(1):hover {
  filter: brightness(1.1);
}

.title-tool button:nth-child(1):active {
  filter: brightness(1);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0);
}

.title-tool button:nth-child(2) {
  background: var(--inner-bg);
  border: 1px solid var(--panel-border);
  transition: background-color 0.2s ease;
}

.title-tool button:nth-child(2):hover {
  background: var(--bg-hover);
}

.mod__title .title-tool svg {
  display: block;
  cursor: pointer;
  width: 16px;
  height: 16px;
  border: none;
  background: none;
}

.mod__title .title-info {
  margin-left: auto;
  gap: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.info-card {
  gap: 6px;
  display: flex;
  align-items: center;
}

.title-info .info-card span:nth-child(1) {
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 12px;
}

.title-info .info-card:nth-child(1) span:nth-child(1) {
  color: var(--text);
  border: 1px solid var(--inner-border);
}

.title-info .info-card:nth-child(2) span:nth-child(1) {
  border: none;
  color: #fff;
  background: #4caf50;
}

.title-info .info-card:nth-child(3) span:nth-child(1) {
  border: none;
  color: #fff;
  background: #9e9e9e;
}

.title__sub {
  color: var(--text-sub);
  font-size: 10px;
  font-weight: 500;
}
</style>
