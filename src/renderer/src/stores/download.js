import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useSettingStore } from './setting'

// 任务状态机：
//   downloading -> paused      暂停
//   paused      -> downloading 继续
//   downloading -> completed   下完
//   downloading -> failed      出错
//   failed      -> downloading 重试
const TASK_STATUS = {
  downloading: 'downloading',
  paused: 'paused',
  completed: 'completed',
  failed: 'failed'
}

// 状态胶囊的文案与配色键
export const STATUS_META = {
  [TASK_STATUS.downloading]: { label: '下载中', tone: 'success' },
  [TASK_STATUS.paused]: { label: '已暂停', tone: 'muted' },
  [TASK_STATUS.completed]: { label: '已完成', tone: 'accent' },
  [TASK_STATUS.failed]: { label: '失败', tone: 'danger' }
}

const KB = 1024
const MB = KB * 1024
const GB = MB * 1024

// 进度在内部保留小数，只为让进度条走得平滑；展示时再取整
const clampProgress = (value) => Math.min(100, Math.max(0, value))

// ---------- 展示层格式化：纯函数，方便模板直接调用 ----------

export const fmtPercent = (p) => `${Math.floor(clampProgress(p || 0))}%`

export const fmtBytes = (bytes) => {
  const n = Number(bytes) || 0
  if (n >= GB) return `${(n / GB).toFixed(2)} GB`
  if (n >= MB) return `${(n / MB).toFixed(1)} MB`
  if (n >= KB) return `${(n / KB).toFixed(0)} KB`
  return `${n} B`
}

export const fmtSpeed = (bytesPerSec) => {
  const n = Number(bytesPerSec) || 0
  if (n <= 0) return '--'
  if (n >= MB) return `${(n / MB).toFixed(1)} MB/s`
  if (n >= KB) return `${(n / KB).toFixed(0)} KB/s`
  return `${n} B/s`
}

export const fmtEta = (seconds) => {
  // 先挡 null/undefined：Number(null) 是 0，会被下面的有限性检查放过，
  // 结果把「没有剩余时间」显示成「1 秒」
  if (seconds === null || seconds === undefined) return '--'
  const s = Number(seconds)
  if (!Number.isFinite(s) || s < 0) return '--'
  if (s < 60) return `${Math.max(1, Math.round(s))} 秒`
  const totalMinutes = Math.round(s / 60)
  if (totalMinutes < 60) return `${totalMinutes} 分钟`
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`
}

export const useDownloadStore = defineStore('download', () => {
  const settingStore = useSettingStore()

  // ---------- 状态 ----------
  const tasks = ref([])
  const tab = ref('active') // active | done
  // 任务镜像：真源在主进程，这里靠 download:* 事件同步
  const bridgeReady = ref(false)

  // 秒级时钟：「卡住」判定要跟着刷新
  const now = ref(Date.now())

  // 一次性提示（解析失败、授权过期等），由组件显示并自动消失
  const notice = ref(null)
  // 收到 nxm 链接时自增，App.vue 监听后切到下载列表页
  const focusRequest = ref(0)

  // ---------- 派生 ----------
  const activeGameId = computed(() => settingStore.activeGameId)

  // 只展示当前激活游戏的任务；没选游戏时退回全量（此时标题栏会提示）。
  // unmatched 的任务不过滤：链接里的游戏没配到本地时也得让用户看见，否则像是没下。
  const scopedTasks = computed(() => {
    const id = activeGameId.value
    if (!id) return tasks.value
    return tasks.value.filter((t) => t.gameId === id || t.unmatched)
  })

  const activeTasks = computed(() =>
    scopedTasks.value.filter(
      (t) => t.status === TASK_STATUS.downloading || t.status === TASK_STATUS.paused
    )
  )
  const doneTasks = computed(() =>
    scopedTasks.value.filter((t) => t.status === TASK_STATUS.completed)
  )
  const currentTasks = computed(() => (tab.value === 'done' ? doneTasks.value : activeTasks.value))

  const counts = computed(() => ({
    // 统计徽章只数当前游戏的下载中，与列表里「进行中」页签的条数保持一致
    downloading: activeTasks.value.filter((t) => t.status === TASK_STATUS.downloading).length,
    completed: doneTasks.value.length
  }))

  const totalSpeed = computed(() =>
    activeTasks.value.reduce(
      (sum, t) => (t.status === TASK_STATUS.downloading ? sum + t.speed : sum),
      0
    )
  )

  const hasRunning = computed(() => counts.value.downloading > 0)

  // ---------- 时钟 ----------
  let clockTimer = null

  const startClock = () => {
    if (clockTimer) return
    clockTimer = setInterval(() => {
      now.value = Date.now()
    }, 1000)
  }

  // ---------- 提示 ----------
  const setNotice = (level, message) => {
    if (!message) return
    notice.value = { level, message, at: Date.now() }
  }

  const dismissNotice = () => {
    notice.value = null
  }

  // ============================================================
  // live 模式：主进程推事件，本地只做镜像
  // ============================================================
  const upsertFromMain = (task) => {
    if (!task?.id) return
    const index = tasks.value.findIndex((t) => t.id === task.id)
    if (index >= 0) tasks.value[index] = { ...tasks.value[index], ...task }
    else tasks.value = [task, ...tasks.value]
  }

  const applyProgress = (patch) => {
    if (!patch?.id) return
    const task = tasks.value.find((t) => t.id === patch.id)
    // 进度可能先于 added 到达（渲染进程还没订阅完），忽略即可，list 会补齐
    if (!task) return
    task.downloadedBytes = patch.downloadedBytes ?? task.downloadedBytes
    task.totalBytes = patch.totalBytes ?? task.totalBytes
    task.progress = patch.progress ?? task.progress
    task.speed = patch.speed ?? task.speed
    task.eta = patch.eta ?? null
    task.updatedAt = patch.updatedAt || Date.now()
  }

  const callApi = async (fn, fallback) => {
    try {
      const res = await fn()
      if (res && res.ok === false) setNotice('error', res.error || fallback)
      return res
    } catch (e) {
      setNotice('error', e?.message || fallback)
    }
  }

  // ============================================================
  // 桥接
  // ============================================================

  /**
   * 在 App.vue 里调一次即可。订阅放在应用级而不是下载列表页：
   * 那个页面切走就卸载了，而下载得继续跑、进度得继续进 store。
   */
  const initBridge = async () => {
    if (bridgeReady.value) return
    bridgeReady.value = true

    const api = typeof window !== 'undefined' ? window.downloadAPI : null
    if (!api) {
      // preload 没暴露 downloadAPI：正常打包/开发下不会发生，
      // 真发生了说明 preload 没加载成功，直接说出来比空列表好排查
      setNotice('error', '下载功能不可用：preload 没有加载 downloadAPI')
      startClock()
      return
    }

    api.onAdded(upsertFromMain)
    api.onState(upsertFromMain)
    api.onProgress(applyProgress)
    api.onRemoved((id) => {
      tasks.value = tasks.value.filter((t) => t.id !== id)
    })
    api.onNotice((payload) => setNotice(payload?.level || 'info', payload?.message))
    api.onFocus(() => {
      focusRequest.value += 1
    })

    try {
      const snapshot = await api.list()
      tasks.value = Array.isArray(snapshot?.tasks) ? snapshot.tasks : []
      // 窗口加载完之前收到的 nxm 链接，focus 标志在这里补回来
      if (snapshot?.focus) focusRequest.value += 1
    } catch (e) {
      setNotice('error', `读取下载列表失败：${e.message}`)
    }

    startClock()
  }

  // ============================================================
  // 动作：全部转发给主进程
  // ============================================================
  const setTab = (value) => {
    tab.value = value === 'done' ? 'done' : 'active'
  }

  // 所有动作都只转发给主进程，状态由 download:state / download:progress 事件回填。
  // 本地不要再改任务字段——主进程才是真源，本地改了会被下一条事件覆盖，界面会闪。
  const pauseTask = (id) => callApi(() => window.downloadAPI.pause(id), '暂停失败')

  const resumeTask = (id) => callApi(() => window.downloadAPI.resume(id), '继续下载失败')

  const deleteTask = (id, removeFile = false) =>
    callApi(() => window.downloadAPI.remove(id, removeFile), '删除失败')

  // 主进程的 resume 对 failed 任务就是「清错误、从 0 重下」
  const retryTask = (id) => callApi(() => window.downloadAPI.resume(id), '重试失败')

  const revealTask = (id) => callApi(() => window.downloadAPI.reveal(id), '打开文件夹失败')

  const pauseAll = () => callApi(() => window.downloadAPI.pauseAll(), '全部暂停失败')

  const clearCompleted = async (removeFile = false) => {
    for (const task of [...doneTasks.value]) {
      await callApi(() => window.downloadAPI.remove(task.id, removeFile), '移除失败')
    }
    if (!doneTasks.value.length && tab.value === 'done') tab.value = 'active'
  }

  /**
   * 任务是否卡住了：下载中状态但超过 5 秒没有进度更新。
   * 主进程正常时每 500ms 推一次进度，超时说明流断了。
   */
  const isStalled = (task) => {
    if (task.status !== TASK_STATUS.downloading) return false
    return now.value - task.updatedAt > 5000
  }

  return {
    // 状态
    tasks,
    tab,
    notice,
    focusRequest,
    activeGameId,

    // 派生
    activeTasks,
    doneTasks,
    currentTasks,
    counts,
    totalSpeed,
    hasRunning,

    // 生命周期
    initBridge,

    // 动作
    setTab,
    pauseTask,
    resumeTask,
    deleteTask,
    retryTask,
    revealTask,
    pauseAll,
    clearCompleted,
    isStalled,
    dismissNotice
  }
})
