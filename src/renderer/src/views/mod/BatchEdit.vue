<template>
  <Transition name="dialog">
    <div class="mask" v-if="visible">
      <div class="dialog glass" @click.stop>
        <div class="dialog__title glass-title">
          <span>批量修改{{ mode === 'group' ? '分组' : '类型' }}</span>
          <button class="close" @click="close">×</button>
        </div>

        <div class="dialog__content">
          <div class="tip">已选中 {{ mods?.length || 0 }} 个模组</div>

          <!-- 列表 -->
          <div class="mod-list">
            <div class="mod-list__item" v-for="mod in mods" :key="mod.id">
              <span class="name">{{ mod.name }}</span>
              <span class="type" v-if="mode === 'type'">{{ mod.type }}</span>
              <span class="group" v-else>{{ mod.group }}</span>
            </div>
          </div>

          <div class="field">
            <label>{{ mode === 'group' ? '分组' : '类型' }}</label>
            <input
              v-model="value"
              type="text"
              :placeholder="`请输入要修改的${mode === 'group' ? '分组' : '类型'}`"
            />
          </div>
        </div>

        <div class="dialog__buttons">
          <button @click="close">取消</button>
          <button class="confirm" @click="save">确认</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  visible: Boolean,
  mode: {
    type: String,
    default: 'group'
  },
  mods: Array
})

const emit = defineEmits(['update:visible', 'save'])

const value = ref('')

watch(
  () => props.visible,
  (val) => {
    if (val) value.value = ''
  }
)

const close = () => emit('update:visible', false)

const save = () => {
  if (!value.value.trim()) return
  emit('save', { mode: props.mode, value: value.value.trim() })
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
  width: 500px;
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
  flex: 1;
}

.tip {
  font-size: 12px;
  color: var(--text-sub);
}

.mod-list {
  max-height: 40vh;
  overflow-y: auto;
  padding: 6px;
  border-radius: 6px;
  border: 1px solid var(--inner-border);
  background: var(--inner-bg);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mod-list__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--text);
  border-radius: 4px;
}

.mod-list__item:hover {
  background: var(--bg-hover);
}

.mod-list__item .name {
  flex: 1;
  word-break: break-all;
  overflow: hidden;
}

.mod-list__item .type {
  font-size: 10px;
  color: var(--text);
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--bg-hover);
  flex-shrink: 0;
}

.mod-list__item .group {
  font-size: 10px;
  color: var(--text);
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--bg-hover);
  flex-shrink: 0;
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

.field input::placeholder {
  color: var(--text-sub);
}

.field input:focus {
  border-color: var(--accent);
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

/* 过渡 */
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-active .dialog,
.dialog-leave-active .dialog {
  transition: transform 0.2s ease;
}

.dialog-enter-from .dialog,
.dialog-leave-to .dialog {
  transform: scale(0.95);
}
</style>
