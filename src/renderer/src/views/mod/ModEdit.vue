<template>
  <Transition name="dialog">
    <div class="mask" v-if="visible">
      <div class="dialog glass" @click.stop>
        <div class="dialog__title glass-title">
          <span>编辑模组 -{{ form.name }}</span>
          <button class="close" @click="close">×</button>
        </div>

        <div class="dialog__content">
          <div class="field">
            <label>封面</label>
            <div class="cover-upload" :class="{ 'drag-over': isDragOver }" @click="handlePickCover"
              @dragover.prevent="isDragOver = true" @dragleave="isDragOver = false" @drop.prevent="onCoverDrop">
              <img :src="coverPreview || form.cover" v-if="coverPreview || form.cover" />
              <div v-else class="cover-empty">点击上传</div>
            </div>
          </div>

          <div class="field">
            <label>名称</label>
            <input v-model="form.name" type="text" />
          </div>

          <div class="field">
            <label>类型</label>
            <input v-model="form.type" type="text" />
          </div>

          <div class="field">
            <label>模组ID</label>
            <input v-model="form.modId" type="text" />
          </div>

          <div class="field">
            <label>分组</label>
            <input v-model="form.group" />
          </div>

          <div class="field">
            <label>作者</label>
            <input v-model="form.author" type="text" />
          </div>

          <div class="field">
            <label>版本</label>
            <input v-model="form.version" type="text" />
          </div>

          <div class="field">
            <label>描述</label>
            <textarea ref="descRef" v-model="form.describe" @input="autoResize"></textarea>
          </div>
        </div>

        <div class="dialog__buttons">
          <button @click="close">取消</button>
          <button class="confirm" @click="save">保存</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, reactive, watch, nextTick } from 'vue'
import { useModStore } from '@/stores/mod'

const props = defineProps({
  visible: Boolean,
  mod: Object
})

const modStore = useModStore()
const { pickCover } = modStore

const emit = defineEmits(['update:visible', 'save'])

const descRef = ref(null)
const coverPreview = ref('')
const isDragOver = ref(false)
const form = reactive({
  id: null,
  name: '',
  path: '',
  type: '',
  modId: '',
  group: '',
  version: '',
  author: '',
  cover: '',
  describe: ''
})

// 拖拽上传
const onCoverDrop = (e) => {
  isDragOver.value = false
  const file = e.dataTransfer.files[0]
  if (!file) return

  const path = window.electronAPI.getPathForFile(file)
  if (!path) return

  coverPreview.value = URL.createObjectURL(file) // 预览
  form.cover = path // 源路径
}

// 点击上传
const handlePickCover = async () => {
  const path = await pickCover()
  if (path) {
    coverPreview.value = `file:///${path.replace(/\\/g, '/')}` // 临时路径，预览
    form.cover = path // 传给父组件
  }
}

// 自动调整 textarea 高度
const autoResize = (e) => {
  e.target.style.height = 'auto'
  e.target.style.height = e.target.scrollHeight + 'px'
}

// 打开时，把 mod 数据填进表单
watch(
  () => props.visible,
  (val) => {
    if (val && props.mod) {
      Object.assign(form, {
        id: props.mod.id,
        name: props.mod.name || '',
        path: props.mod.path || '',
        type: props.mod.type || '',
        modId: props.mod.modId || '',
        group: props.mod.group || '',
        version: props.mod.version || '',
        author: props.mod.author || '',
        cover: '',
        describe: props.mod.describe || ''
      })
    }
    coverPreview.value = props.mod.cover || ''
  }
)

// 自动调整 textarea 高度
watch(
  () => props.visible,
  async (val) => {
    if (val) {
      await nextTick()
      const el = descRef.value
      if (el) {
        el.style.height = 'auto'
        el.style.height = el.scrollHeight + 'px'
      }
    }
  }
)

watch(
  () => form.type,
  (val) => {
    if (!val) {
      form.name = form.name.replace(/^【(.+?)】/, '')
    } else if (/^【(.+?)】/.test(form.name)) {
      form.name = form.name.replace(/^【(.+?)】/, `【${val}】`)
    } else {
      form.name = `【${val}】${form.name}`
    }
  }
)

const close = () => emit('update:visible', false)

const save = async () => {
  emit('save', { ...form })
  close()
}
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
  width: 400px;
  max-height: 80vh;
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
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field label {
  font-size: 12px;
  color: var(--text-sub);
}

.field input {
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text);
  border-radius: 6px;
  border: 1px solid var(--inner-border);
  background: var(--inner-bg);
  outline: none;
  transition: border-color 0.2s ease;
}

.field input:focus {
  border-color: var(--accent);
}

.field textarea {
  box-sizing: border-box;
  padding: 8px 10px;
  font-size: 12px;
  font-family: inherit;
  color: var(--text);
  border-radius: 6px;
  border: 1px solid var(--inner-border);
  background: var(--inner-bg);
  outline: none;
  resize: vertical;
  line-height: 1.5;
  transition: border-color 0.2s ease;
}

.field textarea:focus {
  border-color: var(--accent);
}

.field textarea::placeholder {
  color: var(--text-sub);
}

.cover-upload {
  width: 100%;
  height: 112px;
  border-radius: 8px;
  border: 1.5px dashed var(--panel-border);
  cursor: pointer;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s ease;
}

.cover-upload:hover {
  border-color: var(--accent);
}

.cover-upload.drag-over {
  border-color: var(--accent);
  background: var(--bg-hover);
}

.cover-upload img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-empty {
  font-size: 11px;
  color: var(--text-sub);
}

.dialog__buttons {
  padding: 12px 16px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
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

.dialog__buttons .confirm {
  color: #fff;
  background: var(--accent);
  border-color: var(--accent);
}

.dialog__buttons .confirm:hover {
  opacity: 0.9;
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
