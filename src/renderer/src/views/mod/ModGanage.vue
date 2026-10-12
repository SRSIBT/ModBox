<template>
    <div class="mod">
        <!-- 标题栏 -->
        <div class="mod__title glass-card">
            <span>{{ activeGame }}</span>
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
        <ModToolbar :filter="filter" :type-options="typeList" :group-options="groupList" :selectedIds="selectedIds"
            @reset="resetFilter" @action="batchAction" />

        <!-- 模组列表 -->
        <ModTable :mod-list="modList" v-model:filtered-list="filteredList" :mod-columns="modColumns"
            :selected-ids="selectedIds" :grid-style="gridStyle" :start-resize="startResize" @update-mod="updateMod"
            @toggle-select="toggleSelect" @select-all="onSelectAll" @context-menu="onRowContextMenu"
            @action="handleAction" @open-external="openExternal"
            @open-folder="(path) => openModFolder(activeGame, path)" />

        <!-- 模组上传 -->
        <ModUpload @import-folder="importFolder" @import-pack="importPack" @export-pack="exportPack"
            @pick-files="() => importMods()" @drop-files="importMods" />
    </div>

    <!-- 右键菜单 -->
    <ContextMenu ref="contextMenuRef" @action="handleAction" />

    <!-- 编辑 Mod -->
    <ModEdit v-model:visible="editVisible" :mod="currentMod" @save="updateMod" />

    <!-- 详情弹窗 -->
    <ModDetail v-model:visible="detailVisible" :mod="currentMod" />

    <!-- 删除 Mod -->
    <ConfirmDialog :visible="oneDeleteConfirm" :title="currentMod.name" :type="'mod'" @confirm="handleDelete"
        @cancel="oneDeleteConfirm = false" />

    <!-- 批量分组 -->
    <BatchEdit v-model:visible="batchEditVisible" :mode="batchMode" :mods="selectedMods" @save="handleBatchSave" />

    <!-- 批量删除 Mod -->
    <ConfirmDialog v-model:visible="batchDeleteConfirm" :title="selectedIds.size" :type="'mods'"
        @confirm="handleBatchSave({ mode: batchMode, value: selectedMods })" @cancel="batchDeleteConfirm = false" />
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useModStore } from '@/stores/mod'
import { useSettingStore } from '@/stores/setting'

import ModDetail from './ModDetail.vue'
import ModToolbar from './ModToolbar.vue'
import ContextMenu from './ContextMenu.vue'
import ModEdit from './ModEdit.vue'
import ConfirmDialog from '../common/ConfirmDialog.vue'
import BatchEdit from './BatchEdit.vue'
import ModTable from './ModTable.vue'
import ModUpload from './ModUpload.vue'

const modStore = useModStore()
const { filter, modList, filteredList, totalCount, typeList, groupList, installedCount, uninstalledCount } = storeToRefs(modStore)
const { fetchMods, importMods, updateMod, deleteMod, openModFolder, openGameFolder, launchGame } = modStore

const settingStore = useSettingStore()
const { activeGame, modColumns } = storeToRefs(settingStore)
const { fetchSettings, startResize } = settingStore

const currentMod = ref({})
const batchMode = ref('group')
const contextMenuRef = ref(null)
const editVisible = ref(false)
const detailVisible = ref(false)
const batchEditVisible = ref(false)
const selectedIds = ref(new Set())
const oneDeleteConfirm = ref(false)
const batchDeleteConfirm = ref(false)

// 获取表头和行的列宽
const gridStyle = computed(() => ({
    gridTemplateColumns: modColumns.value.map(c => `${c.width}px`).join(' ')
}))

// 被选中的 Mod 列表
const selectedMods = computed(() => {
    return filteredList.value.filter(m => selectedIds.value.has(m.id))
})

// 勾选 / 取消勾选单个 Mod
const toggleSelect = (id) => {
    const newSet = new Set(selectedIds.value)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    selectedIds.value = newSet
}

// 表头全选
const onSelectAll = (checked) => {
    if (checked) {
        selectedIds.value = new Set(filteredList.value.map(m => m.id))
    } else {
        selectedIds.value = new Set()
    }
}

// 批量操作
const batchAction = async (action) => {
    modList.value.forEach(m => {
        if (!selectedIds.value.has(m.id)) return
        if (action === 'install') m.installed = true
        if (action === 'uninstall') m.installed = false
    })

    if (action === 'install' || action === 'uninstall') {
        await updateMod()
    }

    if (action === 'group') {
        batchMode.value = 'group'
        batchEditVisible.value = true
    }

    if (action === 'type') {
        batchMode.value = 'type'
        batchEditVisible.value = true
    }

    if (action === 'delete') {
        batchMode.value = 'delete'
        batchDeleteConfirm.value = true
    }
}

// 保存批量操作
const handleBatchSave = async ({ mode, value }) => {
    for (const m of modList.value) {
        if (!selectedIds.value.has(m.id)) continue
        if (mode === 'group') m.group = value
        if (mode === 'type') m.type = value
        if (mode === 'delete') await deleteMod(m)
    }

    await updateMod()
    batchDeleteConfirm.value = false
}

// 重置所有筛选条件
const resetFilter = () => {
    filter.value.keyword = ''
    filter.value.type = ''
    filter.value.group = ''
    filter.value.enabled = ''
    selectedIds.value = new Set()
}

// 右键打开菜单
const onRowContextMenu = (mod, e) => {
    contextMenuRef.value.open(mod, e)
}

// 打开右键菜单选项
const handleAction = async (action, mod) => {
    if (action === 'edit') {
        currentMod.value = mod
        editVisible.value = true
    } else if (action === 'detail') {
        currentMod.value = mod
        detailVisible.value = true
    } else if (action === 'delete') {
        currentMod.value = mod
        oneDeleteConfirm.value = true
    } else if (action === 'openFolder') {
        await openModFolder(activeGame.value, mod.path)
    }
}

// 删除 Mod
const handleDelete = async () => {
    await deleteMod(currentMod.value)
    oneDeleteConfirm.value = false
}

// 打开外部链接
const openExternal = (url) => {
    if (!url) return
    window.electronAPI.openExternal(url)
}

onMounted(async () => {
    await fetchMods(activeGame.value)
    await fetchSettings()
})
</script>

<style scoped>
.mod {
    flex: 1;
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
    background: linear-gradient(135deg, #4DC731 0%, #1BB24D 100%);
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.2),
        0 2px 6px rgba(0, 0, 0, 0.3);
    transition: filter .2s ease;
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
    transition: background-color .2s ease;
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
    color: #FFF;
    background: #4CAF50;
}

.title-info .info-card:nth-child(3) span:nth-child(1) {
    border: none;
    color: #FFF;
    background: #9E9E9E;
}

.title__sub {
    color: var(--text-sub);
    font-size: 10px;
    font-weight: 500;
}
</style>