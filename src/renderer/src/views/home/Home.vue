<template>
  <div class="home">
    <!-- 正中间的欢迎标题 -->
    <div class="welcome-center">
      <div class="welcome__title gradient-text">欢迎回家 铁驭</div>
      <div class="welcome__sub">今天过得怎么样，想玩点什么嘛...</div>
    </div>

    <!-- 左下角的时间与日期 -->
    <div class="clock-widget">
      <div class="clock-time">
        <span class="clock-hour">{{ currentTime.hour }}</span>
        <span class="clock-colon">:</span>
        <span class="clock-minute">{{ currentTime.minute }}</span>
        <span class="clock-seconds">{{ currentTime.seconds }}</span>
      </div>
      <div class="clock-date">{{ currentDate }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useSettingStore } from '@/stores/setting'

const settingStore = useSettingStore()
const { fetchSettings } = settingStore

// 定义时间对象
const currentTime = ref({ hour: '00', minute: '00', seconds: '00' })
const currentDate = ref('')

let timer = null

function updateTime() {
  const now = new Date()
  currentTime.value = {
    hour: String(now.getHours()).padStart(2, '0'),
    minute: String(now.getMinutes()).padStart(2, '0'),
    seconds: String(now.getSeconds()).padStart(2, '0')
  }

  const weekDays = ['日', '一', '二', '三', '四', '五', '六']
  currentDate.value = `${now.getFullYear()}.${now.getMonth() + 1}.${now.getDate()} · 星期${weekDays[now.getDay()]}`
}

onMounted(async () => {
  updateTime()
  timer = setInterval(updateTime, 1000) // 这里给 timer 赋值了，不会再报错
  await fetchSettings()
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer) // 卸载时清理定时器
})
</script>

<style scoped>
.home {
  color: var(--text);
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

/* 正中间的标题 */
.welcome-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  text-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
  margin-bottom: 100px;
}

.welcome-center .welcome__title {
  font-size: 48px;
  font-weight: 900;
  letter-spacing: 4px;
}

.welcome-center .welcome__sub {
  font-size: 16px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}

.gradient-text {
  font-size: 46px;
  font-weight: 900;
  letter-spacing: 4px;
  background: linear-gradient(90deg, var(--accent), #ffffff, var(--accent));
  background-size: 200% auto;
  color: transparent;
  -webkit-background-clip: text;
  background-clip: text;
  animation: shine 3s linear infinite;
}

@keyframes shine {
  from {
    background-position: 200% center;
  }

  to {
    background-position: 0% center;
  }
}

/* 左下角的时间与日期 */
.clock-widget {
  position: absolute;
  bottom: 40px;
  left: 40px;
  color: #fff;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.clock-time {
  display: flex;
  align-items: baseline;
  font-size: 64px;
  font-weight: 900;
  letter-spacing: 2px;
  line-height: 1;
  color: #fff;
}

.clock-colon {
  margin: 0 4px;
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.2;
  }
}

.clock-seconds {
  font-size: 24px;
  font-weight: 600;
  opacity: 0.6;
  margin-left: 12px;
}

.clock-date {
  font-size: 18px;
  font-weight: 500;
  opacity: 0.9;
}
</style>
