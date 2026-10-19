<template>
  <div class="dl__tool glass-card" :class="{ 'dl__tool--disabled': disabled }">
    <!-- Mod ID 搜索（只允许数字，N 网 modId 是纯数字） -->
    <div class="field field--id">
      <svg class="field__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.6-3.6" />
      </svg>
      <input :value="modIdKeyword" :disabled="disabled" type="text" inputmode="numeric" placeholder="Mod ID"
        @input="onModIdInput" @keyup.enter="emit('search')" />
      <span v-if="modIdKeyword" class="field__clear" @click="clearModId">×</span>
    </div>

    <!-- 模组名称搜索 -->
    <div class="field field--name">
      <svg class="field__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.6-3.6" />
      </svg>
      <input :value="nameKeyword" :disabled="disabled" type="text" placeholder="模组名称搜索"
        @input="emit('update:nameKeyword', $event.target.value)" @keyup.enter="emit('search')" />
      <span v-if="nameKeyword" class="field__clear" @click="clearName">×</span>
    </div>

    <!-- 排序（最新发布 / 最近更新 / 下载最多 / 点赞最多） -->
    <FilterSelect :model-value="sort" :options="sortOptions"
      @update:model-value="(value) => emit('update:sort', value)" />

    <!-- 重置筛选条件 -->
    <div class="reset" data-tip="重置筛选条件" @click="emit('reset')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
        stroke-linejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
      </svg>
    </div>

    <div class="grow"></div>

    <!-- 只看收藏 -->
    <button class="fav" :class="{ on: favoritesOnly }" :disabled="disabled" data-tip="只看收藏"
      :aria-pressed="favoritesOnly" @click="emit('toggle-favorites')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
        stroke-linejoin="round">
        <path
          d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
      <span class="fav__count">{{ favoriteCount }}</span>
    </button>
  </div>
</template>

<script setup>
import FilterSelect from '../common/FilterSelect.vue'

// 筛选条件下拉框：这四项都是排序方式，顺序与 N 网数据源一一对应
const sortOptions = [
  { label: '最新发布', value: 'latest_added' },
  { label: '最近更新', value: 'latest_updated' },
  { label: '下载最多', value: 'downloads' },
  { label: '点赞最多', value: 'endorsements' }
]

defineProps({
  sort: String,
  modIdKeyword: String,
  nameKeyword: String,
  favoriteCount: { type: Number, default: 0 },
  favoritesOnly: Boolean,
  disabled: Boolean
})

const emit = defineEmits([
  'update:sort',
  'update:modIdKeyword',
  'update:nameKeyword',
  'toggle-favorites',
  'search',
  'reset'
])

// 非数字直接抹掉：只改 DOM 不触发渲染的话输入框里会残留脏字符，所以这里直接写回 target.value
const onModIdInput = (e) => {
  const clean = e.target.value.replace(/\D/g, '')
  if (clean !== e.target.value) e.target.value = clean
  emit('update:modIdKeyword', clean)
}

const clearModId = () => emit('update:modIdKeyword', '')
const clearName = () => emit('update:nameKeyword', '')
</script>

<style scoped>
.dl__tool {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  /* 不能加 overflow:hidden，否则 FilterSelect 的下拉面板会被裁掉 */
}

.dl__tool--disabled {
  opacity: 0.5;
  pointer-events: none;
}

.field {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text);
  border-radius: 8px;
  border: 1px solid var(--inner-border);
  background: var(--inner-bg);
  transition: border-color 0.2s ease;
}

.field:focus-within {
  border-color: var(--accent);
}

.field--id {
  width: 150px;
}

.field--name {
  width: 300px;
}

.field__icon {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  color: var(--text-sub);
}

.field input {
  flex: 1;
  min-width: 0;
  padding-right: 12px;
  font-size: 12px;
  color: var(--text);
  border: none;
  outline: none;
  background: none;
  caret-color: var(--text);
}

.field input::placeholder {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-sub);
}

.field__clear {
  position: absolute;
  right: 8px;
  cursor: pointer;
  color: var(--text-sub);
  font-size: 14px;
  line-height: 1;
  transition: color 0.2s ease;
}

.field__clear:hover {
  color: var(--text);
}

.grow {
  flex: 1;
}

/* 重置按钮 / 收藏按钮：尺寸与 ModToolbar 保持一致 */
.reset {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border-radius: 8px;
  border: 1px solid var(--inner-border);
  background: var(--inner-bg);
  color: var(--text-sub);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
}

.reset svg {
  width: 14px;
  height: 14px;
  display: block;
}

.reset:hover {
  color: var(--text);
  background: var(--bg-hover);
  border-color: var(--text-sub);
}

.fav {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--inner-border);
  background: var(--inner-bg);
  color: var(--text-sub);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
}

.fav svg {
  width: 16px;
  height: 16px;
  display: block;
  transition: transform 0.2s ease;
}

.fav:hover {
  color: #ff4d6d;
  border-color: #ff4d6d;
}

.fav:hover svg {
  transform: scale(1.12);
}

.fav.on {
  color: #ff4d6d;
  border-color: #ff4d6d;
  background: rgba(255, 77, 109, 0.12);
}

.fav.on svg {
  fill: currentColor;
}

.fav__count {
  min-width: 16px;
  font-size: 10px;
  font-weight: 600;
  line-height: 14px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* 提示气泡（与 ModToolbar 同款写法） */
[data-tip] {
  position: relative;
}

[data-tip]::after {
  content: attr(data-tip);
  position: absolute;
  top: -32px;
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  padding: 4px 8px;
  font-size: 11px;
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

[data-tip]::before {
  content: '';
  position: absolute;
  top: -7px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid #666666;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 11;
}

[data-tip]:hover::before {
  opacity: 1;
}
</style>
