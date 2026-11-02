<template>
  <Teleport to="body">
    <div class="toast-wrap" aria-live="polite">
      <TransitionGroup name="toast">
        <div v-for="item in toast.items" :key="item.id" class="toast" :class="`toast--${item.type}`" role="status">
          <span class="toast__icon">
            <svg v-if="item.type === 'success'" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="m3 8 3.2 3.2L13 4.5" />
            </svg>
            <svg v-else-if="item.type === 'error'" viewBox="0 0 16 16" fill="none" stroke="currentColor"
              stroke-width="1.8" stroke-linecap="round">
              <path d="m4 4 8 8M12 4l-8 8" />
            </svg>
            <svg v-else viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 4.8v4.1M8 11.6v.1" />
            </svg>
          </span>
          <span class="toast__text">{{ item.message }}</span>
          <button class="toast__close" type="button" aria-label="关闭提示" @click="toast.close(item.id)">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <path d="m4 4 8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
</script>

<style scoped>
.toast-wrap {
  position: fixed;
  top: 54px;
  left: 50%;
  z-index: 5000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  transform: translateX(-50%);
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 260px;
  max-width: min(520px, calc(100vw - 40px));
  padding: 9px 10px 9px 12px;
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  background: var(--panel-bg);
  color: var(--text);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22);
  font-size: 12px;
  line-height: 1.5;
}

.toast__icon {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  display: flex;
  color: var(--accent);
}

.toast--error .toast__icon {
  color: var(--danger);
}

.toast--warning .toast__icon {
  color: var(--warning);
}

.toast__icon svg {
  width: 16px;
  height: 16px;
}

.toast__text {
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

.toast__close {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  padding: 3px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-sub);
  cursor: pointer;
}

.toast__close:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.toast__close svg {
  width: 14px;
  height: 14px;
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
