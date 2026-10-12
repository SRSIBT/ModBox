import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

export const useSettingStore = defineStore('setting', () => {
    const activeGame = ref('')
    const theme = ref('light')
    const background = ref('')
    const modColumns = ref([
        { key: 'status', label: '安装', width: 80 },
        { key: 'drag', label: '排序', width: 40 },
        { key: 'index', label: '序号', width: 30 },
        { key: 'cover', label: '封面', width: 60 },
        { key: 'name', label: '名称', width: 200 },
        { key: 'type', label: '类型', width: 80 },
        { key: 'modId', label: '模组 ID', width: 100 },
        { key: 'version', label: '版本', width: 80 },
        { key: 'author', label: '作者', width: 80 },
        { key: 'group', label: '分组', width: 80 },
    ])

    const fetchSettings = async () => {
        const res = await axios.get('/api/settings')
        activeGame.value = res.data.activeGame || ''
        theme.value = res.data.theme || 'light'
        background.value = res.data.background || ''
        const saved = res.data.modColumns || []
        saved.forEach(s => {
            const col = modColumns.value.find(c => c.key === s.key)
            if (col) col.width = s.width
        })
    }

    const saveSettings = async () => {
        await axios.post('/api/settings', {
            activeGame: activeGame.value,
            theme: theme.value,
            background: background.value,
            modColumns: modColumns.value
        })
    }

    const startResize = (i, e) => {
        const startX = e.clientX
        const startWidth = modColumns.value[i].width
        const resizeIndex = i

        const onResize = (ev) => {
            const diff = ev.clientX - startX
            modColumns.value[resizeIndex].width = Math.max(40, startWidth + diff)
        }

        const stopResize = () => {
            document.removeEventListener('mousemove', onResize)
            document.removeEventListener('mouseup', stopResize)
            saveSettings()
        }

        document.addEventListener('mousemove', onResize)
        document.addEventListener('mouseup', stopResize)
    }

    return {
        activeGame,
        theme,
        background,
        modColumns,

        fetchSettings,
        saveSettings,
        startResize,
    }
})