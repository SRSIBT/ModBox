<template>
  <article class="card" @click="emit('open', mod)">
    <!-- 封面：真接口给了 cover 就显示图片，假数据用渐变色占位 -->
    <!-- 用 padding-top 撑出 16:9：aspect-ratio 在列 flex 项里不参与固有高度计算，会塌成文字高度 -->
    <div class="card__cover">
      <div class="card__cover-inner">
        <img v-if="mod.cover && !coverError" :src="mod.cover" :alt="mod.name" loading="lazy"
          @error="coverError = true" />
        <div v-else class="card__ph" :style="placeholderStyle">
          <span class="card__ph-initials">{{ initials }}</span>
        </div>
      </div>

      <span v-if="mod.category" class="card__cat" :style="categoryStyle">
        {{ mod.category }}
      </span>

      <button class="card__fav" :class="{ on: favorite }" :aria-pressed="favorite" data-tip="收藏"
        @click.stop="emit('toggle-favorite', mod.modId)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
          stroke-linejoin="round">
          <path
            d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
      </button>
    </div>

    <div class="card__body">
      <h3 class="card__name" :title="mod.name">{{ mod.name }}</h3>

      <div class="card__meta">
        <span class="chip">ID {{ mod.modId }}</span>
        <span v-if="mod.version" class="ver">v{{ mod.version }}</span>
      </div>

      <div class="card__author">
        <span class="avatar" :style="avatarStyle">{{ authorInitial }}</span>
        <span class="author-name" :title="mod.author">{{ mod.author }}</span>
      </div>

      <div class="card__time">
        <span>更新 {{ updatedText }}</span>
        <span>发布 {{ createdText }}</span>
      </div>

      <p class="card__summary" :title="mod.summary">{{ mod.summary }}</p>
    </div>

    <div class="card__foot">
      <div class="card__stats">
        <span class="stat" title="点赞">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <path d="M7 10v12" />
            <path
              d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
          </svg>
          {{ numberText(mod.endorsements) }}
        </span>

        <span class="stat" title="下载">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
          {{ numberText(mod.downloads) }}
        </span>

        <span class="stat" title="文件大小">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
            <path d="m3 8 9 5 9-5" />
            <path d="M12 13v8" />
          </svg>
          {{ sizeText }}
        </span>
      </div>

      <button class="card__link" :disabled="!mod.url" @click.stop="emit('open', mod)">
        N 网页面
      </button>
    </div>
  </article>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  mod: { type: Object, required: true },
  favorite: Boolean,
  // 全局秒级时间戳由 store 统一提供，卡片只负责算差值
  now: { type: Number, default: () => Date.now() }
})

const emit = defineEmits(['toggle-favorite', 'open'])

const coverError = ref(false)

const pad = (n) => String(n).padStart(2, '0')

const formatDateTime = (iso) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`
}

const formatDate = (iso) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
}

// 更新时间：7 天内走相对时间（每秒刷新），更久就显示绝对时间，两种情况截图里都有
const updatedText = computed(() => {
  const time = new Date(props.mod.updatedAt).getTime()
  if (Number.isNaN(time)) return '-'

  const diff = props.now - time
  const sec = Math.floor(diff / 1000)
  const min = Math.floor(sec / 60)
  const hour = Math.floor(min / 60)
  const day = Math.floor(hour / 24)

  if (diff < 0 || sec < 60) return '刚刚'
  if (min < 60) return `${min}分 ${pad(sec % 60)}秒`
  if (hour < 24) return `${hour}小时 ${pad(min % 60)}:${pad(sec % 60)}`
  if (day < 7) return `${day}天 ${pad(hour % 24)}:${pad(min % 60)}:${pad(sec % 60)}`
  return formatDateTime(props.mod.updatedAt)
})

const createdText = computed(() => formatDate(props.mod.createdAt))

const sizeText = computed(() => {
  const size = Number(props.mod.fileSize) || 0
  if (size < 1024) return `${size} B`
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 ** 3) return `${(size / 1024 ** 2).toFixed(1)} MB`
  return `${(size / 1024 ** 3).toFixed(2)} GB`
})

const numberText = (value) => (Number(value) || 0).toLocaleString('en-US')

const initials = computed(() =>
  props.mod.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] || '')
    .join('')
    .toUpperCase()
)

const authorInitial = computed(() => (props.mod.author || '?').trim()[0]?.toUpperCase() || '?')

// 同类目同色、同一作者同色，保证视觉上可区分
const hueOf = (text) => {
  let sum = 0
  for (const ch of String(text || '')) sum = (sum + ch.codePointAt(0)) % 360
  return sum
}

const hue = computed(() => (props.mod.modId * 47) % 360)

const placeholderStyle = computed(() => ({
  backgroundImage: `linear-gradient(135deg, hsl(${hue.value} 42% 34%), hsl(${(hue.value + 48) % 360
    } 46% 18%))`
}))

const categoryStyle = computed(() => {
  const h = hueOf(props.mod.category)
  return {
    color: `hsl(${h} 90% 84%)`,
    background: 'rgba(0, 0, 0, 0.45)',
    borderColor: `hsl(${h} 70% 60% / 0.5)`
  }
})

const avatarStyle = computed(() => {
  const h = hueOf(props.mod.author)
  return { background: `hsl(${h} 45% 42%)` }
})
</script>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  border: 1px solid var(--inner-border);
  background: var(--inner-bg);
  overflow: hidden;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.card:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
}

/* 封面 */
.card__cover {
  position: relative;
  flex-shrink: 0;
  width: 100%;
  /* 16:9 由 padding 撑开：百分比 padding 按宽度算，任何父级上下文里都成立 */
  padding-top: 56.25%;
  background: #1b1d21;
}

.card__cover-inner {
  position: absolute;
  inset: 0;
}

.card__cover-inner img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card__ph {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.card__ph-initials {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 2px;
  color: rgba(255, 255, 255, 0.35);
  user-select: none;
}

.card__cat {
  position: absolute;
  left: 8px;
  bottom: 8px;
  max-width: calc(100% - 48px);
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 500;
  border-radius: 10px;
  border: 1px solid transparent;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card__fav {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.35);
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  transition:
    color 0.2s ease,
    background-color 0.2s ease,
    transform 0.2s ease;
}

.card__fav svg {
  width: 15px;
  height: 15px;
  display: block;
}

.card__fav:hover {
  color: #ff4d6d;
  background: rgba(0, 0, 0, 0.55);
  transform: scale(1.08);
}

.card__fav.on {
  color: #ff4d6d;
}

.card__fav.on svg {
  fill: currentColor;
}

/* 正文 */
.card__body {
  /* 必须是 1 1 auto：写成 flex:1（basis 0）会让卡片的固有高度丢掉正文这一段，
     网格行会跟着塌成一条条细条 */
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
}

.card__name {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  /* 预留两行，保证每张卡片一样高 */
  min-height: 2.7em;
  color: var(--text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card__meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.chip {
  padding: 1px 6px;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: var(--text-sub);
  border-radius: 6px;
  border: 1px solid var(--inner-border);
}

.ver {
  font-size: 10px;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}

.card__author {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-sub);
  min-width: 0;
}

.avatar {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 9px;
  font-weight: 600;
  color: #fff;
}

.author-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card__time {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 10px;
  color: var(--text-faint);
}

.card__time span {
  font-variant-numeric: tabular-nums;
}

.card__summary {
  font-size: 11px;
  line-height: 1.5;
  /* 预留三行，保证每张卡片一样高 */
  min-height: 4.5em;
  color: var(--text-sub);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 底部数据 + 操作 */
.card__foot {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  border-top: 1px solid var(--divider);
}

.card__stats {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--text-sub);
  min-width: 0;
}

.stat {
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}

.stat svg {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.card__link {
  flex-shrink: 0;
  height: 24px;
  padding: 0 10px;
  font-size: 11px;
  border-radius: 6px;
  border: 1px solid var(--inner-border);
  background: transparent;
  color: var(--text);
  cursor: pointer;
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.card__link:hover:not(:disabled) {
  color: var(--accent);
  border-color: var(--accent);
  background: rgba(3, 151, 79, 0.1);
}

.card__link:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 提示气泡（收藏按钮） */
[data-tip] {
  position: relative;
}

[data-tip]::after {
  content: attr(data-tip);
  position: absolute;
  top: 28px;
  left: 50%;
  transform: translateX(-50%) translateY(-4px);
  padding: 3px 7px;
  font-size: 10px;
  white-space: nowrap;
  border-radius: 6px;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  color: var(--text);
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  z-index: 10;
}

[data-tip]:hover::after {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
</style>
