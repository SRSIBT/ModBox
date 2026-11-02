<template>
  <div class="dl">
    <!-- ① 标题栏：标题 + 统计 + 批量操作 -->
    <div class="dl__title glass-card">
      <span class="dl__title-text">下载列表</span>

      <!-- 没选游戏时列表退回全量，这里要说清楚，否则用户会以为过滤坏了 -->
      <span v-if="!activeGameId" class="dl__title-note">未选择游戏，当前展示全部任务</span>

      <div class="grow"></div>

      <div class="stat">
        <span class="stat__dot stat__dot--running"></span>
        <span class="stat__num">{{ counts.downloading }}</span>
        <span class="stat__label">下载中</span>
      </div>
      <div class="stat">
        <span class="stat__dot stat__dot--done"></span>
        <span class="stat__num">{{ counts.completed }}</span>
        <span class="stat__label">已完成</span>
      </div>

      <span class="dl__title-divider"></span>

      <button class="bulk" :disabled="!hasRunning" @click="pauseAll">全部暂停</button>
      <button class="bulk" :disabled="!counts.completed" @click="clearVisible = true">
        清空已完成
      </button>
    </div>

    <!-- ② 操作栏：状态页签 + 下载器配置 + 总速度 -->
    <div class="dl__tool glass-card">
      <div class="tabs">
        <button class="tabs__item" :class="{ 'tabs__item--on': tab === 'active' }" @click="setTab('active')">
          进行中
          <span class="tabs__count">{{ activeTasks.length }}</span>
        </button>
        <button class="tabs__item" :class="{ 'tabs__item--on': tab === 'done' }" @click="setTab('done')">
          已完成
          <span class="tabs__count">{{ doneTasks.length }}</span>
        </button>
      </div>

      <span class="dl__tool-divider"></span>

      <!-- 下完自动解压进模组库 -->
      <label class="dl__toggle" title="下载完成后自动解压到模组库，并写入模组信息">
        <span class="dl__toggle-text">自动导入</span>
        <span class="switch">
          <input type="checkbox" :checked="autoImport" @change="setAutoImport($event.target.checked)" />
          <span class="switch__slider"></span>
        </span>
      </label>

      <div v-if="totalSpeed > 0" class="dl__tool-speed">
        <span class="dl__tool-speed-label">总速度</span>
        <span class="dl__tool-speed-value">{{ fmtSpeed(totalSpeed) }}</span>
      </div>
    </div>

    <!-- ③ 任务列表 -->
    <div class="dl__body">
      <div v-if="currentTasks.length" class="dl__list">
        <div v-for="task in currentTasks" :key="task.id" class="row glass-card" :class="`row--${task.status}`">
          <!-- 封面：没有图就用模组名首字，与模组获取页的游戏封面占位一致 -->
          <div class="row__cover">{{ task.modName?.[0] || '?' }}</div>

          <div class="row__main">
            <div class="row__head">
              <span class="row__name" :title="task.modName">{{ task.modName }}</span>
              <span class="row__game">{{ task.gameName }}</span>
              <span class="row__id">#{{ task.modId }}</span>
              <span class="pill" :class="`pill--${metaOf(task).tone}`">
                {{ metaOf(task).label }}
              </span>
            </div>

            <div class="bar">
              <div class="bar__fill" :style="{ width: fmtPercent(task.progress) }"></div>
            </div>

            <div class="row__metric">
              <span class="row__percent">{{ fmtPercent(task.progress) }}</span>
              <span class="row__sep">·</span>
              <span class="row__bytes">
                {{ fmtBytes(task.downloadedBytes) }} / {{ fmtBytes(task.totalBytes) }}
              </span>

              <!-- 暂停与完成没有速度/剩余时间的概念，这里只留体积 -->
              <template v-if="task.status === 'downloading'">
                <span class="row__sep">·</span>
                <span class="row__speed">{{ fmtSpeed(task.speed) }}</span>

                <!-- 断流超过 5 秒就不该继续报一个假的剩余时间 -->
                <template v-if="isStalled(task)">
                  <span class="row__sep">·</span>
                  <span class="row__stalled">等待响应…</span>
                </template>
                <template v-else>
                  <span class="row__sep">·</span>
                  <span class="row__eta">剩余 {{ fmtEta(task.eta) }}</span>
                </template>
              </template>

              <template v-else-if="task.status === 'failed'">
                <span class="row__sep">·</span>
                <span class="row__error">{{ task.error }}</span>
              </template>
            </div>
          </div>

          <!-- 操作按状态收敛：能做什么由 TASK_ACTIONS 决定，模板不写 if 堆 -->
          <div class="row__ops">
            <button v-for="op in actionsOf(task)" :key="op.key" class="op"
              :class="[`op--${op.tone}`, { 'op--text': op.kind === 'text' }]" :data-tip="op.tip" :aria-label="op.tip"
              @click="runAction(op.key, task)">
              <span v-if="op.kind === 'text'" class="op__label">{{ op.label }}</span>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round">
                <path v-for="(d, i) in op.paths" :key="i" :d="d" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 空态 -->
      <div v-else class="dl__empty">
        <svg class="dl__empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 4v12" />
          <path d="M7 11l5 5 5-5" />
          <path d="M4 20h16" />
        </svg>

        <template v-if="tab === 'done'">
          <p class="dl__empty-title">还没有已完成的任务</p>
          <p class="dl__empty-desc">下载完成后会出现在这里，随时可以清理</p>
        </template>
        <template v-else>
          <p class="dl__empty-title">暂无正在下载的任务</p>
          <p class="dl__empty-desc">在 N 网点击「Slow download」，链接会自动交给 ModBox 接管</p>
        </template>
      </div>
    </div>

    <ConfirmDialog v-model:visible="deleteVisible" title="删除已完成任务"
      :message="`确定删除「${deleteTarget?.modName || ''}」这条下载记录吗？`" checkbox checkbox-label="同时删除已下载的文件"
      @confirm="confirmDelete" @cancel="deleteVisible = false" />

    <ConfirmDialog v-model:visible="clearVisible" title="清空已完成" message="确定清空所有已完成的下载记录吗？" checkbox
      checkbox-label="同时删除全部已下载的文件" @confirm="confirmClear" @cancel="clearVisible = false" />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useDownloadStore } from '@/stores/download'
import { useSettingStore } from '@/stores/setting'
import { STATUS_META, fmtPercent, fmtBytes, fmtSpeed, fmtEta } from '@/stores/download'
import ConfirmDialog from '../common/ConfirmDialog.vue'

const taskStore = useDownloadStore()
const { tab, activeGameId, activeTasks, doneTasks, currentTasks, counts, totalSpeed, hasRunning } =
  storeToRefs(taskStore)

const {
  setTab,
  pauseAll,
  clearCompleted,
  pauseTask,
  resumeTask,
  deleteTask,
  retryTask,
  revealTask,
  isStalled
} = taskStore

const deleteVisible = ref(false)
const deleteTarget = ref(null)
const clearVisible = ref(false)

// 订阅与假数据装载都在 App.vue 的 initBridge 里做，
// 这里只负责展示和转发动作
const settingStore = useSettingStore()
const { autoImport } = storeToRefs(settingStore)

// 开关一改就落盘：主进程是按 settings.json 里的值决定下载完成后干什么的
const setAutoImport = async (value) => {
  autoImport.value = value
  await settingStore.saveSettings()
}

// 图标用 path 数组存，模板里统一渲染，避免每个按钮写一段重复的 svg
const ICONS = {
  pause: ['M9 5v14', 'M15 5v14'],
  play: ['M7 4.5l12 7.5-12 7.5z'],
  retry: ['M20 12a8 8 0 1 1-2.34-5.66', 'M20 4v5h-5'],
  folder: ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13', 'M10 11v6', 'M14 11v6']
}

// 每个状态允许的操作。加状态时只改这张表，模板不用动。
const TASK_ACTIONS = {
  downloading: [
    { key: 'pause', tip: '暂停', tone: 'plain', kind: 'icon', paths: ICONS.pause },
    { key: 'delete', tip: '删除任务', tone: 'danger', kind: 'icon', paths: ICONS.trash }
  ],
  paused: [
    { key: 'resume', tip: '继续下载', tone: 'primary', kind: 'icon', paths: ICONS.play },
    { key: 'delete', tip: '删除任务', tone: 'danger', kind: 'icon', paths: ICONS.trash }
  ],
  failed: [
    { key: 'retry', tip: '重试', tone: 'primary', kind: 'text', label: '重试' },
    { key: 'delete', tip: '删除任务', tone: 'danger', kind: 'icon', paths: ICONS.trash }
  ],
  completed: [
    // 打开所在文件夹放前面，删除放最后（破坏性操作离手最远）
    { key: 'reveal', tip: '打开所在文件夹', tone: 'plain', kind: 'icon', paths: ICONS.folder },
    { key: 'delete', tip: '删除记录', tone: 'danger', kind: 'text', label: '删除' }
  ]
}

const metaOf = (task) => STATUS_META[task.status] || { label: task.status, tone: 'muted' }
const actionsOf = (task) => TASK_ACTIONS[task.status] || []

const askDelete = (task) => {
  // 已完成的任务先问一句：只删记录，还是连文件一起删
  if (task.status === 'completed') {
    deleteTarget.value = task
    deleteVisible.value = true
    return
  }
  // 进行中/暂停/失败：一个删除按钮就够了，任务和文件一起清
  deleteTask(task.id)
}

const confirmDelete = (payload) => {
  if (deleteTarget.value) {
    deleteTask(deleteTarget.value.id, payload?.checked === true)
  }
  deleteVisible.value = false
  deleteTarget.value = null
}

const confirmClear = async (payload) => {
  clearVisible.value = false
  await clearCompleted(payload?.checked === true)
}

const ACTION_HANDLERS = {
  pause: pauseTask,
  resume: resumeTask,
  retry: retryTask,
  reveal: revealTask
}

const runAction = (key, task) => {
  if (key === 'delete') {
    askDelete(task)
    return
  }
  const handler = ACTION_HANDLERS[key]
  if (handler) handler(task.id)
}

onMounted(() => {
  // 激活游戏在设置里；从句柄直接唤起跳到这页时可能还没加载过
  if (!settingStore.activeGameId) settingStore.fetchSettings()
})
</script>

<style scoped>
.dl {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  overflow: hidden;
}

.grow {
  flex: 1;
}

.dl__title-divider,
.dl__tool-divider {
  width: 1px;
  height: 18px;
  flex-shrink: 0;
  background: var(--divider);
}

/* ---------- 自动导入 / 自动翻译 开关 ---------- */
.dl__toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-sub);
  cursor: pointer;
  user-select: none;
}

.dl__toggle-text {
  white-space: nowrap;
}

.switch {
  position: relative;
  width: 32px;
  height: 18px;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch__slider {
  position: absolute;
  inset: 0;
  background: var(--inner-border);
  border-radius: 18px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.switch__slider::before {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  left: 2px;
  top: 2px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s ease;
}

.switch input:checked+.switch__slider {
  background: var(--accent);
}

.switch input:checked+.switch__slider::before {
  transform: translateX(14px);
}

/* ---------- ① 标题栏 ---------- */
.dl__title {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
}

.dl__title-text {
  font-size: 16px;
  font-weight: 500;
  color: var(--text);
}

.dl__title-note {
  font-size: 11px;
  color: var(--warning);
}

.stat {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px solid var(--inner-border);
  background: var(--inner-bg);
}

.stat__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.stat__dot--running {
  background: var(--success);
}

.stat__dot--done {
  background: var(--accent);
}

.stat__num {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.stat__label {
  font-size: 11px;
  color: var(--text-sub);
}

.bulk {
  padding: 5px 12px;
  font-size: 12px;
  color: var(--text);
  border-radius: 8px;
  border: 1px solid var(--inner-border);
  background: var(--inner-bg);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    opacity 0.2s ease;
}

.bulk:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--text-sub);
}

.bulk:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ---------- ② 操作栏 ---------- */
.dl__tool {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
}

.tabs {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 9px;
  border: 1px solid var(--inner-border);
  background: var(--inner-bg);
}

.tabs__item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  font-size: 12px;
  color: var(--text-sub);
  border: none;
  border-radius: 7px;
  background: transparent;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}

.tabs__item:hover {
  color: var(--text);
}

.tabs__item--on {
  color: #fff;
  background: var(--accent);
}

.tabs__count {
  min-width: 14px;
  font-size: 10px;
  font-weight: 600;
  line-height: 15px;
  text-align: center;
  border-radius: 8px;
  font-variant-numeric: tabular-nums;
  background: var(--bg-hover);
}

.tabs__item--on .tabs__count {
  background: rgba(255, 255, 255, 0.25);
}

.dl__tool-speed {
  display: flex;
  align-items: baseline;
  gap: 6px;
  /* 总速度永远贴在最右边 */
  margin-left: auto;
}

.dl__tool-speed-label {
  font-size: 11px;
  color: var(--text-faint);
}

.dl__tool-speed-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--success);
  font-variant-numeric: tabular-nums;
}

/* ---------- ③ 任务列表 ---------- */
.dl__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 唯一的滚动容器：只让列表滚，标题栏和工具条固定 */
.dl__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 2px;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  transition: border-color 0.2s ease;
}

.row--downloading {
  border-color: var(--success);
}

.row--failed {
  border-color: var(--danger);
}

.row__cover {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-sub);
  border-radius: 8px;
  border: 1px solid var(--inner-border);
  background: var(--inner-bg);
  text-transform: uppercase;
}

.row__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.row__head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.row__name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row__game {
  flex-shrink: 0;
  padding: 1px 7px;
  font-size: 10px;
  color: var(--text-sub);
  border-radius: 6px;
  border: 1px solid var(--inner-border);
  background: var(--inner-bg);
}

.row__id {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}

/* 状态胶囊 */
.pill {
  margin-left: auto;
  flex-shrink: 0;
  padding: 2px 9px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 20px;
}

.pill--success {
  color: var(--success);
  background: var(--success-soft);
}

.pill--accent {
  color: var(--accent);
  background: var(--success-soft);
}

.pill--warning {
  color: var(--warning);
  background: var(--warning-soft);
}

.pill--danger {
  color: var(--danger);
  background: var(--danger-soft);
}

.pill--muted {
  color: var(--text-sub);
  background: var(--bg-hover);
}

/* 进度条 */
.bar {
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  background: var(--bg-hover);
}

.bar__fill {
  height: 100%;
  border-radius: 3px;
  background: var(--success);
  transition: width 0.4s linear;
}

.row--paused .bar__fill {
  background: var(--text-faint);
}

.row--completed .bar__fill {
  background: var(--accent);
}

.row--failed .bar__fill {
  background: var(--danger);
}

/* 进度信息行 */
.row__metric {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-sub);
  min-width: 0;
}

.row__percent {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.row__sep {
  color: var(--text-faint);
}

.row__bytes,
.row__speed,
.row__eta {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.row__speed {
  color: var(--success);
}

.row__stalled {
  flex-shrink: 0;
  color: var(--warning);
}

.row__error {
  min-width: 0;
  color: var(--danger);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 操作按钮 */
.row__ops {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.op {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  width: 30px;
  padding: 0;
  color: var(--text-sub);
  border-radius: 8px;
  border: 1px solid var(--inner-border);
  background: var(--inner-bg);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
}

.op--text {
  width: auto;
  padding: 0 12px;
  font-size: 12px;
  color: var(--text);
}

.op svg {
  width: 15px;
  height: 15px;
  display: block;
}

.op:hover {
  color: var(--text);
  background: var(--bg-hover);
  border-color: var(--text-sub);
}

.op--primary:hover {
  color: var(--success);
  border-color: var(--success);
}

.op--danger:hover {
  color: var(--danger);
  border-color: var(--danger);
}

/* 空态 */
.dl__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--text-sub);
}

.dl__empty-icon {
  width: 40px;
  height: 40px;
  margin-bottom: 6px;
  color: var(--text-faint);
}

.dl__empty-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}

.dl__empty-desc {
  font-size: 12px;
}

/* 提示气泡：与 ModToolbar 同款，但方向朝下。
   操作按钮在纵向滚动容器里，朝上的气泡会被容器上沿裁掉。 */
.op[data-tip] {
  position: relative;
}

.op[data-tip]::after {
  content: attr(data-tip);
  position: absolute;
  top: calc(100% + 7px);
  left: 50%;
  transform: translateX(-50%) translateY(-4px);
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

.op[data-tip]:hover::after {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
</style>
