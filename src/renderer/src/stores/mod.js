import axios from 'axios'
import { defineStore } from 'pinia'
import { useSettingStore } from './setting'
import { ref, computed, reactive } from 'vue'

export const useModStore = defineStore('mods', () => {
  const modList = ref([]) // 模组列表
  const modFiles = ref([]) // 模组文件树
  const selectedIds = ref(new Set()) // 当前选中 Mod ID
  const installingIds = ref(new Set()) // 正在安装/卸载的 Mod ID
  const page = ref(1) // 当前页码
  const pageSize = ref(20) // 每页条数
  const settingStore = useSettingStore() // 设置store
  const filter = reactive({
    // 筛选条件
    keyword: '',
    type: '',
    group: '',
    enabled: ''
  })

  const totalCount = computed(() => modList.value.length) // 模组总数
  const activeGameId = computed(() => settingStore.activeGameId) // 激活游戏ID
  const installedCount = computed(() => modList.value.filter((m) => m.installed).length) // 模组安装数量
  const uninstalledCount = computed(() => modList.value.filter((m) => !m.installed).length) // 模组未安装数量

  // Mod 类型列表
  const typeList = computed(() => {
    const set = new Set(modList.value.map((m) => m.type).filter(Boolean))
    return [{ label: '全部类型', value: '' }, ...[...set].map((t) => ({ label: t, value: t }))]
  })

  // Mod 分组列表
  const groupList = computed(() => {
    const set = new Set(modList.value.map((m) => m.group).filter(Boolean))
    return [{ label: '全部分组', value: '' }, ...[...set].map((g) => ({ label: g, value: g }))]
  })

  // 筛选后的 Mod 列表
  const filteredList = computed(() => {
    return modList.value.filter((mod) => {
      if (filter.keyword) {
        const kw = filter.keyword.toLowerCase()
        const match =
          mod.name?.toLowerCase().includes(kw) ||
          mod.author?.toLowerCase().includes(kw) ||
          mod.type?.toLowerCase().includes(kw) ||
          mod.modId?.toLowerCase().includes(kw)
        if (!match) return false
      }
      if (filter.type && mod.type !== filter.type) return false
      if (filter.group && mod.group !== filter.group) return false
      if (filter.enabled === 'on' && !mod.installed) return false
      if (filter.enabled === 'off' && mod.installed) return false
      return true
    })
  })

  // 当前页要展示的 Mod
  const pagedList = computed(() => {
    const start = (page.value - 1) * pageSize.value
    return filteredList.value.slice(start, start + pageSize.value)
  })

  // 获取 Mod 配置
  const fetchMods = async () => {
    const gameId = activeGameId.value
    if (!gameId) {
      modList.value = []
      return
    }
    const res = await axios.get(`/api/mods/${gameId}`)
    modList.value = res.data.mods || []

    // 删除/重新加载后把已不存在的选中项剔掉，避免批量操作栏一直显示旧数量
    const liveIds = new Set(modList.value.map((m) => m.id))
    if ([...selectedIds.value].some((id) => !liveIds.has(id))) {
      selectedIds.value = new Set([...selectedIds.value].filter((id) => liveIds.has(id)))
    }
  }

  // 修改 Mod 配置
  const updateMod = async (form) => {
    if (!requireGameId()) return

    if (form) {
      if (form.cover && (form.cover.includes('\\') || form.cover.includes('/'))) {
        const res = await axios.post('/api/mods/cover', {
          gameId: activeGameId.value,
          modPath: form.path,
          coverPath: form.cover
        })
        form.cover = res.data.filename
      } else if (!form.cover) {
        delete form.cover
      }

      if (!form.type) form.type = '/'

      const target = modList.value.find((m) => m.id === form.id)
      if (target) {
        Object.assign(target, form)
      }
    }
    const gameId = requireGameId()
    if (!gameId) return
    await axios.post('/api/mods/save', { gameId, mods: modList.value })
    await fetchMods()
  }

  // 删除 Mod 配置
  const deleteMod = async (mod) => {
    const gameId = requireGameId()
    if (!gameId) return
    await axios.post('/api/mods/delete', {
      gameId,
      modPath: mod.path
    })
    await fetchMods()
  }

  // 安装 / 卸载：真正复制文件，不再只是改 installed 字段
  const setInstalled = async (mod, installed) => {
    const gameId = requireGameId()
    if (!gameId || !mod?.path) return null

    const key = mod.id ?? mod.path
    if (installingIds.value.has(key)) return null

    installingIds.value = new Set(installingIds.value).add(key)

    try {
      const res = await axios.post(installed ? '/api/mods/install' : '/api/mods/uninstall', {
        gameId,
        modPath: mod.path
      })
      await fetchMods()
      return res.data
    } catch (e) {
      const message = e.response?.data?.error || e.message
      console.error(`[mods] ${installed ? '安装' : '卸载'}失败：${message}`)
      await fetchMods()
      throw new Error(message)
    } finally {
      const next = new Set(installingIds.value)
      next.delete(key)
      installingIds.value = next
    }
  }

  // 批量安装 / 卸载：串行执行，避免多个 Mod 同时写游戏目录
  const setInstalledBatch = async (mods, installed) => {
    const results = []
    for (const mod of mods) {
      try {
        const data = await setInstalled(mod, installed)
        results.push({ mod, success: true, data })
      } catch (e) {
        results.push({ mod, success: false, error: e.message })
      }
    }
    return results
  }

  // 导入 Mod：不传路径时走系统文件夹选择器，传路径时直接导入
  const importMods = async (paths = null) => {
    const gameId = requireGameId()
    if (!gameId) return { success: false, errors: ['请先在设置中选择游戏'] }

    try {
      if (!paths) {
        const res = await axios.get('/api/dialog/folders')
        paths = res.data.paths
      }
      if (!paths?.length) return { success: false, errors: [] }

      const res = await axios.post('/api/mods/import', { gameId, paths })
      await fetchMods()
      return res.data
    } catch (e) {
      const message = e.response?.data?.error || e.message
      console.error('[mods] 导入失败：', message)
      return { success: false, errors: [message] }
    }
  }

  // 逐个导入，顺便把进度报给上传组件
  const importModsWithProgress = async (items, onProgress) => {
    const total = items.length
    let success = 0
    const errors = []

    for (let i = 0; i < total; i++) {
      const item = items[i]
      const result = await importMods([item.path])
      if (result?.success && !result.errors?.length) success++
      else errors.push(`${item.name}：${result?.errors?.[0] || result?.error || '导入失败'}`)
      onProgress?.(Math.round(((i + 1) / total) * 100))
    }

    return { success, errors, total }
  }

  // 一键卸载全部 Mod，并清理游戏目录里的残留
  const cleanupMods = async () => {
    const gameId = requireGameId()
    if (!gameId) throw new Error('请先选择游戏')
    const res = await axios.post('/api/mods/cleanup', { gameId })
    await fetchMods()
    return res.data
  }

  // 打开 Mod 文件夹
  const openModFolder = async (gameId, modPath) => {
    if (!gameId) return
    await axios.post('/api/mods/open-folder', { gameId, modPath })
  }

  // 获取 Mod 文件树
  const fetchModFiles = async (gameId, modPath) => {
    if (!gameId) {
      modFiles.value = []
      return
    }
    const res = await axios.get('/api/mods/files', {
      params: { gameId, modPath }
    })
    modFiles.value = res.data.files
  }

  // 打开文件管理器，获取 Mod 封面路径
  const pickCover = async () => {
    const res = await axios.get('/api/dialog/file', { params: { type: 'image' } })
    return res.data.path
  }

  // 打开游戏根目录
  const openGameFolder = async () => {
    const gameId = requireGameId()
    if (!gameId) return
    const res = await axios.post('/api/game/open-folder', { gameId })
    if (!res.data?.success) throw new Error(res.data?.error || '打开游戏目录失败')
    return res.data
  }

  // 启动游戏
  const launchGame = async () => {
    const gameId = requireGameId()
    if (!gameId) return
    const res = await axios.post('/api/game/launch', { gameId })
    if (!res.data?.success) throw new Error(res.data?.error || '启动游戏失败')
    return res.data
  }

  // 验证激活游戏ID
  const requireGameId = () => {
    const gameId = activeGameId.value
    if (!gameId) {
      console.warn('[mods] 当前没有激活的游戏，已跳过本次操作')
      return null
    }
    return gameId
  }

  return {
    filter,
    modList,
    modFiles,
    typeList,
    groupList,
    selectedIds,
    installingIds,
    page,
    pageSize,
    filteredList,
    pagedList,
    totalCount,
    installedCount,
    uninstalledCount,

    fetchMods,
    updateMod,
    deleteMod,
    setInstalled,
    setInstalledBatch,
    importMods,
    importModsWithProgress,
    cleanupMods,
    pickCover,
    openModFolder,
    fetchModFiles,
    openGameFolder,
    launchGame
  }
})
