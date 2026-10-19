<template>
  <Transition name="dialog">
    <div class="mask" v-if="visible" @click="close">
      <div class="dialog glass" @click.stop>
        <div class="dialog__title glass-title">
          <span>{{ mod?.name ?? 'Mod 详情' }}</span>
          <button class="close" @click="close">×</button>
        </div>

        <div class="dialog__content">
          <div class="info">
            <div class="dialog__cover">
              <img v-if="mod.cover" :src="mod?.cover" @click="previewVisible = true" />
              <svg v-else viewBox="0 0 1024 1024" version="1.1" p-id="2826">
                <path
                  d="M903.5 135.4H120.2c-29.8 0-56 24.2-56 56v639.7c0 29.8 26.1 56 56 56h783.3c29.8 0 55.9-24.2 55.9-56V191.4c0-29.8-24.2-56-55.9-56z m0 697.6H120.2V668.9L344 452.5l231.3 229.4c9.3 11.2 26.1 9.3 39.2 1.9L717 592.4l184.6 188.4 1.9 1.9V833z m0-130.6L739.4 534.6c-9.3-9.3-26.1-11.2-37.3-1.9l-104.4 91.4-231.3-229.4c-9.3-11.2-28-13.1-39.2-3.7l-1.9 1.9-205.1 197.6V191.4h783.3v511zM707.7 415.2c31.7 0 55.9-24.2 55.9-56 0-31.7-24.2-55.9-55.9-55.9s-56 24.2-56 55.9c0 31.8 24.3 56 56 56z m0 0"
                  p-id="2827"></path>
              </svg>
            </div>

            <div class="row">
              <span>版本</span>
              <span>{{ mod?.version }}</span>
            </div>
            <div class="row">
              <span>模组ID</span>
              <span>{{ mod?.modId }}</span>
            </div>
            <div class="row">
              <span>模组类型</span>
              <span>{{ mod?.type }}</span>
            </div>
            <div class="row">
              <span>分组</span>
              <span>{{ mod?.group }}</span>
            </div>
            <div class="row">
              <span>作者</span>
              <span>{{ mod?.author }}</span>
            </div>

            <div class="row row-describe">
              <span>描述</span>
              <p>{{ mod?.describe }}</p>
            </div>
          </div>

          <div class="file">
            <div class="file__title">模组文件清单</div>
            <div class="file__list">
              <FileTree :items="modFiles" />
            </div>
          </div>
        </div>

        <div class="dialog__buttons">
          <button @click="close">关闭</button>
        </div>
      </div>
    </div>
  </Transition>

  <Teleport to="body">
    <div class="preview" v-if="previewVisible" @click="onPreviewClick" @contextmenu.prevent="previewVisible = false"
      @wheel.prevent="onPreviewWheel" @mousedown="onPreviewDown" @mousemove="onPreviewMove" @mouseup="onPreviewUp"
      @mouseleave="onPreviewUp">
      <img :src="mod?.cover" draggable="false"
        :style="{ transform: `translate(${previewX}px, ${previewY}px) scale(${previewScale})` }" />
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useModStore } from '@/stores/mod'
import { useSettingStore } from '@/stores/setting'
import { storeToRefs } from 'pinia'
import FileTree from './FileTree.vue'

const props = defineProps({
  visible: Boolean,
  mod: Object
})

const modStore = useModStore()
const { modFiles } = storeToRefs(modStore)
const { fetchModFiles } = modStore

const settingStore = useSettingStore()
const { activeGameId } = storeToRefs(settingStore)

// ===== 预览层状态 =====
const previewVisible = ref(false)  // 预览是否打开
const previewScale = ref(1)        // 缩放倍数
const previewX = ref(0)            // 水平平移量
const previewY = ref(0)            // 垂直平移量

// ===== 拖拽过程变量（仅逻辑判断用，不需要响应式）=====
let hasDragged = false   // 本次按下期间是否真的拖动过（用于区分"拖拽"和"点击"）
let isDragging = false   // 当前是否处于按住拖拽中
let startX = 0           // 按下时的鼠标 X
let startY = 0           // 按下时的鼠标 Y
let startOffsetX = 0     // 按下时的水平平移量（拖拽基准）
let startOffsetY = 0     // 按下时的垂直平移量（拖拽基准）

// 按下：记录起点与当前平移量，进入拖拽状态
const onPreviewDown = (e) => {
  isDragging = true
  hasDragged = false
  startX = e.clientX
  startY = e.clientY
  startOffsetX = previewX.value
  startOffsetY = previewY.value
}

// 移动：超过 5px 判定为拖拽，按"起始偏移 + 鼠标位移"更新平移，避免累加误差
const onPreviewMove = (e) => {
  if (!isDragging) return
  if (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5) {
    hasDragged = true
  }
  previewX.value = startOffsetX + (e.clientX - startX)
  previewY.value = startOffsetY + (e.clientY - startY)
}

// 松开 / 移出：结束拖拽
const onPreviewUp = () => {
  isDragging = false
}

// 点击背景：没拖动过才关闭预览，避免拖拽后松手误触关闭
const onPreviewClick = () => {
  if (hasDragged) return
  previewVisible.value = false
}

// 滚轮：缩放，限制在 0.5～5 倍
const onPreviewWheel = (e) => {
  if (e.deltaY < 0) {
    previewScale.value = Math.min(5, previewScale.value + 0.1)
  } else {
    previewScale.value = Math.max(0.5, previewScale.value - 0.1)
  }
}

watch(() => props.visible, async (val) => {
  if (val && props.mod) {
    await fetchModFiles(activeGameId.value, props.mod.path)
  }
})

watch(previewVisible, (val) => {
  if (val) {
    previewScale.value = 1
    previewX.value = 0
    previewY.value = 0
  }
})

const emit = defineEmits(['update:visible'])

const close = () => emit('update:visible', false)
</script>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  width: 80vh;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  color: var(--text);
}

.dialog__title {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.close {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: var(--text-sub);
  cursor: pointer;
  border: none;
  border-radius: 6px;
  background: none;
  transition: background-color 0.2s ease;
}

.close:hover {
  background: var(--bg-hover);
}

.dialog__content {
  flex: 1;
  gap: 6px;
  overflow: hidden;
  padding: 16px;
  display: flex;
  justify-content: center;
}

.dialog__content .info {
  width: 200px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 12px 12px 12px;
  gap: 12px;
  display: flex;
  flex-direction: column;
}

.dialog__cover {
  width: 200px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 4px;
  flex-shrink: 0;
  align-self: flex-start;
}

.dialog__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  cursor: pointer;
}

.dialog__cover svg {
  width: 16px;
  height: 16px;
  display: block;
  fill: var(--text-sub);
}

.row {
  gap: 12px;
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.row span:nth-child(1) {
  color: var(--text-sub);
}

.row-describe {
  display: flex;
  flex-direction: column;
}

.row-describe p {
  white-space: pre-line;
  word-break: break-all;
  overflow-wrap: break-word;
}

.file {
  gap: 8px;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.file__title {
  font-size: 12px;
  color: var(--text-sub);
}

.file__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file__item {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
}

.file__item:hover {
  background: var(--bg-hover);
}

.file__size {
  color: var(--text-sub);
}

.dialog__buttons {
  padding: 12px 16px;
  display: flex;
  justify-content: flex-end;
}

.dialog__buttons button {
  padding: 6px 16px;
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
  border-radius: 8px;
  border: 1px solid var(--panel-border);
  background: none;
  transition: background-color 0.2s ease;
}

.dialog__buttons button:hover {
  background: var(--bg-hover);
}

.preview {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.preview img {
  cursor: grab;
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  transition: transform 0.1s ease;
}

.preview img:active {
  cursor: grabbing;
}

/* 遮罩淡入淡出 */
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

/* 弹窗缩放 */
.dialog-enter-active .dialog,
.dialog-leave-active .dialog {
  transition: transform 0.2s ease;
}

.dialog-enter-from .dialog,
.dialog-leave-to .dialog {
  transform: scale(0.95);
}
</style>
