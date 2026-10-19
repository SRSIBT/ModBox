import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import axios from 'axios'

export const useSettingStore = defineStore('setting', () => {

  const activeGameId = ref('')
  const theme = ref('light')
  const viewMode = ref('table')
  const background = ref('default')
  const minimizeToTray = ref(false)
  const nexusApiKey = ref('')

  // 背景 URL 由后端拼好，前端只管用
  const defaultBgUrl = ref('')
  const customBgUrl = ref('')
  const hasCustom = ref(false)

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
    { key: 'group', label: '分组', width: 80 }
  ])

  // 获取设置
  const fetchSettings = async () => {
    const res = await axios.get('/api/settings')

    activeGameId.value = res.data.activeGameId || ''
    theme.value = res.data.theme || 'light'
    viewMode.value = res.data.viewMode || 'table'
    background.value = res.data.background === 'custom' ? 'custom' : 'default'
    minimizeToTray.value = res.data.minimizeToTray === true
    nexusApiKey.value = res.data.nexusApiKey || ''

    const saved = res.data.modColumns || []
    saved.forEach((s) => {
      const col = modColumns.value.find((c) => c.key === s.key)
      if (col) col.width = s.width
    })

    defaultBgUrl.value = res.data.defaultBgUrl || ''
    customBgUrl.value = res.data.customBgUrl || ''
    hasCustom.value = res.data.hasCustom === true

    // 设置说用 custom，但磁盘上没图了 → 静默回落 default
    if (background.value === 'custom' && !hasCustom.value) {
      background.value = 'default'
      await saveSettings()
    }

    applyBackground()
  }

  // 保存设置
  const saveSettings = () => axios.post('/api/settings', {
    activeGameId: activeGameId.value,
    theme: theme.value,
    viewMode: viewMode.value,
    background: background.value,
    minimizeToTray: minimizeToTray.value,
    nexusApiKey: nexusApiKey.value,
    modColumns: modColumns.value
  })

  // 切换背景
  const setBackground = async (mode) => {
    background.value = mode === 'custom' ? 'custom' : 'default'
    applyBackground()
    await saveSettings()
  }

  // 上传背景
  const uploadBackground = async (image) => {
    const res = await axios.post('/api/background/custom', { image })
    customBgUrl.value = res.data.customBgUrl || ''
    hasCustom.value = res.data.hasCustom === true
    background.value = 'custom'
    applyBackground()
    await saveSettings()
  }

  // 删除背景
  const removeBackground = async () => {
    await axios.delete('/api/background/custom')
    customBgUrl.value = ''
    hasCustom.value = false
    background.value = 'default'
    applyBackground()
    await saveSettings()
  }

  // 将背景映射到 body
  const applyBackground = () => {
    const root = document.documentElement
    root.classList.toggle('bg--custom', background.value === 'custom')
    root.classList.toggle('bg--default', background.value !== 'custom')
    root.style.setProperty('--bg-default-img', defaultBgUrl.value ? `url("${defaultBgUrl.value}")` : 'none')
    root.style.setProperty('--bg-custom-img', customBgUrl.value ? `url("${customBgUrl.value}")` : 'none')
  }

  // 表头拖拽
  const startResize = (i, e) => {
    const startX = e.clientX
    const startWidth = modColumns.value[i].width
    const onResize = (ev) => { modColumns.value[i].width = Math.max(40, startWidth + ev.clientX - startX) }
    const stopResize = () => {
      document.removeEventListener('mousemove', onResize)
      document.removeEventListener('mouseup', stopResize)
      saveSettings()
    }
    document.addEventListener('mousemove', onResize)
    document.addEventListener('mouseup', stopResize)
  }

  return {
    activeGameId,
    theme,
    viewMode,
    background,
    minimizeToTray,
    nexusApiKey,
    defaultBgUrl,
    customBgUrl,
    hasCustom,
    modColumns,

    fetchSettings,
    setBackground,
    uploadBackground,
    removeBackground,
    applyBackground,
    saveSettings,
    startResize
  }
})