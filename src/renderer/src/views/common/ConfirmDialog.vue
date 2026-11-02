<template>
  <Transition name="dialog">
    <div class="mask" v-if="visible">
      <div class="dialog" @click.stop>
        <div class="dialog__title">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">
            <line x1="4" y1="4" x2="12" y2="12" />
            <line x1="12" y1="4" x2="4" y2="12" />
          </svg>
          <span>确认操作</span>
          <svg
            class="close"
            @click="cancel"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
          >
            <line x1="4" y1="4" x2="12" y2="12" />
            <line x1="12" y1="4" x2="4" y2="12" />
          </svg>
        </div>

        <div class="dialog__content">
          <span v-if="message">{{ message }}</span>
          <span v-else-if="type === 'mod'">确定要删除模组 "{{ title }}" 嘛？</span>
          <span v-else-if="type === 'mods'">确定要删除选中的 {{ title }} 个模组嘛？</span>
          <div class="warning">
            <svg
              t="1791028643833"
              class="icon"
              viewBox="0 0 1024 1024"
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              p-id="5806"
              width="16"
              height="16"
            >
              <path
                d="M511.87 33.99c-265.1 0-480 214.9-480 480s214.9 480 480 480 480-214.9 480-480-214.91-480-480-480z m-0.27 757.33c-27.61 0-50-22.39-50-50s22.39-50 50-50 50 22.39 50 50c0 27.62-22.39 50-50 50z m37.67-179.49c0 19.18-16.48 34.73-36.8 34.73-20.33 0-36.8-15.55-36.8-34.73 0 0-22.66-249.86-22.69-333.45-0.01-24.73 26.64-41.73 59.5-41.73 30.66 0 58.29 15.52 58.29 41.01-0.01 84.93-21.5 334.17-21.5 334.17z"
                fill="#FF9800"
                p-id="5807"
              ></path>
            </svg>
            <span>操作后无法撤销，请谨慎确认</span>
          </div>
        </div>

        <label
          v-if="checkbox"
          class="dialog__checkbox"
          :class="{ 'dialog__checkbox--on': checked }"
        >
          <input v-model="checked" type="checkbox" />
          <span class="dialog__check" aria-hidden="true">
            <svg
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m2.5 6.2 2.2 2.2 4.8-5" />
            </svg>
          </span>
          <span class="dialog__check-label">{{ checkboxLabel }}</span>
        </label>

        <div class="dialog__buttons">
          <button class="btn-cancel" @click="cancel">取消</button>
          <button class="btn-confirm" @click="confirm">确定</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  visible: Boolean,
  title: {
    type: [String, Number],
    default: ''
  },
  type: {
    type: String,
    default: ''
  },
  message: {
    type: String,
    default: ''
  },
  checkbox: Boolean,
  checkboxLabel: {
    type: String,
    default: '同时删除文件'
  }
})

const emit = defineEmits(['confirm', 'cancel'])
const checked = ref(false)

// 每次重新打开都回到默认状态，避免上次勾选残留
watch(
  () => props.visible,
  (visible) => {
    if (visible) checked.value = false
  }
)

const cancel = () => emit('cancel')
const confirm = () => emit('confirm', { checked: checked.value })
</script>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  width: 320px;
  padding: 12px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  background: var(--panel-bg);
}

.dialog__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  padding: 12px 0;
  gap: 12px;
  display: flex;
  align-items: center;
  justify-content: left;
  border-bottom: 1px solid var(--panel-border);
}

.dialog__title svg {
  width: 10px;
  height: 10px;
  padding: 4px 4px;
  background: #f44336;
  border-radius: 12px;
}

.dialog__title span {
  color: #f44336;
  font-weight: 500;
}

.dialog__title .close {
  display: block;
  padding: 3px;
  margin-left: auto;
  width: 16px;
  height: 16px;
  cursor: pointer;
  background: none;
  border-radius: 12px;
  color: var(--text-sub);
  transition: background-color 0.2s ease;
}

.dialog__title .close:hover {
  background: var(--bg-hover);
}

.dialog__content {
  flex: 1;
  gap: 6px;
  display: flex;
  flex-direction: column;
  padding: 12px 0 12px 26px;
  font-size: 13px;
  color: var(--text);
}

.dialog__content span:nth-child(1) {
  font-weight: 600;
}

.dialog__content span:nth-child(2) {
  font-size: 10px;
  color: var(--text-sub);
}

/* 警告框 —— 亮色 */
.dialog__content .warning {
  padding: 12px;
  gap: 6px;
  display: flex;
  align-items: center;
  justify-content: left;
  border-radius: 8px;
  background: #fff4e5;
  border: 1px solid #ffd9a8;
  border-left: 4px solid #f59e0b;
}

.dialog__content .warning span {
  color: #b45309;
  font-weight: 500;
}

/* 警告框 —— 暗色 */
:root.dark .dialog__content .warning {
  background: #8255134d;
  border: 1px solid #aa885c;
  border-left: 4px solid #ff9800;
}

:root.dark .dialog__content .warning span {
  color: #f79400;
}

.dialog__checkbox {
  margin: 8px 16px 0;
  padding: 9px 10px;
  display: flex;
  align-items: center;
  gap: 9px;
  border: 1px solid var(--inner-border);
  border-radius: 9px;
  background: var(--inner-bg);
  color: var(--text-sub);
  font-size: 12px;
  cursor: pointer;
  user-select: none;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
}

.dialog__checkbox:hover {
  background: var(--bg-hover);
  border-color: var(--panel-border);
  color: var(--text);
}

.dialog__checkbox--on {
  color: var(--text);
  border-color: color-mix(in srgb, var(--accent) 45%, var(--inner-border));
  background: color-mix(in srgb, var(--accent) 8%, var(--inner-bg));
}

.dialog__checkbox input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.dialog__check {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--inner-border);
  border-radius: 5px;
  background: var(--panel-bg);
  color: transparent;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;
}

.dialog__check svg {
  width: 11px;
  height: 11px;
}

.dialog__checkbox--on .dialog__check {
  color: #fff;
  background: var(--accent);
  border-color: var(--accent);
  transform: scale(1.04);
}

.dialog__checkbox input:focus-visible + .dialog__check {
  outline: 2px solid color-mix(in srgb, var(--accent) 45%, transparent);
  outline-offset: 2px;
}

.dialog__check-label {
  line-height: 1.4;
}

.dialog__buttons {
  padding: 12px 0;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.dialog__buttons button {
  padding: 6px 16px;
  border-radius: 16px;
  font-size: 12px;
  cursor: pointer;
  background: none;
  border: 1px solid var(--panel-border);
  transition: background-color 0.2s;
}

.btn-cancel {
  background: transparent;
  color: var(--text);
}

.btn-cancel:hover {
  background: var(--bg-hover);
}

.dialog__buttons .btn-confirm {
  color: #dc2626;
  border-color: #dc262655;
  transition: background-color 0.2s ease;
}

.dialog__buttons .btn-confirm:hover {
  background: #e74f4f55;
}

.btn-confirm:hover {
  opacity: 0.9;
}

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
</style>
