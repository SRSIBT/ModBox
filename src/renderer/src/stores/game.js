import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useSettingStore } from './setting'
import axios from 'axios'

export const useGameStore = defineStore('games', () => {
  const games = ref([]) // 游戏列表
  const currentId = ref('') // 当前选中游戏ID
  const settingStore = useSettingStore() // 设置store

  // 当前选中游戏，用当前选中游戏ID查找
  const currentGame = computed(
    () => games.value.find((g) => g.id === currentId.value) || games.value[0]
  )
  // 激活游戏
  const activeGame = computed(
    () => games.value.find((g) => g.id === settingStore.activeGameId) || null
  )

  // 获取游戏列表
  const fetchGames = async () => {
    const res = await axios.get('/api/games')
    games.value = res.data.games.map((g) => ({
      ...g,
      cover: g.cover
    }))
  }

  // 修改游戏路径
  const updateGame = async (rootPath, exePath) => {
    const game = currentGame.value
    if (!game) return

    await axios.post('/api/game', {
      id: game.id,
      rootPath,
      exePath
    })

    game.rootPath = rootPath
    game.exePath = exePath
  }

  // 手动获取游戏根目录
  const browseRoot = async () => {
    const res = await axios.get('/api/dialog/folder')
    return res.data.path || ''
  }

  // 手动获取游戏执行文件
  const browseExe = async () => {
    const res = await axios.get('/api/dialog/file')
    return res.data.path || ''
  }

  return {
    games,
    currentId,
    currentGame,
    activeGame,

    fetchGames,
    updateGame,
    browseRoot,
    browseExe
  }
})
