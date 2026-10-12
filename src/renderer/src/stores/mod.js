import { defineStore } from 'pinia'
import { ref, computed, reactive } from 'vue'
import axios from 'axios'

export const useModStore = defineStore('mods', () => {
    const modList = ref([])
    const modFiles = ref([])
    const activeGame = ref({})
    const filter = reactive({
        keyword: '',
        type: '',
        group: '',
        enabled: '',
    })

    const totalCount = computed(() => modList.value.length)
    const installedCount = computed(() => modList.value.filter(m => m.installed).length)
    const uninstalledCount = computed(() => modList.value.filter(m => !m.installed).length)
    const typeList = computed(() => {
        const set = new Set(modList.value.map(m => m.type).filter(Boolean))
        return [{ value: '', label: '全部类型' }, ...[...set].map(t => ({ value: t, label: t }))]
    })
    const groupList = computed(() => {
        const set = new Set(modList.value.map(m => m.group).filter(Boolean))
        return [{ value: '', label: '全部分组' }, ...[...set].map(g => ({ value: g, label: g }))]
    })

    const filteredList = computed(() => {
        return modList.value.filter(mod => {
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

    // 获取 Mod 配置
    const fetchMods = async (activeGameName) => {
        const res = await axios.get('/api/games')
        const game = res.data.games.find(g => g.name === activeGameName)
        activeGame.value = game
        modList.value = game?.mods || []
    }

    // 修改 Mod 配置
    const updateMod = async (form) => {
        if (form) {
            if (form.cover && (form.cover.includes('\\') || form.cover.includes('/'))) {
                const res = await axios.post('/api/mods/cover', {
                    gameId: activeGame.value.id,
                    modPath: form.path,
                    coverPath: form.cover
                })
                form.cover = res.data.filename
            } else if (!form.cover) {
                delete form.cover
            }

            if (!form.type) form.type = '/'

            const target = modList.value.find(m => m.id === form.id)
            if (target) {
                Object.assign(target, form)
            }
        }
        await saveMods()
        await fetchMods(activeGame.value.name)
    }

    // 保存 Mod 配置
    const saveMods = async () => {
        await axios.post('/api/mods/save', { gameId: activeGame.value.id, mods: modList.value })
    }

    // 删除 Mod
    const deleteMod = async (mod) => {
        await axios.post('/api/mods/delete', {
            gameName: activeGame.value.name,
            modPath: mod.path
        })
        await fetchMods(activeGame.value.name)
    }

    // 导入 Mod
    const importMods = async (paths = null) => {
        if (!paths) {
            const res = await axios.get('/api/dialog/folders')
            paths = res.data.paths
        }
        if (!paths?.length) return
        await axios.post('/api/mods/import', { gameId: activeGame.value.id, paths })
        await fetchMods(activeGame.value.name)
    }

    // 打开 Mod 文件夹
    const openModFolder = async (gameName, modPath) => {
        await axios.post('/api/mods/open-folder', { gameName, modPath })
    }

    // 获取 Mod 文件列表
    const fetchModFiles = async (gameName, modPath) => {
        const res = await axios.get('/api/mods/files', {
            params: { gameName, modPath }
        })
        modFiles.value = res.data.files
    }

    // 打开文件管理器
    const pickCover = async () => {
        const res = await axios.get('/api/dialog/file', { params: { type: 'image' } })
        return res.data.path
    }

    // 打开游戏根目录
    const openGameFolder = async () => {
        await axios.post('/api/game/open-folder', { gameName: activeGame.value.name })
    }

    // 启动游戏
    const launchGame = async () => {
        await axios.post('/api/game/launch', { gameName: activeGame.value.name })
    }

    return {
        filter,
        modList,
        modFiles,
        typeList,
        groupList,
        filteredList,
        totalCount,
        installedCount,
        uninstalledCount,

        fetchMods,
        updateMod,
        deleteMod,
        importMods,
        pickCover,
        openModFolder,
        fetchModFiles,
        openGameFolder,
        launchGame
    }
})