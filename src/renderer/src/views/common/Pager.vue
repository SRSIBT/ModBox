<template>
  <div class="pager glass-card">
    <!-- 左侧：总数 / 当前页 -->
    <div class="pager__info">
      <span>共 <b>{{ total }}</b> 个模组</span>
      <span class="divider">·</span>
      <span>第 <b>{{ page }}</b> / <b>{{ totalPages }}</b> 页</span>
    </div>

    <!-- 右侧：每页条数 + 页码 + 跳页 -->
    <div class="pager__ctrl">
      <FilterSelect
        :model-value="pageSize"
        :options="sizeOptions"
        placement="up"
        @update:model-value="onSizeChange"
      />

      <button class="pg" :disabled="disabled || page <= 1" @click="go(page - 1)">‹</button>

      <template v-for="(item, i) in pages" :key="`${item}-${i}`">
        <span v-if="item === 'gap'" class="pg__gap">…</span>
        <button v-else class="pg" :class="{ active: item === page }" :disabled="disabled" @click="go(item)">
          {{ item }}
        </button>
      </template>

      <button class="pg" :disabled="disabled || page >= totalPages" @click="go(page + 1)">›</button>

      <label class="pager__jump">
        <span>前往</span>
        <input v-model="jump" type="text" inputmode="numeric" @keyup.enter="doJump" />
        <span>页</span>
      </label>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import FilterSelect from './FilterSelect.vue'

const props = defineProps({
  total: {
    type: Number,
    default: 0
  },
  page: {
    type: Number,
    default: 1
  },
  pageSize: {
    type: Number,
    default: 20
  },
  pageSizeOptions: {
    type: Array,
    default: () => [20, 40, 60, 100]
  },
  sibling: {
    type: Number,
    default: 2
  },
  disabled: Boolean
})

const emit = defineEmits(['update:page', 'update:pageSize'])

const jump = ref('')

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))

const sizeOptions = computed(() =>
  props.pageSizeOptions.map((n) => ({ label: `${n} 条/页`, value: n }))
)

// 页码窗口：页数少就全列，多则 首 … 当前±sibling … 尾，并在贴边时补足数量
const pages = computed(() => {
  const last = totalPages.value
  const cur = props.page
  const sib = props.sibling

  if (last <= 7) {
    return Array.from({ length: last }, (_, i) => i + 1)
  }

  let start = Math.max(2, cur - sib)
  let end = Math.min(last - 1, cur + sib)

  // 贴边时补足数量，避免首页/末页附近页码太少
  if (cur - sib < 2) end = Math.min(last - 1, 2 + sib * 2)
  if (cur + sib > last - 1) start = Math.max(2, last - 1 - sib * 2)

  // 省略号只藏得下 1 页时，不如直接把它显示出来
  if (start === 3) start = 2
  if (end === last - 2) end = last - 1

  const items = [1]
  if (start > 2) items.push('gap')
  for (let i = start; i <= end; i++) items.push(i)
  if (end < last - 1) items.push('gap')
  items.push(last)
  return items
})

const go = (n) => {
  const target = Math.min(Math.max(n, 1), totalPages.value)
  if (target !== props.page) emit('update:page', target)
}

// 每页条数只往外抛，页码由调用方归 1（页码越界时下面的 watch 会兜底夹回）
const onSizeChange = (size) => {
  emit('update:pageSize', size)
}

const doJump = () => {
  const n = parseInt(jump.value, 10)
  if (!Number.isFinite(n)) {
    jump.value = ''
    return
  }
  go(n)
  jump.value = ''
}

// 外部换页 / 总数变化后清空跳页框；页码越界时夹回最后一页
watch(
  () => props.page,
  () => {
    jump.value = ''
  }
)

watch(totalPages, (last) => {
  if (props.page > last) emit('update:page', last)
})
</script>

<style scoped>
.pager {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 16px;
  font-size: 12px;
  color: var(--text-sub);
  user-select: none;
}

.pager__info {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pager__info b {
  color: var(--text);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.pager__info .divider {
  color: var(--text-faint);
}

.pager__ctrl {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pg {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--text);
  cursor: pointer;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.pg:hover:not(:disabled) {
  background: var(--bg-hover);
}

.pg:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.pg.active {
  color: #fff;
  background: var(--accent);
  border-color: var(--accent);
}

.pg__gap {
  width: 20px;
  text-align: center;
  color: var(--text-faint);
}

.pager__jump {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 4px;
  color: var(--text-sub);
}

.pager__jump input {
  width: 44px;
  padding: 5px 6px;
  text-align: center;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--text);
  border-radius: 8px;
  border: 1px solid var(--inner-border);
  background: var(--inner-bg);
  outline: none;
  transition: border-color 0.2s ease;
}

.pager__jump input:focus {
  border-color: var(--accent);
}
</style>
