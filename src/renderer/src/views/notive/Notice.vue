<template>
  <Transition name="notice">
    <div class="nt-mask" v-if="visible" @click="close">
      <div class="nt glass-card" @click.stop>
        <div class="nt-title">
          <div class="nt-title__logo">
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M8 2a4 4 0 0 0-4 4v2.5L2.5 10.5h11L12 8.5V6a4 4 0 0 0-4-4z" />
              <path d="M6.5 12.5a1.5 1.5 0 0 0 3 0" />
            </svg>
          </div>
          <span>公告</span>
          <button class="nt-title__close" @click="close">
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            >
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        </div>

        <div class="nt-content">
          <div class="nt-content__tool">
            <button @click="fetchNotices">刷新</button>
            <button @click="readAll" :class="{ readAll: !allRead }">全部已读</button>
          </div>

          <div class="nt-content__box">
            <div class="left">
              <div
                class="left-item"
                :class="{
                  'current-item': current.id === notice.id,
                  'item-hover': current.id !== notice.id
                }"
                v-for="notice in notices"
                :key="notice.id"
                @click="currentId = notice.id"
              >
                <div class="item-header">
                  <span class="tag" :class="notice.tag === '置顶' ? 'tag-top' : 'tag-normal'">{{
                    notice.tag
                  }}</span>
                  <div class="time">
                    {{ formatTime(notice.time) }}
                  </div>
                </div>
                <div class="item-title">
                  <svg
                    v-if="!notice.read"
                    viewBox="0 0 1024 1024"
                    version="1.1"
                    p-id="5747"
                    width="16"
                    height="16"
                  >
                    <path
                      d="M512.3 512.2m-127.8 0a127.8 127.8 0 1 0 255.6 0 127.8 127.8 0 1 0-255.6 0Z"
                      fill="#EF2020"
                      p-id="5748"
                    ></path>
                  </svg>
                  <span>{{ notice.title }}</span>
                </div>
                <div class="item-content">
                  <div v-for="(line, i) in notice.content" :key="i">
                    {{ line }}
                  </div>
                </div>
              </div>
            </div>

            <div class="right" v-if="current">
              <div class="right-header">
                <span class="tag" :class="current.tag === '置顶' ? 'tag-top' : 'tag-normal'">
                  {{ current.tag }}
                </span>
                <div class="right-title">{{ current.title }}</div>
                <div class="time">
                  <span>{{ formatTime(current.time) }}</span>
                  <span v-if="current.read"> · 读于 {{ formatReadTime(current.readAt) }}</span>
                </div>
              </div>

              <div class="right-content">
                <div v-for="(line, i) in current.content" :key="i">
                  {{ line }}
                  <br /><br />
                </div>
              </div>

              <div class="right-close">
                <a @click="markUnread(current.id)">标为未读</a>
                <button @click="markRead(current)">知道啦</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { onMounted } from 'vue'
import { useNoticeStore } from '@/stores/notices'
import { storeToRefs } from 'pinia'

const noticeStore = useNoticeStore()
const { notices, allRead, current, currentId } = storeToRefs(noticeStore)
const { fetchNotices, markRead, readAll, markUnread, formatTime, formatReadTime } = noticeStore

onMounted(() => {
  fetchNotices()
})

defineProps({
  visible: Boolean
})

const emit = defineEmits(['update:visible'])

const close = () => {
  emit('update:visible', false)
}
</script>

<style scoped>
.nt-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.nt {
  width: 680px;
  height: 500px;
  display: flex;
  flex-direction: column;
  color: var(--text);
  z-index: 200;
}

.nt-title {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
  align-items: center;
  padding: 12px;
  font-size: 14px;
  font-weight: 600;
  border-bottom: 1px solid var(--divider);
}

.nt-title__logo {
  width: 20px;
  height: 20px;
  padding: 4px;
  border: 1px solid var(--panel-border);
  border-radius: 10px;
}

.nt-title__close {
  margin-left: auto;
  width: 24px;
  height: 24px;
  padding: 4px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text);
  transition: background-color 0.2s ease;
}

.nt-title__close:hover {
  background: var(--bg-hover);
}

.nt-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px;
}

.nt-content__tool {
  display: flex;
  align-items: center;
  justify-content: right;
  gap: 6px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--divider);
}

.nt-content__tool button {
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid var(--panel-border);
  background: none;
  font-size: 12px;
  cursor: pointer;
  color: var(--text);
  align-items: center;
  transition: background-color 0.2s ease;
}

.nt-content__tool button:nth-child(1):hover {
  background: var(--bg-hover);
}

.nt-content__tool button:nth-child(2) {
  color: #8ba092;
  background: var(--notice-readall);
}

.nt-content__tool button.readAll {
  color: #1e5e3d;
  background: #e4ede8;
}

.nt-content__tool button.readAll:hover {
  color: #1a6940;
  background: #c6e7d6;
}

.nt-content__box {
  flex: 1;
  display: flex;
}

.nt-content__box .left {
  width: 200px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  border-right: 1px solid var(--divider);
  border-bottom-left-radius: 10px;
}

.left-item {
  padding: 8px;
  overflow: hidden;
  cursor: pointer;
  border-radius: 10px;
  background: transparent;
  border: 1px solid transparent;
  transition: background-color 0.2s ease;
}

.left-item .item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.left-item .item-title {
  display: flex;
  align-items: center;
  color: var(--text);
  padding: 4px 0;
  font-size: 12px;
  font-weight: 500;
}

.left-item .item-content {
  color: var(--text-sub);
  font-size: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.item-hover:hover {
  background: var(--notice-item-hover);
}

.current-item {
  background: var(--notice-current-item);
  border: 1px solid var(--notice-current-item-border);
}

.nt-content__box .right {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
}

.right-header {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--divider);
}

.right-title {
  padding: 4px 0;
  font-weight: 500;
}

.right-content {
  flex: 1;
  padding-top: 12px;
  font-size: 10px;
  color: var(--text-sub);
}

.right-close {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.right-close a {
  cursor: pointer;
  font-size: 10px;
}

.right-close a:hover {
  text-decoration: underline;
}

.right-close button {
  color: var(--text);
  cursor: pointer;
  font-weight: 500;
  padding: 4px 8px;
  background: none;
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  transition: background-color 0.2s ease;
}

.right-close button:hover {
  background: var(--bg-hover);
}

.tag {
  padding: 2px 6px;
  font-size: 8px;
  font-weight: 500;
  border-radius: 10px;
}

.tag-top {
  color: #845919;
  background: #e7dac6;
}

.tag-normal {
  color: #1e5e3d;
  background: #d5e1de;
}

.time {
  color: var(--text-sub);
  font-size: 10px;
}

.notice-enter-active,
.notice-leave-active {
  transition: opacity 0.2s ease;
}

.notice-enter-from,
.notice-leave-to {
  opacity: 0;
}

.notice-enter-active .nt,
.notice-leave-active .nt {
  transition: transform 0.2s ease;
}

.notice-enter-from .nt,
.notice-leave-to .nt {
  transform: scale(0.95);
}
</style>
