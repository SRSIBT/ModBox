import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

export const useNoticeStore = defineStore('notice', () => {
  const notices = ref([]) // 公告列表
  const currentId = ref(null) // 公告ID

  // 未读数
  const unreadCount = computed(() => {
    return notices.value.filter((n) => !n.read).length
  })

  // 是否全部已读
  const allRead = computed(() => {
    return notices.value.every((n) => n.read)
  })

  // 当前选中的公告
  const current = computed(() => {
    return notices.value.find((n) => n.id === currentId.value)
  })

  // 获取公告
  const fetchNotices = async () => {
    const res = await axios.get('/api/notices')
    const list = res.data.notices

    // 排序
    const sorted = [...list].sort((a, b) => {
      if (a.tag === '置顶' && b.tag !== '置顶') return -1
      if (a.tag !== '置顶' && b.tag === '置顶') return 1
      return new Date(b.time) - new Date(a.time)
    })

    notices.value = sorted

    // 用排序后的第一条
    if (sorted.length > 0 && !currentId.value) {
      currentId.value = sorted[0].id
    }
  }

  // 保存已读状态到 data/notice-state.json
  const saveNotices = async () => {
    try {
      await axios.post(
        '/api/notices',
        notices.value.map((n) => ({ id: n.id, read: n.read, readAt: n.readAt }))
      )
    } catch (e) {
      console.warn('[notices.js] 已读状态保存失败：', e.message)
    }
  }

  // 标记未读
  const markUnread = (noticeId) => {
    const notice = notices.value.find((n) => n.id === noticeId)
    if (!notice) return

    notice.read = false
    notice.readAt = null
    saveNotices()
  }

  // 标记已读
  const markRead = (notice) => {
    if (notice.read) return
    notice.read = true
    notice.readAt = new Date().toISOString()
    saveNotices()
  }

  // 全部已读
  const readAll = () => {
    const now = new Date().toISOString()
    notices.value.forEach((n) => {
      if (!n.read) {
        n.read = true
        n.readAt = now
      }
    })
    saveNotices()
  }

  // 日期格式化
  const formatTime = (timeStr) => {
    const date = new Date(timeStr)
    const now = new Date()
    const month = date.getMonth() + 1
    const day = date.getDate()

    if (date.getFullYear() === now.getFullYear()) {
      return `${month} 月 ${day} 日`
    } else {
      return `${date.getFullYear()} 年 ${month} 月 ${day} 日`
    }
  }

  // 格式化已读时间
  const formatReadTime = (readAt) => {
    if (!readAt) return ''
    const diff = Date.now() - new Date(readAt).getTime()
    const minute = 60 * 1000
    const hour = 60 * minute
    const day = 24 * hour

    if (diff < minute) return '刚刚'
    if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
    if (diff < day) return `${Math.floor(diff / hour)} 小时前`
    if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`
    return '很久以前'
  }

  return {
    notices,
    currentId,
    current,
    unreadCount,
    allRead,

    fetchNotices,
    markRead,
    markUnread,
    readAll,
    formatTime,
    formatReadTime
  }
})
