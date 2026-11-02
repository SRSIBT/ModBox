<template>
  <div class="mod__upload glass-card">
    <div class="upload-header" @click="uploadOpen = !uploadOpen">
      <div class="title">
        <svg viewBox="0 0 1024 1024" version="1.1" p-id="4915">
          <path
            d="M153.6 902.656a32.256 32.256 0 0 1 0-64h716.8a32.256 32.256 0 0 1 0 64z m390.656-665.6v494.592a32.256 32.256 0 0 1-64 0V237.056L236.032 481.28a31.744 31.744 0 1 1-45.056-45.056l294.912-295.424a36.864 36.864 0 0 1 51.2 0l294.912 294.912a31.744 31.744 0 0 1-45.056 45.056z"
            p-id="4916"
          ></path>
        </svg>
        <span>模组上传</span>
      </div>

      <button @click.stop="openDropzone">
        <svg viewBox="0 0 1024 1024" version="1.1" p-id="4894">
          <path
            d="M970.666667 213.333333H546.586667a10.573333 10.573333 0 0 1-7.54-3.126666L429.793333 100.953333A52.986667 52.986667 0 0 0 392.08 85.333333H96a53.393333 53.393333 0 0 0-53.333333 53.333334v704a53.393333 53.393333 0 0 0 53.333333 53.333333h874.666667a53.393333 53.393333 0 0 0 53.333333-53.333333V266.666667a53.393333 53.393333 0 0 0-53.333333-53.333334z m10.666666 629.333334a10.666667 10.666667 0 0 1-10.666666 10.666666H96a10.666667 10.666667 0 0 1-10.666667-10.666666V138.666667a10.666667 10.666667 0 0 1 10.666667-10.666667h296.08a10.573333 10.573333 0 0 1 7.54 3.126667l109.253333 109.253333A52.986667 52.986667 0 0 0 546.586667 256H970.666667a10.666667 10.666667 0 0 1 10.666666 10.666667z m-298.666666-309.333334a21.333333 21.333333 0 0 1-21.333334 21.333334H554.666667v106.666666a21.333333 21.333333 0 0 1-42.666667 0V554.666667H405.333333a21.333333 21.333333 0 0 1 0-42.666667h106.666667V405.333333a21.333333 21.333333 0 0 1 42.666667 0v106.666667h106.666666a21.333333 21.333333 0 0 1 21.333334 21.333333z"
            p-id="4895"
          ></path>
        </svg>
        <span>文件夹/压缩包批量导入</span>
      </button>

      <svg
        class="close"
        :class="{ open: !uploadOpen }"
        viewBox="0 0 16 16"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        @click.stop="uploadOpen = false"
      >
        <path d="M4 6l4 4 4-4"></path>
      </svg>
    </div>

    <Transition name="upload">
      <div
        v-if="uploadOpen"
        class="upload-file"
        :class="{ 'drag-over': isDragOver }"
        @click="importMods()"
        @dragover.prevent="isDragOver = true"
        @dragleave="onDragLeave"
        @drop.prevent="handleInlineDrop"
      >
        <svg
          v-if="!isDragOver"
          class="icon-default"
          viewBox="0 0 1024 1024"
          version="1.1"
          p-id="4894"
        >
          <path
            d="M970.666667 213.333333H546.586667a10.573333 10.573333 0 0 1-7.54-3.126666L429.793333 100.953333A52.986667 52.986667 0 0 0 392.08 85.333333H96a53.393333 53.393333 0 0 0-53.333333 53.333334v704a53.393333 53.393333 0 0 0 53.333333 53.333333h874.666667a53.393333 53.393333 0 0 0 53.333333-53.333333V266.666667a53.393333 53.393333 0 0 0-53.333333-53.333334z m10.666666 629.333334a10.666667 10.666667 0 0 1-10.666666 10.666666H96a10.666667 10.666667 0 0 1-10.666667-10.666666V138.666667a10.666667 10.666667 0 0 1 10.666667-10.666667h296.08a10.573333 10.573333 0 0 1 7.54 3.126667l109.253333 109.253333A52.986667 52.986667 0 0 0 546.586667 256H970.666667a10.666667 10.666667 0 0 1 10.666666 10.666667z m-298.666666-309.333334a21.333333 21.333333 0 0 1-21.333334 21.333334H554.666667v106.666666a21.333333 21.333333 0 0 1-42.666667 0V554.666667H405.333333a21.333333 21.333333 0 0 1 0-42.666667h106.666667V405.333333a21.333333 21.333333 0 0 1 42.666667 0v106.666667h106.666666a21.333333 21.333333 0 0 1 21.333334 21.333333z"
            p-id="4895"
          ></path>
        </svg>
        <svg v-else class="icon-drag" viewBox="0 0 1024 1024" version="1.1" p-id="4915">
          <path
            d="M153.6 902.656a32.256 32.256 0 0 1 0-64h716.8a32.256 32.256 0 0 1 0 64z m390.656-665.6v494.592a32.256 32.256 0 0 1-64 0V237.056L236.032 481.28a31.744 31.744 0 1 1-45.056-45.056l294.912-295.424a36.864 36.864 0 0 1 51.2 0l294.912 294.912a31.744 31.744 0 0 1-45.056 45.056z"
            p-id="4916"
          ></path>
        </svg>
        <span>{{
          isDragOver
            ? '释放文件开始上传'
            : '拖拽文件到此处或点击上传, 支持 ZIP、RAR、7Z 格式, 限制10g'
        }}</span>
      </div>
    </Transition>
  </div>

  <Teleport to="body">
    <Transition name="dz">
      <div
        v-if="dropzoneOpen"
        class="dz-mask"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dz-title"
        @click.self="closeDropzone"
        @dragover.prevent
        @drop.prevent
      >
        <div class="dz-modal">
          <header class="dz-header">
            <h3 id="dz-title">批量导入模组</h3>
            <button
              class="dz-close"
              type="button"
              :disabled="importing"
              aria-label="关闭"
              @click="closeDropzone"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">
                <line x1="4" y1="4" x2="12" y2="12" />
                <line x1="12" y1="4" x2="4" y2="12" />
              </svg>
            </button>
          </header>

          <div
            class="dz-area"
            :class="{ over: isDragOver }"
            @dragenter.prevent="isDragOver = true"
            @dragover.prevent="onDragOver"
            @dragleave.prevent="onDragLeave"
            @drop.prevent="onDrop"
          >
            <svg class="dz-icon" viewBox="0 0 1024 1024" version="1.1">
              <path
                d="M153.6 902.656a32.256 32.256 0 0 1 0-64h716.8a32.256 32.256 0 0 1 0 64z m390.656-665.6v494.592a32.256 32.256 0 0 1-64 0V237.056L236.032 481.28a31.744 31.744 0 1 1-45.056-45.056l294.912-295.424a36.864 36.864 0 0 1 51.2 0l294.912 294.912a31.744 31.744 0 0 1-45.056 45.056z"
              ></path>
            </svg>
            <p class="dz-hint">将模组文件夹或压缩包拖拽至此</p>
            <span class="dz-sub">支持文件夹与 .zip / .7z / .rar</span>
          </div>

          <div v-if="importing || progress > 0" class="dz-progress">
            <div class="dz-progress__bar">
              <span :style="{ width: `${progress}%` }"></span>
            </div>
            <div class="dz-progress__text">{{ progress }}%</div>
          </div>

          <p
            v-if="message"
            class="dz-message"
            :class="{ 'dz-message--error': message.includes('失败') }"
          >
            {{ message }}
          </p>

          <ul v-if="items.length" class="dz-list">
            <li v-for="item in items" :key="item.path" class="dz-item">
              <div class="dz-item__main">
                <span class="dz-item__name" :title="item.path">{{ item.name }}</span>
                <span class="dz-item__kind" :class="item.kind">
                  {{ item.kind === 'folder' ? '文件夹' : '压缩包' }}
                </span>
              </div>
              <button
                type="button"
                class="dz-remove"
                :disabled="importing"
                @click="removeItem(item.path)"
              >
                移除
              </button>
            </li>
          </ul>

          <footer class="dz-footer">
            <span class="dz-count">已添加 {{ items.length }} 项</span>
            <div class="dz-actions">
              <button type="button" class="dz-btn" :disabled="importing" @click="closeDropzone">
                取消
              </button>
              <button
                type="button"
                class="dz-btn dz-btn--primary"
                :disabled="!items.length || importing"
                @click="startImport"
              >
                {{ importing ? '导入中...' : '开始导入' }}
              </button>
            </div>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'
import { useModStore } from '@/stores/mod'
import { useToastStore } from '@/stores/toast'

const modStore = useModStore()
const { importMods, importModsWithProgress } = modStore
const toast = useToastStore()

const ARCHIVE_EXTS = ['.zip', '.7z', '.rar']

const uploadOpen = ref(false)
const dropzoneOpen = ref(false)
const isDragOver = ref(false)
const importing = ref(false)
const progress = ref(0)
const items = ref([])
const message = ref('')

const getExt = (name) => {
  const index = name.lastIndexOf('.')
  return index > -1 ? name.slice(index).toLowerCase() : ''
}

const openDropzone = () => {
  items.value = []
  message.value = ''
  isDragOver.value = false
  importing.value = false
  progress.value = 0
  dropzoneOpen.value = true
}

const closeDropzone = () => {
  if (importing.value) return
  dropzoneOpen.value = false
  isDragOver.value = false
  message.value = ''
}

const onDragOver = (e) => {
  e.dataTransfer.dropEffect = 'copy'
  if (!importing.value) isDragOver.value = true
}

const onDragLeave = (e) => {
  if (!e.currentTarget.contains(e.relatedTarget)) isDragOver.value = false
}

const addPaths = async (paths) => {
  const unique = [...new Set(paths)]
  const results = await Promise.all(
    unique.map(async (p) => {
      const info = await window.electronAPI?.getPathInfo?.(p)
      if (!info) return null

      const kind = info.isDirectory
        ? 'folder'
        : info.isFile && ARCHIVE_EXTS.includes(getExt(info.name))
          ? 'archive'
          : ''

      return kind ? { path: p, name: info.name, kind } : null
    })
  )

  if (!dropzoneOpen.value) return

  const valid = results.filter((item) => item && !items.value.some((old) => old.path === item.path))
  if (valid.length) items.value = [...items.value, ...valid]
  message.value = results.some((item) => !item) ? '只支持导入文件夹和压缩包' : ''
}

const getDroppedPaths = (e) =>
  Array.from(e.dataTransfer.files)
    .map((file) => file.path || window.electronAPI?.getPathForFile?.(file))
    .filter(Boolean)

const onDrop = async (e) => {
  e.preventDefault()
  isDragOver.value = false
  if (importing.value) return

  const paths = getDroppedPaths(e)
  if (paths.length) await addPaths(paths)
}

// 内联拖拽区：保持原来的“拖进来直接导入”行为
const handleInlineDrop = async (e) => {
  isDragOver.value = false
  const paths = getDroppedPaths(e)
  if (!paths.length) return

  const result = await importMods(paths)
  if (result?.errors?.length) {
    toast.warning(result.errors[0])
  } else if (result?.success) {
    toast.success('模组已导入')
  }
}

const removeItem = (path) => {
  items.value = items.value.filter((item) => item.path !== path)
}

const startImport = async () => {
  if (!items.value.length || importing.value) return

  importing.value = true
  progress.value = 0
  message.value = ''

  try {
    const result = await importModsWithProgress(items.value, (value) => {
      progress.value = value
    })

    if (result.errors.length) {
      message.value = `导入完成：成功 ${result.success} 个，失败 ${result.errors.length} 个。${result.errors.join('；')}`
      toast.warning(`导入完成：成功 ${result.success} 个，失败 ${result.errors.length} 个`)
    } else {
      message.value = `导入完成：成功 ${result.success} 个`
      toast.success(`已导入 ${result.success} 个模组`)
      items.value = []
      isDragOver.value = false
    }
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.mod__upload {
  flex-shrink: 0;
  color: var(--text);
  font-size: 12px;
  display: flex;
  flex-direction: column;
}

.mod__upload,
.upload-header {
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.upload-header {
  cursor: pointer;
  border-bottom: 1px solid var(--inner-border);
  padding: 6px 16px;
  gap: 16px;
  display: flex;
  align-items: center;
  justify-content: left;
  background: var(--inner-bg);
}

.upload-header svg {
  width: 16px;
  height: 16px;
  fill: var(--text);
}

.upload-header .title {
  gap: 6px;
  display: flex;
  align-items: center;
}

.upload-header button {
  cursor: pointer;
  gap: 6px;
  display: flex;
  align-items: center;
  color: var(--text);
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 12px;
  background: none;
  border: 1px solid var(--inner-border);
  transition: background-color 0.2s ease;
}

.upload-header button:hover {
  background: var(--bg-hover);
}

.upload-header button svg {
  width: 12px;
  height: 12px;
}

.upload-header .close {
  display: block;
  width: 16px;
  height: 16px;
  margin-left: auto;
  fill: none;
  stroke: var(--bg-hover);
  transition:
    stroke 0.2s ease,
    transform 0.3s ease;
  cursor: pointer;
}

.upload-header .close:hover {
  stroke: var(--text-sub);
}

.upload-header .close.open {
  transform: rotate(180deg);
}

.upload-file {
  cursor: pointer;
  height: 98px;
  display: flex;
  align-items: center;
  flex-direction: column;
  transition: background-color 0.2s ease;
}

.upload-file svg {
  width: 36px;
  height: 60px;
  fill: var(--text);
}

.upload-file:hover {
  background: var(--bg-hover);
}

.upload-file.drag-over {
  background: var(--bg-hover);
}

.upload-file .icon-drag {
  animation: float 1s ease-in-out infinite;
}

@keyframes float {
  0% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-10px);
  }

  100% {
    transform: translateY(0);
  }
}

.upload-enter-active,
.upload-leave-active {
  transition:
    max-height 0.6s ease,
    opacity 0.6s ease;
  overflow: hidden;
}

.upload-enter-from,
.upload-leave-to {
  max-height: 0;
  opacity: 0;
}

.upload-enter-to,
.upload-leave-from {
  max-height: 100px;
  opacity: 1;
}

/* 拖拽池弹窗 */
.dz-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
}

.dz-modal {
  width: min(560px, 100%);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--text);
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.28);
}

.dz-header {
  display: flex;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--divider);
}

.dz-header h3 {
  margin: 0;
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
}

.dz-close {
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: none;
  color: var(--text-sub);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}

.dz-close:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text);
}

.dz-close:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dz-close svg {
  width: 14px;
  height: 14px;
}

.dz-area {
  margin: 18px 18px 0;
  min-height: 210px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
  border: 2px dashed var(--inner-border);
  border-radius: 12px;
  background: var(--inner-bg);
  cursor: default;
  user-select: none;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.dz-area.over {
  border-color: var(--accent);
  background: var(--success-soft);
}

.dz-icon {
  width: 40px;
  height: 40px;
  fill: var(--text-sub);
  transition:
    fill 0.2s ease,
    transform 0.2s ease;
}

.dz-area.over .dz-icon {
  fill: var(--accent);
  transform: translateY(-4px);
}

.dz-hint {
  margin: 0;
  color: var(--text);
  font-size: 14px;
  font-weight: 500;
}

.dz-sub {
  color: var(--text-sub);
  font-size: 11px;
}

.dz-progress {
  margin: 12px 18px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dz-progress__bar {
  flex: 1;
  height: 6px;
  overflow: hidden;
  border-radius: 99px;
  background: var(--inner-border);
}

.dz-progress__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 0.2s ease;
}

.dz-progress__text {
  width: 34px;
  text-align: right;
  color: var(--text-sub);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.dz-message {
  margin: 10px 18px 0;
  padding: 8px 10px;
  border-radius: 8px;
  color: var(--text-sub);
  background: var(--inner-bg);
  font-size: 12px;
  line-height: 1.6;
}

.dz-message--error {
  color: var(--danger);
  background: var(--danger-soft);
}

.dz-list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0 18px;
  max-height: 220px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dz-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border: 1px solid var(--inner-border);
  border-radius: 8px;
  background: var(--inner-bg);
}

.dz-item__main {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dz-item__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  font-size: 12px;
}

.dz-item__kind {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 999px;
  color: var(--text-sub);
  background: var(--bg-hover);
  font-size: 10px;
  line-height: 1.4;
}

.dz-item__kind.folder {
  color: var(--accent);
  background: var(--success-soft);
}

.dz-item__kind.archive {
  color: var(--warning);
  background: var(--warning-soft);
}

.dz-remove {
  flex-shrink: 0;
  padding: 3px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  color: var(--danger);
  font-size: 11px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.dz-remove:hover:not(:disabled) {
  background: var(--danger-soft);
}

.dz-remove:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dz-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding: 14px 18px;
  border-top: 1px solid var(--divider);
}

.dz-count {
  color: var(--text-sub);
  font-size: 11px;
}

.dz-actions {
  display: flex;
  gap: 8px;
}

.dz-btn {
  padding: 7px 14px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--inner-bg);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    opacity 0.2s ease;
}

.dz-btn:hover:not(:disabled) {
  background: var(--bg-hover);
}

.dz-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dz-btn--primary {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}

.dz-btn--primary:hover:not(:disabled) {
  background: var(--accent);
  opacity: 0.9;
}

.dz-enter-active,
.dz-leave-active {
  transition: opacity 0.2s ease;
}

.dz-enter-active .dz-modal,
.dz-leave-active .dz-modal {
  transition: transform 0.2s ease;
}

.dz-enter-from,
.dz-leave-to {
  opacity: 0;
}

.dz-enter-from .dz-modal,
.dz-leave-to .dz-modal {
  transform: translateY(8px) scale(0.97);
}
</style>
