<template>
  <div class="mod">
    <!-- 标题栏 -->
    <div class="mod__title glass-card">
      <span>{{ activeGame?.name || '未选择游戏' }}</span>
      <div class="title-tool">
        <button class="title-btn title-btn--play" @click="handleLaunchGame">
          <svg viewBox="0 0 1024 1024" version="1.1" p-id="2573">
            <path
              d="M882.734114 459.147258l0.024559-0.024559L244.016061 21.12718l-0.199545 0.188288C230.582097 8.748245 212.62819 1.014096 192.840518 1.014096c-40.704051 0-73.699536 32.66905-73.699536 72.996524 0 22.148439-0.954745 65.513086 0 64.572668l0 373.422851 0 393.071354c0 0.325411 0 25.249057 0 44.935422 0 40.302915 32.995485 72.972988 73.699536 72.972988 19.862373 0 37.892005-7.78429 51.125401-20.466124l0.050142 0.025583 638.742613-437.982216-0.024559-0.038886c13.886265-13.270235 22.549575-31.889291 22.549575-52.531424 0-0.050142 0-0.088004 0-0.150426 0-0.050142 0-0.11154 0-0.149403C905.28369 491.048829 896.620379 472.41647 882.734114 459.147258z"
              p-id="2574" fill="#C1FFCB"></path>
          </svg>
          <span>开始游戏</span>
        </button>
        <button class="title-btn title-btn--clean" title="卸载全部 Mod，并清理游戏目录里的残留" @click="cleanupConfirm = true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" />
            <path d="M10 11v5M14 11v5" />
          </svg>
          <span>清理 Mod</span>
        </button>
        <button class="title-btn title-btn--folder" @click="handleOpenGameFolder">
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
    <ModToolbar @action="handleBatchAction" @refresh="handleRefresh" />

    <Transition name="dialog" mode="out-in">
      <!-- 模组列表 -->
      <ModTable v-if="viewMode === 'table'" />

      <!-- 模组卡片 -->
      <ModCard v-else />
    </Transition>

    <!-- 翻页栏 -->
    <Pager v-model:page="page" v-model:page-size="pageSize" :total="filteredList.length" />

    <!-- 模组上传 -->
    <ModUpload />

    <!-- 批量修改 -->
    <BatchEdit v-model:visible="batchEditVisible" :mode="batchMode" :mods="selectedMods" @save="handleBatchSave" />

    <!-- 批量删除 -->
    <ConfirmDialog v-model:visible="batchDeleteConfirm" :title="selectedIds.size" :type="'mods'"
      @confirm="handleBatchSave({ mode: 'delete' })" @cancel="batchDeleteConfirm = false" />

    <!-- 一键清理 -->
    <ConfirmDialog v-model:visible="cleanupConfirm" title="一键清理" message="确定卸载全部 Mod 并清理游戏目录里的 Mod 残留吗？"
      @confirm="handleCleanup" @cancel="cleanupConfirm = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useModStore } from '@/stores/mod'
import { useGameStore } from '@/stores/game'
import { useSettingStore } from '@/stores/setting'
import { useToastStore } from '@/stores/toast'
import ModToolbar from './ModToolbar.vue'
import ModTable from './ModTable.vue'
import ModCard from './ModCard.vue'
import Pager from '../common/Pager.vue'
import ModUpload from './ModUpload.vue'
import BatchEdit from './BatchEdit.vue'
import ConfirmDialog from '../common/ConfirmDialog.vue'

const modStore = useModStore()
const { modList, filteredList, page, pageSize, filter, selectedIds, totalCount, installedCount, uninstalledCount } = storeToRefs(modStore)
const { fetchMods, updateMod, deleteMod, cleanupMods, setInstalledBatch, openGameFolder, launchGame } = modStore
const toast = useToastStore()

const gameStore = useGameStore()
const { activeGame } = storeToRefs(gameStore)
const { fetchGames } = gameStore

const settingStore = useSettingStore()
const { viewMode } = storeToRefs(settingStore)

const isDeleting = ref(false) // 批量删除进行中，防重复点击
const batchMode = ref('group') // 批量操作模式
const cleanupConfirm = ref(false) // 一键清理确认
const batchEditVisible = ref(false) // 批量修改界面显示
const batchDeleteConfirm = ref(false) // 批量删除界面显示

// 多选模组列表
const selectedMods = computed(() => {
  return modList.value.filter((m) => selectedIds.value.has(m.id))
})

// 启动游戏
const handleLaunchGame = async () => {
  try {
    await launchGame()
    toast.success('游戏已启动')
  } catch (e) {
    toast.error(e.message || '启动游戏失败')
  }
}

// 打开游戏根目录
const handleOpenGameFolder = async () => {
  try {
    await openGameFolder()
  } catch (e) {
    toast.error(e.message || '打开游戏目录失败')
  }
}

// 刷新模组列表
const handleRefresh = async () => {
  try {
    await fetchMods()
    toast.success('模组列表已刷新')
  } catch (e) {
    toast.error(`刷新失败：${e.message}`)
  }
}

// 卸载全部 Mod，清理残留
const handleCleanup = async () => {
  cleanupConfirm.value = false
  try {
    const result = await cleanupMods()
    if (result.failed?.length) {
      toast.warning(`清理完成，但有 ${result.failed.length} 个文件没删掉`)
    } else {
      toast.success('已卸载全部 Mod 并清理残留')
    }
  } catch (e) {
    toast.error(`清理失败：${e.message}`)
  }
}

// 批量操作
const handleBatchAction = async (action) => {
  if (action === 'install' || action === 'uninstall') {
    const targets = modList.value.filter((m) => selectedIds.value.has(m.id))
    if (targets.length === 0) return

    const results = await setInstalledBatch(targets, action === 'install')
    const failed = results.filter((r) => !r.success)
    if (failed.length > 0) {
      const names = failed.map((r) => r.mod.name).join('、')
      toast.error(`${failed.length} 个模组失败：${names}；${failed[0].error}`)
    } else {
      toast.success(`已${action === 'install' ? '安装' : '卸载'} ${results.length} 个模组`)
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
  const targets = selectedMods.value

  if (mode === 'delete') {
    if (isDeleting.value) return
    isDeleting.value = true
    try {
      const failures = []
      for (const m of targets) {
        try {
          await deleteMod(m)
        } catch (e) {
          failures.push(`${m.name}：${e.response?.data?.error || e.message}`)
        }
      }
      batchDeleteConfirm.value = false
      if (failures.length) {
        toast.error(`${failures.length} 个模组删除失败：${failures.join('；')}`)
      } else {
        toast.success('已删除选中的模组')
      }
    } finally {
      isDeleting.value = false
    }
    return
  }

  for (const m of targets) {
    if (mode === 'group') m.group = value
    if (mode === 'type') m.type = value
  }
  await updateMod()
  batchEditVisible.value = false
}

// 筛选条件变化后回到第一页
watch(
  () => [filter.value.keyword, filter.value.type, filter.value.group, filter.value.enabled],
  () => {
    page.value = 1
  }
)

// 列表或每页条数变化后，页码越界时夹回最后一页
watch(
  () => [filteredList.value.length, pageSize.value],
  () => {
    const lastPage = Math.max(1, Math.ceil(filteredList.value.length / pageSize.value))
    if (page.value > lastPage) page.value = lastPage
  }
)

// 切换游戏后回到第一页
watch(
  () => activeGame.value?.id,
  () => {
    page.value = 1
  }
)

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
  gap: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.title-btn {
  height: 28px;
  padding: 0 9px;
  gap: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  border: 1px solid var(--inner-border);
  background: var(--inner-bg);
  color: var(--text-sub);
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;
}

.title-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.title-btn svg {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
}

.title-btn--play {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 35%, transparent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.title-btn--play:hover {
  color: #fff;
  background: var(--accent);
}

.title-btn--clean {
  color: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 30%, transparent);
  background: color-mix(in srgb, var(--danger) 10%, transparent);
}

.title-btn--clean:hover {
  color: #fff;
  background: var(--danger);
}

.title-btn--folder {
  color: var(--text-sub);
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
