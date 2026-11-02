import { defineStore } from 'pinia'
import { ref } from 'vue'

let seed = 0

export const useToastStore = defineStore('toast', () => {
  const items = ref([])
  const timers = new Map()

  const close = (id) => {
    const timer = timers.get(id)
    if (timer) clearTimeout(timer)
    timers.delete(id)
    items.value = items.value.filter((item) => item.id !== id)
  }

  const show = (message, type = 'info', duration = 3200) => {
    if (!message) return
    const id = ++seed
    items.value.push({ id, message, type })
    timers.set(
      id,
      setTimeout(() => close(id), duration)
    )
    return id
  }

  return {
    items,
    show,
    close,
    success: (message, duration) => show(message, 'success', duration),
    error: (message, duration) => show(message, 'error', duration),
    warning: (message, duration) => show(message, 'warning', duration),
    info: (message, duration) => show(message, 'info', duration)
  }
})
