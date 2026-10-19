<template>
  <div class="mod__upload glass-card">
    <div class="upload-header" @click="uploadOpen = !uploadOpen">
      <div class="title">
        <svg viewBox="0 0 1024 1024" version="1.1" p-id="4915">
          <path
            d="M153.6 902.656a32.256 32.256 0 0 1 0-64h716.8a32.256 32.256 0 0 1 0 64z m390.656-665.6v494.592a32.256 32.256 0 0 1-64 0V237.056L236.032 481.28a31.744 31.744 0 1 1-45.056-45.056l294.912-295.424a36.864 36.864 0 0 1 51.2 0l294.912 294.912a31.744 31.744 0 0 1-45.056 45.056z"
            p-id="4916"></path>
        </svg>
        <span>模组上传</span>
      </div>

      <button @click.stop="">
        <svg viewBox="0 0 1024 1024" version="1.1" p-id="4894">
          <path
            d="M970.666667 213.333333H546.586667a10.573333 10.573333 0 0 1-7.54-3.126666L429.793333 100.953333A52.986667 52.986667 0 0 0 392.08 85.333333H96a53.393333 53.393333 0 0 0-53.333333 53.333334v704a53.393333 53.393333 0 0 0 53.333333 53.333333h874.666667a53.393333 53.393333 0 0 0 53.333333-53.333333V266.666667a53.393333 53.393333 0 0 0-53.333333-53.333334z m10.666666 629.333334a10.666667 10.666667 0 0 1-10.666666 10.666666H96a10.666667 10.666667 0 0 1-10.666667-10.666666V138.666667a10.666667 10.666667 0 0 1 10.666667-10.666667h296.08a10.573333 10.573333 0 0 1 7.54 3.126667l109.253333 109.253333A52.986667 52.986667 0 0 0 546.586667 256H970.666667a10.666667 10.666667 0 0 1 10.666666 10.666667z m-298.666666-309.333334a21.333333 21.333333 0 0 1-21.333334 21.333334H554.666667v106.666666a21.333333 21.333333 0 0 1-42.666667 0V554.666667H405.333333a21.333333 21.333333 0 0 1 0-42.666667h106.666667V405.333333a21.333333 21.333333 0 0 1 42.666667 0v106.666667h106.666666a21.333333 21.333333 0 0 1 21.333334 21.333333z"
            p-id="4895"></path>
        </svg>
        <span>文件夹/压缩包批量导入</span>
      </button>
      <button @click.stop="">
        <svg viewBox="0 0 1024 1024" version="1.1" p-id="5975">
          <path
            d="M0 841.264833m66.698336 0l889.920264 0q66.698336 0 66.698336 66.698336l0 49.338495q0 66.698336-66.698336 66.698336l-889.920264 0q-66.698336 0-66.698336-66.698336l0-49.338495q0-66.698336 66.698336-66.698336Z"
            p-id="5976"></path>
          <path
            d="M571.412868 698.000462L798.18721 420.973948a19.187193 19.187193 0 0 0-14.984284-31.430448h-99.590666C683.61226 66.102254 395.987107 8.357941 240.84495 0.683064a18.273517 18.273517 0 0 0-10.050434 36.547033c115.30589 61.947222 166.106267 167.202678 172.136528 332.212534A19.187193 19.187193 0 0 1 383.743851 388.812559h-79.672533a19.187193 19.187193 0 0 0-14.801548 32.161389l226.774342 277.757455a36.547033 36.547033 0 0 0 55.368756-0.730941z"
            p-id="5977"></path>
        </svg>
        
        <span>导入整合包</span>
      </button>
      <button @click.stop="">
        <svg viewBox="0 0 1024 1024" version="1.1" p-id="9555" width="16" height="16">
          <path
            d="M102.505095 877.1448H919.213044c33.644561-1.453005 61.220885 15.425134 61.193458 46.580454v5.268816c1.031553 33.814479-26.879926 51.281313-61.193458 49.925309H102.505095c-40.773785 0-59.002577-12.693057-61.198809-48.587367v-5.269485c1.527261-36.214079 23.157771-49.147965 61.198809-47.917727z m836.401788-537.958418L612.352681 56.719379a18.939908 18.939908 0 0 0-20.044379-2.474524 18.955295 18.955295 0 0 0-10.895532 17.003906v158.855872c-0.14985 9.740887-7.766754 16.692834-17.28755 18.76263-407.396677 88.581132-472.185854 425.174582-474.324554 546.45502-0.15587 8.819045 6.040809 16.485453 14.619024 18.501732 8.580223 2.014272 17.422013-2.150073 21.325459-10.057311C209.917762 630.319236 340.613297 444.815572 561.577779 463.097213c5.178505 0.428141 10.243954 1.745345 13.982163 5.357789 3.746238 3.612444 5.860186 8.593602 5.852828 13.794183v155.116992a18.953288 18.953288 0 0 0 10.805889 17.159108 18.936563 18.936563 0 0 0 20.134022-2.426358l326.554202-284.138093a19.157324 19.157324 0 0 0 6.512433-14.386891c0-5.509646-2.374847-10.754379-6.512433-14.387561z m0 0"
            p-id="9556"></path>
        </svg>
        <span>导出整合包</span>
      </button>

      <svg class="close" :class="{ open: !uploadOpen }" @click.stop="uploadOpen = false" viewBox="0 0 16 16"
        stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 6l4 4 4-4"></path>
      </svg>
    </div>

    <Transition name="upload">
      <div class="upload-file" v-if="uploadOpen" @click="() => importMods()" :class="{ 'drag-over': isDragOver }"
        @dragover.prevent="isDragOver = true" @dragleave="onDragLeave" @drop.prevent="handleDrop">
        <svg v-if="!isDragOver" class="icon-default" viewBox="0 0 1024 1024" version="1.1" p-id="4894">
          <path
            d="M970.666667 213.333333H546.586667a10.573333 10.573333 0 0 1-7.54-3.126666L429.793333 100.953333A52.986667 52.986667 0 0 0 392.08 85.333333H96a53.393333 53.393333 0 0 0-53.333333 53.333334v704a53.393333 53.393333 0 0 0 53.333333 53.333333h874.666667a53.393333 53.393333 0 0 0 53.333333-53.333333V266.666667a53.393333 53.393333 0 0 0-53.333333-53.333334z m10.666666 629.333334a10.666667 10.666667 0 0 1-10.666666 10.666666H96a10.666667 10.666667 0 0 1-10.666667-10.666666V138.666667a10.666667 10.666667 0 0 1 10.666667-10.666667h296.08a10.573333 10.573333 0 0 1 7.54 3.126667l109.253333 109.253333A52.986667 52.986667 0 0 0 546.586667 256H970.666667a10.666667 10.666667 0 0 1 10.666666 10.666667z m-298.666666-309.333334a21.333333 21.333333 0 0 1-21.333334 21.333334H554.666667v106.666666a21.333333 21.333333 0 0 1-42.666667 0V554.666667H405.333333a21.333333 21.333333 0 0 1 0-42.666667h106.666667V405.333333a21.333333 21.333333 0 0 1 42.666667 0v106.666667h106.666666a21.333333 21.333333 0 0 1 21.333334 21.333333z"
            p-id="4895"></path>
        </svg>
        <svg v-else class="icon-drag" viewBox="0 0 1024 1024" version="1.1" p-id="4915">
          <path
            d="M153.6 902.656a32.256 32.256 0 0 1 0-64h716.8a32.256 32.256 0 0 1 0 64z m390.656-665.6v494.592a32.256 32.256 0 0 1-64 0V237.056L236.032 481.28a31.744 31.744 0 1 1-45.056-45.056l294.912-295.424a36.864 36.864 0 0 1 51.2 0l294.912 294.912a31.744 31.744 0 0 1-45.056 45.056z"
            p-id="4916"></path>
        </svg>
        <span>{{
          isDragOver
            ? '释放文件开始上传'
            : '拖拽文件到此处或点击上传, 支持 ZIP、RAR、7Z、GMM格式, 限制10g(整合包请走导入整合包按钮!)'
        }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useModStore } from '@/stores/mod'

const modStore = useModStore()
const { importMods } = modStore

const uploadOpen = ref(false)
const isDragOver = ref(false)

// 拖拽文件时判断"鼠标是否真的离开了目标区域"的逻辑，用来控制 isDragOver 这个高亮状态的。
const onDragLeave = (e) => {
  if (!e.currentTarget.contains(e.relatedTarget)) isDragOver.value = false
}

// 拖拽上传
const handleDrop = (e) => {
  isDragOver.value = false
  const files = Array.from(e.dataTransfer.files)
  const paths = files.map((f) => window.electronAPI.getPathForFile(f)).filter(Boolean)
  if (paths.length) importMods(paths)
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
  border-bottom: 1px solid var(--inner-border);
  padding: 6px 16px;
  cursor: pointer;
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
</style>
