<template>
  <div class="mod__list glass-card">
    <!-- 表头 -->
    <div ref="headerWrapRef" class="mod-header-wrap">
      <div class="mod-header" :style="gridStyle">
        <div v-for="(col, i) in modColumns" :key="col.key" class="col">
          <template v-if="col.key === 'index'">
            <div class="col-index">
              <input type="checkbox" :checked="allSelected" @change="onSelectAll" />
              <span>{{ col.label }}</span>
            </div>
            <span v-if="i < modColumns.length - 1" class="resizer" @mousedown="startResize(i, $event)"></span>
          </template>
          <template v-else>
            {{ col.label }}
            <span v-if="i < modColumns.length - 1" class="resizer" @mousedown="startResize(i, $event)"></span>
          </template>
        </div>
      </div>
    </div>

    <div v-if="pagedList.length !== 0" class="mod-body" @scroll="onScroll">
      <draggable v-model="dragList" class="mod-drag" item-key="id" handle=".drag" ghost-class="ghost" :animation="200"
        @end="onDragEnd">
        <template #item="{ element, index }">
          <div class="mod-item" :style="gridStyle" @contextmenu.prevent="contextMenuRef.open(element, $event)">
            <span>
              <label class="switch">
                <input type="checkbox" :checked="element.installed" :disabled="installingIds.has(element.id)"
                  @change="toggleInstalled(element, $event)" />
                <span class="switch__slider"></span>
              </label>
            </span>
            <span class="drag">⋮⋮</span>
            <span>
              <div class="col-index">
                <input type="checkbox" :checked="selectedIds.has(element.id)" :disabled="pagedList.length === 0"
                  @change="toggleSelect(element.id)" />
                <span>{{ index + 1 }}</span>
              </div>
            </span>
            <span class="mod-cover">
              <img v-if="element.cover" :src="element.cover" />
              <svg v-else viewBox="0 0 1024 1024" version="1.1" p-id="2826">
                <path
                  d="M903.5 135.4H120.2c-29.8 0-56 24.2-56 56v639.7c0 29.8 26.1 56 56 56h783.3c29.8 0 55.9-24.2 55.9-56V191.4c0-29.8-24.2-56-55.9-56z m0 697.6H120.2V668.9L344 452.5l231.3 229.4c9.3 11.2 26.1 9.3 39.2 1.9L717 592.4l184.6 188.4 1.9 1.9V833z m0-130.6L739.4 534.6c-9.3-9.3-26.1-11.2-37.3-1.9l-104.4 91.4-231.3-229.4c-9.3-11.2-28-13.1-39.2-3.7l-1.9 1.9-205.1 197.6V191.4h783.3v511zM707.7 415.2c31.7 0 55.9-24.2 55.9-56 0-31.7-24.2-55.9-55.9-55.9s-56 24.2-56 55.9c0 31.8 24.3 56 56 56z m0 0"
                  p-id="2827"></path>
              </svg>
            </span>
            <span class="mod-hover" title="查看模组介绍" @click="handleAction('detail', element)">{{
              element.name
            }}</span>
            <span class="mod-hover" title="点击编辑模组" @click="handleAction('edit', element)">{{
              element.type
            }}</span>
            <span class="mod-hover" title="在 N 网打开" @click="handleAction('openNexus', element)">{{ element.modId
            }}</span>
            <span class="mod-hover" title="查看模组文件" @click="handleAction('openFolder', element)">{{ element.version
            }}</span>
            <span>{{ element.author }}</span>
            <span>{{ element.group }}</span>
          </div>
        </template>
      </draggable>
    </div>

    <div v-if="modList.length === 0" class="empty">暂无 Mod，点下方上传 Mod</div>

    <div v-else-if="filteredList.length === 0" class="empty">没有符合筛选条件的 Mod</div>

    <!-- 右键菜单 -->
    <ContextMenu ref="contextMenuRef" @action="handleAction" />
    <!-- 编辑 -->
    <ModEdit v-model:visible="editVisible" :mod="currentMod" @save="handleSaveMod" />
    <!-- 详情 -->
    <ModDetail v-model:visible="detailVisible" :mod="currentMod" />
    <!-- 单行删除 -->
    <ConfirmDialog :visible="deleteConfirm" :title="currentMod.name" :type="'mod'" @confirm="onDelete"
      @cancel="deleteConfirm = false" />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useModStore } from '@/stores/mod'
import { useSettingStore } from '@/stores/setting'
import { useToastStore } from '@/stores/toast'
import draggable from 'vuedraggable'
import ModEdit from './ModEdit.vue'
import ModDetail from './ModDetail.vue'
import ContextMenu from './ContextMenu.vue'
import ConfirmDialog from '../common/ConfirmDialog.vue'

const toast = useToastStore()

const modStore = useModStore()
const { modList, filteredList, pagedList, selectedIds, installingIds } = storeToRefs(modStore)
const { updateMod, deleteMod, openModFolder, setInstalled } = modStore

const settingStore = useSettingStore()
const { modColumns, activeGameId } = storeToRefs(settingStore)
const { startResize } = settingStore

const dragList = ref([])
const currentMod = ref({})
const editVisible = ref(false)
const headerWrapRef = ref(null)
const contextMenuRef = ref(null)
const detailVisible = ref(false)
const deleteConfirm = ref(false)

// 获取表头和行的列宽
const gridStyle = computed(() => ({
  gridTemplateColumns: modColumns.value.map((c) => `${c.width}px`).join(' ')
}))

// 表头复选框是否勾选：当前页非空且当前页所有 Mod 都已被选中
const allSelected = computed(
  () => pagedList.value.length > 0 && pagedList.value.every((m) => selectedIds.value.has(m.id))
)

// 勾选 / 取消单个 Mod
const toggleSelect = (id) => {
  const newSet = new Set(selectedIds.value)
  if (newSet.has(id)) newSet.delete(id)
  else newSet.add(id)
  selectedIds.value = newSet
}

// 全选当前页 Mod
const onSelectAll = (e) => {
  const next = new Set(selectedIds.value)
  if (e.target.checked) {
    pagedList.value.forEach((m) => next.add(m.id))
  } else {
    pagedList.value.forEach((m) => next.delete(m.id))
  }
  selectedIds.value = next
}

// 右键菜单
const handleAction = async (action, mod) => {
  if (action === 'edit') {
    currentMod.value = mod
    editVisible.value = true
  } else if (action === 'detail') {
    currentMod.value = mod
    detailVisible.value = true
  } else if (action === 'delete') {
    currentMod.value = mod
    deleteConfirm.value = true
  } else if (action === 'openFolder') {
    await openModFolder(activeGameId.value, mod.path)
  } else if (action === 'openNexus') {
    if (mod.url) window.electronAPI.openExternal(mod.url)
  }
}

// 安装开关：真正复制 / 删除文件
const toggleInstalled = async (mod, event) => {
  const checked = event.target.checked
  try {
    await setInstalled(mod, checked)
    toast.success(`${checked ? '安装' : '卸载'}成功：${mod.name}`)
  } catch (e) {
    event.target.checked = mod.installed
    toast.error(`操作失败：${e.message}`)
  }
}

// 拖拽模组排序：
const onDragEnd = async (evt) => {
  if (!evt || evt.oldIndex === evt.newIndex) return

  const ordered = dragList.value
  const visibleIds = new Set(ordered.map((m) => m.id))

  let cursor = 0
  const next = modList.value.map((m) => {
    if (!visibleIds.has(m.id)) return m
    return ordered[cursor++] || m
  })
  modList.value.splice(0, modList.value.length, ...next)

  await updateMod()
}

// 删除 Mod
const onDelete = async () => {
  try {
    await deleteMod(currentMod.value)
    deleteConfirm.value = false
    toast.success('模组已删除')
  } catch (e) {
    toast.error(`删除失败：${e.response?.data?.error || e.message}`)
  }
}

const handleSaveMod = async (form) => {
  try {
    await updateMod(form)
    toast.success('模组信息已保存')
  } catch (e) {
    toast.error(`保存失败：${e.message}`)
  }
}

// 横向滚动同步
const onScroll = (e) => {
  if (headerWrapRef.value) headerWrapRef.value.scrollLeft = e.target.scrollLeft
}

watch(
  pagedList,
  (v) => {
    dragList.value = [...v]
  },
  { immediate: true }
)
</script>

<style scoped>
.mod__list {
  min-height: 0;
  flex: 1;
  gap: 6px;
  display: flex;
  flex-direction: column;
  padding: 0 12px 12px 12px;
}

.mod-header-wrap {
  padding-right: 6px;
  overflow-x: hidden;
}

.mod-header {
  min-width: max-content;
  height: 50px;
  font-size: 12px;
  color: var(--text);
  font-weight: 600;
  display: grid;
  align-items: center;
  flex-shrink: 0;
  border-bottom: 1px solid var(--inner-border);
}

.col {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  position: relative;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-right: 1px solid var(--inner-border);
}

.col-index {
  padding-left: 16px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: left;
  gap: 6px;
  width: 100%;
}

.col-index input[type='checkbox'] {
  margin: 0;
}

.mod-cover img {
  width: 80%;
  height: 80%;
  object-fit: cover;
  border-radius: 4px;
}

.mod-cover svg {
  width: 16px;
  height: 16px;
  fill: var(--text-sub);
}

.resizer {
  position: absolute;
  right: 0;
  width: 2px;
  height: 100%;
  transform: scaleX(0.5);
  transform-origin: right;
  cursor: col-resize;
  transition: background-color 0.2s ease;
}

.resizer::before {
  content: '';
  position: absolute;
  left: -6px;
  right: -6px;
  top: 0;
  bottom: 0;
}

.resizer:hover {
  background: var(--accent);
}

.mod-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.mod-drag {
  min-width: max-content;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mod-item {
  color: var(--text-sub);
  font-size: 12px;
  flex-shrink: 0;
  height: 40px;
  display: grid;
  border-radius: 8px;
  background: var(--inner-bg);
  transition: background-color 0.2s ease;
  outline: 1px solid var(--panel-border);
  outline-offset: -1px;
}

.mod-item:hover {
  background: var(--bg-hover);
}

.mod-item>span {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-right: 1px solid var(--inner-border);
}

.mod-item span:nth-child(5) {
  padding-left: 6px;
  justify-content: left;
}

.mod-header .col:last-child,
.mod-item>span:last-child {
  border: none;
}

.switch {
  position: relative;
  width: 28px;
  height: 16px;
  display: inline-block;
  vertical-align: middle;
}

.switch input[type='checkbox'] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  z-index: 1;
  margin: 0;
}

.switch__slider {
  position: absolute;
  inset: 0;
  background: var(--inner-border);
  border-radius: 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.switch__slider::before {
  content: '';
  position: absolute;
  width: 12px;
  height: 12px;
  left: 2px;
  top: 2px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s ease;
}

.switch input:checked+.switch__slider {
  background: var(--accent);
}

.switch input:checked+.switch__slider::before {
  transform: translateX(12px);
}

.mod-item .drag {
  cursor: grab;
  color: var(--text-sub);
  user-select: none;
  font-size: 14px;
}

.mod-item .drag:active {
  cursor: grabbing;
}

.mod-hover {
  cursor: pointer;
  transition: color 0.2s ease;
}

.mod-hover:hover {
  color: var(--text);
  text-decoration: underline;
}

input[type='checkbox'] {
  appearance: none;
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background: var(--inner-bg);
  border: 1px solid var(--inner-border);
  cursor: pointer;
  position: relative;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
  display: block;
  margin: 0 auto;
}

input[type='checkbox']:checked {
  background: var(--accent);
  border-color: var(--accent);
}

input[type='checkbox']:checked::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 3px;
  height: 7px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.empty {
  padding: 40px;
  text-align: center;
  font-size: 12px;
  color: var(--text-sub);
}
</style>
