<template>
  <div class="tree">
    <div v-for="item in items" :key="item.name" class="tree__node">
      <div class="tree__row" @click="toggle(item)">
        <span class="tree__icon">{{ item.isDir ? (item.open ? '▼' : '▶') : '📄' }}</span>
        <span class="tree__name">{{ item.name }}</span>
        <span v-if="!item.isDir" class="tree__size">{{ formatSize(item.size) }}</span>
      </div>
      <div v-if="item.isDir && item.open" class="tree__children">
        <FileTree :items="item.children || []" />
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  items: {
    type: Array,
    default: () => []
  }
})

const toggle = (item) => {
  if (item.isDir) item.open = !item.open
}

const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}
</script>

<style scoped>
.tree__row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
}

.tree__row:hover {
  background: var(--bg-hover);
}

.tree__icon {
  width: 14px;
  color: var(--text-sub);
}

.tree__name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree__size {
  color: var(--text-sub);
}

.tree__children {
  padding-left: 16px;
}
</style>
