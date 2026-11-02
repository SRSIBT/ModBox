<template>
  <div class="mod__cards glass-card">
    <!-- 图标 sprite：一份定义，卡片里只引用，避免重复内联 SVG -->
    <svg class="mc-sprite" aria-hidden="true" focusable="false">
      <symbol id="mc-i-eye" viewBox="0 0 24 24">
        <g
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </g>
      </symbol>
      <symbol id="mc-i-pen" viewBox="0 0 24 24">
        <g
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </g>
      </symbol>
      <symbol id="mc-i-folder" viewBox="0 0 24 24">
        <g
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        </g>
      </symbol>
      <symbol id="mc-i-trash" viewBox="0 0 24 24">
        <g
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M10 11v6M14 11v6" />
        </g>
      </symbol>
      <symbol id="mc-i-user" viewBox="0 0 24 24">
        <g
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="8" r="3.6" />
          <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
        </g>
      </symbol>
      <symbol id="mc-i-drag" viewBox="0 0 24 24">
        <g fill="currentColor">
          <circle cx="9" cy="6" r="1.4" />
          <circle cx="15" cy="6" r="1.4" />
          <circle cx="9" cy="12" r="1.4" />
          <circle cx="15" cy="12" r="1.4" />
          <circle cx="9" cy="18" r="1.4" />
          <circle cx="15" cy="18" r="1.4" />
        </g>
      </symbol>
      <symbol id="mc-i-image" viewBox="0 0 1024 1024">
        <path
          d="M903.5 135.4H120.2c-29.8 0-56 24.2-56 56v639.7c0 29.8 26.1 56 56 56h783.3c29.8 0 55.9-24.2 55.9-56V191.4c0-29.8-24.2-56-55.9-56z m0 697.6H120.2V668.9L344 452.5l231.3 229.4c9.3 11.2 26.1 9.3 39.2 1.9L717 592.4l184.6 188.4 1.9 1.9V833z m0-130.6L739.4 534.6c-9.3-9.3-26.1-11.2-37.3-1.9l-104.4 91.4-231.3-229.4c-9.3-11.2-28-13.1-39.2-3.7l-1.9 1.9-205.1 197.6V191.4h783.3v511zM707.7 415.2c31.7 0 55.9-24.2 55.9-56 0-31.7-24.2-55.9-55.9-55.9s-56 24.2-56 55.9c0 31.8 24.3 56 56 56z"
        />
      </symbol>
    </svg>

    <div class="mod__cards-body">
      <draggable
        v-if="pagedList.length !== 0"
        v-model="dragList"
        class="mod-grid"
        item-key="id"
        handle=".mc__drag"
        ghost-class="ghost"
        :animation="200"
        @end="onDragEnd"
      >
        <template #item="{ element: mod }">
          <div
            class="mc"
            :class="{ 'is-selected': selectedIds.has(mod.id) }"
            @click="toggleSelect(mod.id)"
            @contextmenu.prevent.stop="contextMenuRef.open(mod, $event)"
          >
            <span class="mc__status" :class="mod.installed ? 'is-on' : 'is-off'">
              {{ mod.installed ? '已安装' : '未安装' }}
            </span>

            <div class="mc__cover">
              <div class="mc__cover-inner">
                <img v-if="mod.cover" :src="mod.cover" />
                <div v-else class="mc__ph" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <use href="#mc-i-image" />
                  </svg>
                </div>
              </div>

              <div class="mc__tools" @click.stop>
                <span class="mc__drag" title="拖拽排序">
                  <svg viewBox="0 0 24 24">
                    <use href="#mc-i-drag" />
                  </svg>
                </span>
              </div>

              <button
                v-if="mod.type !== '/'"
                type="button"
                class="mc__type"
                title="点击编辑模组"
                @click.stop="handleAction('edit', mod)"
              >
                {{ mod.type }}
              </button>
            </div>

            <div class="mc__body">
              <div class="mc__title-row">
                <h3 class="mc__name" title="查看模组介绍" @click="handleAction('detail', mod)">
                  {{ mod.name }}
                </h3>
              </div>

              <div class="mc__author">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <use href="#mc-i-user" />
                </svg>
                <span class="mc__author-name">{{
                  mod.author !== '/' ? mod.author : '未知作者'
                }}</span>
              </div>

              <div class="mc__meta">
                <button
                  v-if="mod.modId !== '/'"
                  class="mc__tag mc__tag--id"
                  :disabled="!mod.url"
                  :title="mod.url ? '在 N 网打开' : '未关联 N 网页面'"
                  @click.stop="handleAction('openNexus', mod)"
                >
                  ID {{ mod.modId }}
                </button>

                <button
                  v-if="mod.version !== '/'"
                  class="mc__tag mc__tag--ver"
                  title="查看模组文件"
                  @click.stop="handleAction('openFolder', mod)"
                >
                  v{{ mod.version }}
                </button>

                <span class="mc__tag mc__tag--group">
                  ▦ {{ mod.group !== '/' ? mod.group : '未分组' }}
                </span>
              </div>

              <p class="mc__desc" :class="{ 'is-empty': mod.describe === '' }">
                {{ mod.describe || '暂无描述' }}
              </p>
            </div>

            <div class="mc__foot">
              <label class="mc__switch" @click.stop>
                <input
                  type="checkbox"
                  :checked="mod.installed"
                  :disabled="installingIds.has(mod.id)"
                  @change="toggleInstalled(mod, $event.target.checked)"
                />
                <span class="mc__slider"></span>
              </label>

              <div class="mc__actions">
                <button
                  v-for="action in cardActions"
                  :key="action.type"
                  type="button"
                  class="mc__act"
                  :class="{ 'is-danger': action.danger }"
                  :title="action.title"
                  :aria-label="action.title"
                  @click.stop="handleAction(action.type, mod)"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <use :href="`#mc-i-${action.icon}`" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </template>
      </draggable>

      <div v-else class="empty">
        {{ modList.length === 0 ? '暂无 Mod，点下方上传 Mod' : '没有符合筛选条件的 Mod' }}
      </div>
    </div>

    <ContextMenu ref="contextMenuRef" @action="handleAction" />
    <ModEdit v-model:visible="editVisible" :mod="currentMod" @save="handleSaveMod" />
    <ModDetail v-model:visible="detailVisible" :mod="currentMod" />
    <ConfirmDialog
      :visible="deleteConfirm"
      :title="currentMod.name"
      :type="'mod'"
      @confirm="onDelete"
      @cancel="deleteConfirm = false"
    />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useModStore } from '@/stores/mod'
import { useSettingStore } from '@/stores/setting'
import { useToastStore } from '@/stores/toast'
import draggable from 'vuedraggable'
import ModEdit from './ModEdit.vue'
import ModDetail from './ModDetail.vue'
import ContextMenu from './ContextMenu.vue'
import ConfirmDialog from '../common/ConfirmDialog.vue'

const modStore = useModStore()
const { modList, pagedList, selectedIds, installingIds } = storeToRefs(modStore)
const { updateMod, deleteMod, openModFolder, setInstalled } = modStore

const settingStore = useSettingStore()
const { activeGameId } = storeToRefs(settingStore)
const toast = useToastStore()

const dragList = ref([])
const currentMod = ref({})
const editVisible = ref(false)
const detailVisible = ref(false)
const deleteConfirm = ref(false)
const contextMenuRef = ref(null)

const cardActions = [
  { type: 'detail', icon: 'eye', title: '查看详情' },
  { type: 'edit', icon: 'pen', title: '编辑模组' },
  { type: 'openFolder', icon: 'folder', title: '打开模组文件夹' },
  { type: 'delete', icon: 'trash', title: '删除模组', danger: true }
]

const toggleSelect = (id) => {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

const toggleInstalled = async (mod, checked) => {
  try {
    await setInstalled(mod, checked)
    toast.success(`${checked ? '安装' : '卸载'}成功：${mod.name}`)
  } catch (e) {
    toast.error(`操作失败：${e.message}`)
  }
}

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

// @end 时 dragList 已是最终顺序，按它整体重排可见项，隐藏项保持原位
const onDragEnd = async (evt) => {
  if (!evt || evt.oldIndex === evt.newIndex) return

  const ordered = dragList.value
  const visibleIds = new Set(ordered.map((m) => m.id))
  let cursor = 0
  const next = modStore.modList.map((m) => {
    if (!visibleIds.has(m.id)) return m
    return ordered[cursor++] || m
  })
  modStore.modList.splice(0, modStore.modList.length, ...next)

  await modStore.updateMod()
}

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

watch(
  pagedList,
  (v) => {
    dragList.value = [...v]
  },
  { immediate: true }
)
</script>

<style scoped>
.mc-sprite {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

.mod__cards {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  overflow-x: hidden;
  padding: 0 12px 12px;
}

.mod__cards-body {
  box-sizing: border-box;
  flex: 1;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 12px 6px 4px 0;
}

.mod-grid {
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  align-items: stretch;
  gap: 12px;
  width: 100%;
  max-width: 100%;
}

.mod-grid .ghost {
  opacity: 0.4;
  outline: 1px dashed var(--accent);
  outline-offset: -1px;
}

.mc {
  padding: 6px;
  position: relative;
  box-sizing: border-box;
  gap: 6px;
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  width: 200px;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  border-radius: 10px;
  background: var(--inner-bg);
  outline: 1px solid var(--inner-border);
  outline-offset: -1px;
  cursor: pointer;
  user-select: none;
  transition:
    transform 0.18s ease,
    outline-color 0.18s ease,
    box-shadow 0.18s ease;
}

.mc:hover {
  transform: translateY(-2px);
  outline-color: var(--accent);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
}

.mc.is-selected {
  outline: 1.5px solid var(--accent);
}

.mc__cover {
  position: relative;
  flex-shrink: 0;
  width: 100%;
  overflow: hidden;
  padding-top: 56.25%;
  background: var(--bg-hover);
}

.mc__cover-inner {
  position: absolute;
  inset: 0;
}

.mc__cover-inner img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.25s ease;
}

.mc:hover .mc__cover-inner img {
  transform: scale(1.03);
}

.mc__ph {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--text-faint);
}

.mc__ph svg {
  width: 26px;
  height: 26px;
  fill: var(--text-sub);
}

.mc__status {
  position: absolute;
  z-index: 10;
  top: 0;
  left: 0;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.2px;
  color: #fff;
}

.mc__status.is-on {
  background: var(--success);
}

.mc__status.is-off {
  background: var(--text-faint);
}

.mc__tools {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.mc__drag {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.35);
  color: rgba(255, 255, 255, 0.85);
  cursor: grab;
  opacity: 0;
  transition:
    opacity 0.15s ease,
    background-color 0.15s ease;
}

.mc:hover .mc__drag,
.mc:focus-within .mc__drag {
  opacity: 1;
}

.mc__drag:hover {
  background: rgba(0, 0, 0, 0.55);
}

.mc__drag:active {
  cursor: grabbing;
}

.mc__drag svg {
  width: 12px;
  height: 12px;
}

.mc__type {
  position: absolute;
  left: 8px;
  bottom: 8px;
  box-sizing: border-box;
  max-width: calc(100% - 16px);
  padding: 2px 7px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-family: inherit;
  font-size: 10px;
  font-weight: 500;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.mc__type:hover {
  background: rgba(0, 0, 0, 0.72);
  border-color: rgba(255, 255, 255, 0.45);
}

.mc__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.mc__title-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
}

.mc__name {
  display: -webkit-box;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  min-height: 2.7em;
  word-break: break-word;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.mc__name:hover {
  text-decoration: underline;
}

.mc__author {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  color: var(--text-sub);
  font-size: 11px;
}

.mc__author svg {
  flex-shrink: 0;
  width: 11px;
  height: 11px;
  color: var(--text-faint);
}

.mc__author-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mc__meta {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
}

.mc__tag {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  height: 17px;
  max-width: 100%;
  padding: 0 5px;
  overflow: hidden;
  border: 1px solid var(--inner-border);
  border-radius: 5px;
  background: transparent;
  color: var(--text-sub);
  font-family: inherit;
  font-size: 10px;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

button.mc__tag {
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background-color 0.15s ease;
}

button.mc__tag:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--bg-hover);
  color: var(--accent);
}

button.mc__tag:disabled {
  cursor: default;
  opacity: 0.7;
}

.mc__tag--id {
  max-width: 72px;
}

.mc__tag--group {
  flex-shrink: 1;
  min-width: 0;
  color: var(--text-faint);
}

.mc__desc {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  min-height: 3em;
  color: var(--text-sub);
  font-size: 11px;
  line-height: 1.5;
  word-break: break-word;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.mc__desc.is-empty {
  color: var(--text-faint);
}

.mc__foot {
  padding-top: 6px;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  border-top: 1px solid var(--divider);
}

.mc__switch {
  position: relative;
  flex-shrink: 0;
  width: 26px;
  height: 14px;
  cursor: pointer;
}

.mc__switch input {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.mc__slider {
  position: absolute;
  inset: 0;
  border-radius: 7px;
  background: var(--inner-border);
  transition: background-color 0.2s ease;
}

.mc__slider::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s ease;
}

.mc__switch input:checked + .mc__slider {
  background: var(--success);
}

.mc__switch input:checked + .mc__slider::before {
  transform: translateX(12px);
}

.mc__switch input:focus-visible + .mc__slider {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.mc__actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.mc__act {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--text-sub);
  cursor: pointer;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
}

.mc__act svg {
  width: 13px;
  height: 13px;
}

.mc__act:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.mc__act.is-danger:hover {
  background: var(--danger-soft);
  color: var(--danger);
}

.mc__act:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.empty {
  padding: 40px;
  text-align: center;
  font-size: 12px;
  color: var(--text-sub);
}

@media (prefers-reduced-motion: reduce) {
  .mc,
  .mc__cover-inner img,
  .mc__slider::before {
    transition: none;
  }

  .mc:hover {
    transform: none;
  }

  .mc:hover .mc__cover-inner img {
    transform: none;
  }
}
</style>
