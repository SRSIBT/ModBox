<template>
  <!--
    弧形无限轮盘：铺满容器、卡片尺寸写死、双份渲染实现无缝循环。
    轨道上摆的是 A B C D E A B C D E，内容本身按「一个周期」重复，
    所以偏移量滚过一个周期就取模挪回去，画面看不出接缝。
  -->
  <div ref="wheelEl" class="arc-wheel" :style="{
    '--arc-card-w': cardWidth + 'px',
    '--arc-card-h': cardHeight + 'px',
    '--arc-gap': gap + 'px'
  }">
    <div ref="trackEl" class="arc-wheel__track">
      <div v-for="s in renderSlots" :key="s.key" class="arc-wheel__slot" @click="onSlotClick(s.key)">
        <div class="arc-wheel__card">
          <slot :item="s.item" :index="s.real" :active="s.key === activeSlot">
            <div class="arc-wheel__fallback">{{ s.item.name }}</div>
          </slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'
import Observer from 'gsap/Observer'

gsap.registerPlugin(Observer)

const props = defineProps({
  items: { type: Array, default: () => [] },

  // 卡片尺寸写死
  cardWidth: { type: Number, default: 130 },
  cardHeight: { type: Number, default: 210 },
  gap: { type: Number, default: 18 },

  // 弧形
  angle: { type: Number, default: 12 }, // 边上那张倾斜多少度
  range: { type: Number, default: 4 }, // 离中心几张算"最边上"
  depth: { type: Number, default: 180 }, // 两侧往下沉多少 px
  shrink: { type: Number, default: 0.2 }, // 两侧缩多少
  grow: { type: Number, default: 0 }, // 中间那张放大多少

  // 交互
  wheelSpeed: { type: Number, default: 0.55 },
  snap: { type: Boolean, default: true }, // 停稳后吸附，让中间那张真正居中
  preventDefault: { type: Boolean, default: true },
  smooth: { type: Number, default: 0.82 }, // 越小越跟手
  initialIndex: { type: Number, default: 0 }
})

const emit = defineEmits(['change', 'cardClick'])

const wheelEl = ref(null)
const trackEl = ref(null)
const activeSlot = ref(-1)

// 渲染几份：先双份，容器比双份能覆盖的宽度更宽就自动加
const copyCount = ref(2)
const slotCount = computed(() => Math.max(1, props.items.length) * copyCount.value)
const renderSlots = computed(() => {
  const n = props.items.length
  if (!n) return []
  const out = []
  for (let s = 0; s < slotCount.value; s++) {
    out.push({ key: s, item: props.items[s % n], real: s % n })
  }
  return out
})

// offset = 目标偏移（已向左卷过多少 px）；shown = 实际渲染的偏移，每帧平滑追 offset
// 渲染时取模到 [0, 周期)，等价于"滚过一个周期就把带子挪回一个周期"
let stride = 0
let period = 0
let viewWidth = 0
let offset = 0
let shown = 0
let inited = false
let pendingSnap = false
let activeDist = 0 // 居中那张离中心多少 px
let activeReal = -1 // 上次抛出的下标，用来去重

let cardEls = []
let setTrackX = null
let observer = null
let resizeObserver = null
let settleTimer = null

const clamp = (min, max, v) => (v < min ? min : v > max ? max : v)
const mod = (v, m) => ((v % m) + m) % m // 取模到 [0, m)，负数也正确

function measure() {
  if (!trackEl.value || !props.items.length) return false
  const slots = Array.from(trackEl.value.querySelectorAll('.arc-wheel__slot'))
  if (slots.length < 2) return false
  cardEls = slots.map((s) => s.firstElementChild)
  stride = slots[1].offsetLeft - slots[0].offsetLeft
  period = stride * props.items.length
  return stride > 0 && period > 0
}

// 双份能覆盖「周期 − 一个间距」，容器更宽就多来一份
function updateCopies() {
  const need = Math.max(2, Math.ceil((viewWidth + props.gap) / period) + 1)
  if (need !== copyCount.value) copyCount.value = need
}

function render() {
  if (!period || !setTrackX) return
  const x = mod(shown, period)
  setTrackX(-x)
  updateArc(x)
}

// 弧形：按"卡片中心离容器中心多远"算倾斜 / 下沉 / 缩放
function updateArc(x) {
  const center = viewWidth / 2
  const w = props.cardWidth
  const range = Math.max(0.5, props.range)
  let bestSlot = -1
  let bestDist = Infinity

  for (let i = 0; i < cardEls.length; i++) {
    const card = cardEls[i]
    if (!card) continue

    const d = i * stride + w / 2 - x - center
    const abs = Math.abs(d)
    if (abs < bestDist) {
      bestDist = abs
      bestSlot = i
    }

    const k = clamp(-1, 1, d / stride / range) // 0 = 正中，±1 = 最边上
    const near = Math.max(0, 1 - abs / (stride * 0.6)) // 1 = 正中

    gsap.set(card, {
      rotation: k * props.angle,
      y: props.depth * k * k,
      scale: (1 - props.shrink * k * k) * (1 + props.grow * near * near),
      opacity: Math.max(0.35, 1 - 0.55 * k * k),
      zIndex: Math.round(10000 - abs)
    })
    card.style.setProperty('--arc-near', near.toFixed(3))
    card.style.setProperty('--arc-k', Math.abs(k).toFixed(3))
  }

  activeSlot.value = bestSlot
  activeDist = bestDist

  if (bestSlot >= 0 && props.items.length) {
    const real = bestSlot % props.items.length
    if (real !== activeReal) {
      activeReal = real
      emit('change', { index: real, item: props.items[real] })
    }
  }
}

function tick(_time, deltaTime) {
  if (!period) return
  const dt = Math.min(deltaTime || 16.67, 50) / 16.67
  shown += (offset - shown) * (1 - Math.pow(props.smooth, dt))

  // 停稳后吸附：让某张卡正对中心
  if (pendingSnap && Math.abs(offset - shown) < 0.6) {
    pendingSnap = false
    if (props.snap && stride) {
      const base = (props.cardWidth - viewWidth) / 2
      offset = Math.round((offset - base) / stride) * stride + base
    }
  }

  // 浮点别无限涨
  if (Math.abs(offset) > period * 1000) {
    const shift = Math.trunc(offset / period) * period
    offset -= shift
    shown -= shift
  }

  render()
}

function nudge(delta) {
  offset += delta
  pendingSnap = false
  if (settleTimer) settleTimer.kill()
  settleTimer = gsap.delayedCall(0.18, () => {
    pendingSnap = true
  })
}

function createObserver() {
  observer = Observer.create({
    target: wheelEl.value,
    type: 'wheel',
    preventDefault: props.preventDefault,
    onWheel: (self) => {
      // 竖向滚轮和横向触控板都吃，谁大听谁的
      const delta = Math.abs(self.deltaX) > Math.abs(self.deltaY) ? self.deltaX : self.deltaY
      nudge(delta * props.wheelSpeed)
    }
  })
}

// 点卡片：没居中的滑到中间，已居中的把事件抛给外面
function onSlotClick(slotIndex) {
  if (!period || !props.items.length) return
  const real = slotIndex % props.items.length
  const centered = slotIndex === activeSlot.value && activeDist < 10

  if (!centered) {
    let target = slotIndex * stride + props.cardWidth / 2 - viewWidth / 2
    target += Math.round((offset - target) / period) * period // 走近路
    offset = target
    pendingSnap = true
  }

  emit('cardClick', { index: real, item: props.items[real], centered })
}

function syncDom() {
  if (!wheelEl.value || !trackEl.value) return
  if (!measure()) return
  viewWidth = wheelEl.value.clientWidth
  updateCopies()

  if (!inited) {
    inited = true
    // 让 initialIndex 那张正对中心
    offset = mod(props.initialIndex * stride + props.cardWidth / 2 - viewWidth / 2, period)
    shown = offset
  }
  render()
}

onMounted(async () => {
  await nextTick()
  if (!wheelEl.value || !trackEl.value) return

  gsap.set(trackEl.value, { yPercent: -50 }) // 轨道垂直居中，水平位置每帧写
  setTrackX = gsap.quickSetter(trackEl.value, 'x', 'px')

  syncDom()
  createObserver()
  gsap.ticker.add(tick)

  // 窗口宽度变了：份数和居中基准跟着变
  resizeObserver = new ResizeObserver(() => {
    if (!wheelEl.value || !period) return
    const w = wheelEl.value.clientWidth
    if (Math.abs(w - viewWidth) < 0.5) return
    viewWidth = w
    updateCopies()
    pendingSnap = true
  })
  resizeObserver.observe(wheelEl.value)
})

onBeforeUnmount(() => {
  gsap.ticker.remove(tick)
  if (settleTimer) settleTimer.kill()
  if (observer) observer.kill()
  if (resizeObserver) resizeObserver.disconnect()
})

// 数据 / 尺寸 / 份数变了重新量一遍
watch(
  () => [props.items, props.cardWidth, props.cardHeight, props.gap, copyCount.value],
  async () => {
    await nextTick()
    syncDom()
  }
)
</script>

<style scoped>
.arc-wheel {
  position: relative;
  overflow: hidden;
  /* 边缘直接硬切 */
  width: 100%;
  height: 100%;
  min-width: 0;
  /* 作为 flex 项要能被压窄 */
  touch-action: none;
  user-select: none;
}

/* 绝对定位：它那一千多 px 的宽度就不会顶开父容器 */
.arc-wheel__track {
  position: absolute;
  left: 0;
  top: 50%;
  display: flex;
  gap: var(--arc-gap, 18px);
  width: max-content;
  will-change: transform;
}

.arc-wheel__slot {
  flex: 0 0 auto;
  width: var(--arc-card-w, 130px);
  height: var(--arc-card-h, 180px);
  cursor: pointer;
}

.arc-wheel__card {
  position: relative;
  /* 不设 z-index 不生效 */
  width: 100%;
  height: 100%;
  transform-origin: 50% 50%;
  will-change: transform, opacity;
}

.arc-wheel__fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #1d2530;
  color: #cfd8e3;
  font-size: 12px;
}
</style>
