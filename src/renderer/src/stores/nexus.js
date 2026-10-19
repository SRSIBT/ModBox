import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import axios from 'axios'
import { useSettingStore } from './setting'
import { useGameStore } from './game'

const DEFAULT_SORT = 'latest_added'
const DEFAULT_PAGE_SIZE = 20

export const useNexusStore = defineStore('nexus', () => {
  const settingStore = useSettingStore()
  const gameStore = useGameStore()

  // 当前游戏只认 setting store 里的 id，这里只读不存
  const activeGameId = computed(() => settingStore.activeGameId)
  const activeGame = computed(() => gameStore.activeGame)

  // ---------- 筛选条件 ----------
  const sort = ref(DEFAULT_SORT)
  const modIdKeyword = ref('')
  const nameKeyword = ref('')
  const favoritesOnly = ref(false)
  const page = ref(1)
  const pageSize = ref(DEFAULT_PAGE_SIZE)

  // ---------- 列表数据 ----------
  const list = ref([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref('')

  // ---------- 收藏 ----------
  const favorites = ref([])
  const favoriteSet = computed(() => new Set(favorites.value))
  const favoriteCount = computed(() => favorites.value.length)
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

  // ---------- 秒级时钟 ----------
  // 卡片上的「更新 5小时 06:54:35」需要每秒刷新，全局只跑一个定时器，
  // 绝不能每张卡片各起一个 setInterval
  const now = ref(Date.now())
  let tickTimer = null

  const startTick = () => {
    if (!tickTimer) tickTimer = setInterval(() => (now.value = Date.now()), 1000)
  }

  const stopTick = () => {
    if (tickTimer) clearInterval(tickTimer)
    tickTimer = null
  }

  // ---------- 请求 ----------
  let seq = 0 // 请求序号：防抖 + 快速翻页时，只认最后一次响应
  let debounceTimer = null

  const errMessage = (e, fallback) => {
    const data = e?.response?.data
    if (typeof data?.error === 'string') return data.error
    if (data?.error?.message) return data.error.message
    return fallback
  }

  const fetchMods = async () => {
    const gameId = activeGameId.value
    if (!gameId) {
      list.value = []
      total.value = 0
      return
    }

    const mySeq = ++seq
    loading.value = true
    error.value = ''

    try {
      const res = await axios.get('/api/nexus/mods', {
        params: {
          gameId,
          sort: sort.value,
          page: page.value,
          pageSize: pageSize.value,
          modId: modIdKeyword.value.trim(),
          name: nameKeyword.value.trim(),
          favoritesOnly: favoritesOnly.value ? 1 : 0
        }
      })
      if (mySeq !== seq) return

      list.value = res.data.list || []
      total.value = res.data.total || 0
      // 取消收藏会让总数变小，以服务端夹过的页码为准
      page.value = res.data.page || 1
    } catch (e) {
      if (mySeq !== seq) return

      list.value = []
      total.value = 0
      error.value = errMessage(e, '模组列表获取失败，请稍后重试')
    } finally {
      if (mySeq === seq) loading.value = false
    }
  }

  const fetchFavorites = async () => {
    const gameId = activeGameId.value
    if (!gameId) {
      favorites.value = []
      return
    }

    try {
      const res = await axios.get('/api/nexus/favorites', { params: { gameId } })
      favorites.value = res.data.modIds || []
    } catch (e) {
      favorites.value = []
      console.warn('[nexus] 收藏读取失败：', e.message)
    }
  }

  // ---------- 筛选动作（统一在这里把页码归 1，避免页码与条件不同步） ----------
  const applyFilter = () => {
    page.value = 1
    fetchMods()
  }

  const debouncedApplyFilter = () => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(applyFilter, 400)
  }

  const setSort = (value) => {
    if (value === sort.value) return
    sort.value = value
    applyFilter()
  }

  const setModIdKeyword = (value) => {
    if (value === modIdKeyword.value) return
    modIdKeyword.value = value
    debouncedApplyFilter()
  }

  const setNameKeyword = (value) => {
    if (value === nameKeyword.value) return
    nameKeyword.value = value
    debouncedApplyFilter()
  }

  const setFavoritesOnly = (value) => {
    if (value === favoritesOnly.value) return
    favoritesOnly.value = value
    applyFilter()
  }

  const toggleFavoritesOnly = () => setFavoritesOnly(!favoritesOnly.value)

  // 回车立即查询：跳过防抖，直接按当前条件重新拉
  const searchNow = () => {
    clearTimeout(debounceTimer)
    applyFilter()
  }

  const setPage = (value) => {
    const target = Math.min(Math.max(value, 1), totalPages.value)
    if (target === page.value) return
    page.value = target
    fetchMods()
  }

  const setPageSize = (value) => {
    if (value === pageSize.value) return
    pageSize.value = value
    applyFilter()
  }

  const resetFilter = () => {
    clearTimeout(debounceTimer)
    sort.value = DEFAULT_SORT
    modIdKeyword.value = ''
    nameKeyword.value = ''
    favoritesOnly.value = false
    page.value = 1
    fetchMods()
  }

  const toggleFavorite = async (modId) => {
    const gameId = activeGameId.value
    if (!gameId) return

    const before = favorites.value
    const next = !favoriteSet.value.has(modId)
    // 先改本地再发请求，失败回滚，保证心形点下去有即时反馈
    favorites.value = next ? [...before, modId] : before.filter((id) => id !== modId)

    try {
      const res = await axios.post('/api/nexus/favorites', { gameId, modId, favorite: next })
      if (res.data.modIds) favorites.value = res.data.modIds
      // 正在「只看收藏」时取消收藏，这条要从列表里消失，重新取一次
      if (favoritesOnly.value) fetchMods()
    } catch (e) {
      favorites.value = before
      error.value = errMessage(e, '收藏失败，请稍后重试')
    }
  }

  const refresh = () => Promise.all([fetchFavorites(), fetchMods()])

  // 换游戏：收藏与列表都要重来
  watch(activeGameId, () => {
    page.value = 1
    favoritesOnly.value = false
    refresh()
  })

  return {
    activeGameId,
    activeGame,

    sort,
    modIdKeyword,
    nameKeyword,
    favoritesOnly,
    page,
    pageSize,

    list,
    total,
    totalPages,
    loading,
    error,

    favorites,
    favoriteSet,
    favoriteCount,

    now,
    startTick,
    stopTick,

    fetchMods,
    fetchFavorites,
    refresh,
    setSort,
    setModIdKeyword,
    setNameKeyword,
    setFavoritesOnly,
    toggleFavoritesOnly,
    searchNow,
    setPage,
    setPageSize,
    resetFilter,
    toggleFavorite
  }
})
