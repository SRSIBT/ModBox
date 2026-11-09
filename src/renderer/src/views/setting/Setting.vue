<template>
  <div class="setting">
    <div class="setting__content">
      <!-- 常规 -->
      <section class="block glass-card">
        <div class="block__title">常规</div>

        <div class="row">
          <div class="row__label">
            <div class="row__name">主题</div>
            <div class="row__desc">切换亮色 / 暗色外观</div>
          </div>
          <div class="segment">
            <button class="segment__item" :class="{ 'segment__item--active': theme === 'light' }"
              @click="setTheme('light')">
              亮
            </button>
            <button class="segment__item" :class="{ 'segment__item--active': theme === 'dark' }"
              @click="setTheme('dark')">
              暗
            </button>
          </div>
        </div>
      </section>

      <!-- 外观 -->
      <section class="block glass-card">
        <div class="block__title">外观</div>

        <div class="row">
          <div class="row__label">
            <div class="row__name">背景特效</div>
            <div class="row__desc">叠加在壁纸上的全局动态效果</div>
          </div>
          <div class="segment">
            <button class="segment__item" :class="{ 'segment__item--active': weather === 'none' }"
              @click="setWeather('none')">
              无
            </button>
            <button class="segment__item" :class="{ 'segment__item--active': weather === 'rain' }"
              @click="setWeather('rain')">
              下雨
            </button>
            <button class="segment__item" :class="{ 'segment__item--active': weather === 'snow' }"
              @click="setWeather('snow')">
              下雪
            </button>
          </div>
        </div>

        <div class="row">
          <div class="row__label">
            <div class="row__name">背景透明度</div>
            <div class="row__desc">数值越大，壁纸越暗/越淡，内容更清楚</div>
          </div>
          <div class="opacity-control">
            <input type="range" min="0" max="100" step="1" :value="backgroundOpacity"
              :style="{ '--range-value': `${backgroundOpacity}%` }"
              @input="setBackgroundOpacity($event.target.value, false)"
              @change="setBackgroundOpacity($event.target.value)" />
            <span>{{ backgroundOpacity }}%</span>
          </div>
        </div>

        <div class="row__name row__desc--top">背景图</div>

        <div class="bg-list">
          <!-- 系统默认壁纸 -->
          <div class="bg-card" :class="{ 'bg-card--active': background === 'default' }"
            @click="setBackground('default')">
            <div class="bg-card__preview">
              <img :src="defaultBgUrl" alt="默认壁纸" />
            </div>
            <div class="bg-card__foot">
              <span class="bg-card__name">默认壁纸</span>
              <span class="bg-card__tag">内置</span>
            </div>
          </div>

          <!-- 用户上传图 -->
          <div class="bg-card" :class="{
            'bg-card--active': background === 'custom',
            'bg-card--empty': !hasCustom
          }" @click="hasCustom && setBackground('custom')">
            <div class="bg-card__preview">
              <img v-if="hasCustom" :src="customBgUrl" alt="我的背景" />
              <div v-else class="bg-card__placeholder">尚未上传</div>
            </div>
            <div class="bg-card__foot">
              <span class="bg-card__name">我的背景</span>
              <button class="bg-card__upload" @click.stop="pickBackground">
                {{ hasCustom ? '更换' : '上传' }}
              </button>
              <span class="tip" :title="hasCustom ? '' : '尚未上传自定义背景'">
                <button class="bg-card__del" :disabled="!hasCustom" @click.stop="onRemoveBackground">
                  删除
                </button>
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- 关于 -->
      <section class="block glass-card">
        <div class="block__title">关于</div>
        <div class="about">
          <div class="about__row">
            <span class="about__key">应用名</span>
            <span class="about__val">{{ appInfo.name || '—' }}</span>
          </div>
          <div class="about__row">
            <span class="about__key">版本</span>
            <span class="about__val">{{ appInfo.version || '—' }}</span>
          </div>
          <div class="about__row">
            <span class="about__key">作者</span>
            <span class="about__val">{{ appInfo.author || '—' }}</span>
          </div>
          <div class="about__row about__row--intro">
            <span class="about__key">简介</span>
            <span class="about__val">{{ appInfo.description || '—' }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { storeToRefs } from 'pinia'
import { useSettingStore } from '@/stores/setting'

const settingStore = useSettingStore()
const { theme, background, backgroundOpacity, appInfo, weather, hasCustom, defaultBgUrl, customBgUrl } = storeToRefs(settingStore)
const { setBackground, setBackgroundOpacity, setWeather, pickBackground, removeBackground, saveSettings } = settingStore

const setTheme = async (value) => {
  theme.value = value;
  await saveSettings()
}

const onRemoveBackground = async () => {
  await removeBackground()
}
</script>

<style scoped>
.setting {
  flex: 1;
  display: flex;
  gap: 12px;
  padding: 12px;
  min-width: 0;
  color: var(--text);
  overflow: hidden;
}

/* 左侧定位栏 */
.setting__nav {
  width: 70px;
  flex-shrink: 0;
  padding: 8px;
  max-height: max-content;
  box-sizing: border-box;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
  padding: 6px;
  border-radius: 8px;
  font-size: 12px;
  color: var(--text-sub);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}

/* 图标默认走描边，靠 currentColor 自动跟随亮/暗主题和选中态 */
.nav-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.2s ease;
}

.nav-item:hover .nav-icon {
  transform: scale(1.08);
}

.nav-item__label {
  line-height: 1.3;
  word-break: keep-all;
}

.nav-item:hover {
  color: var(--text);
  background: var(--bg-hover);
}

.nav-item--active {
  background: var(--bg-hover);
  color: var(--text);
  font-weight: 500;
}

/* 右侧内容区 */
.setting__content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding-right: 4px;
  scroll-behavior: smooth;
  /* 定位上下文：让 section 的 offsetTop 相对本容器计算 */
  position: relative;
}

.block {
  padding: 16px;
  margin-bottom: 12px;
}

.block:last-child {
  margin-bottom: 0;
}

.block__title {
  font-size: 14px;
  font-weight: 500;
  padding-bottom: 10px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--divider);
}

/* 通用行：左说明 + 右控件 */
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
}

.row+.row {
  border-top: 1px solid var(--divider);
}

.row__name {
  font-size: 13px;
}

.row__desc {
  font-size: 11px;
  color: var(--text-faint);
  margin-top: 3px;
}

.row__desc--top {
  margin: 0 0 10px;
}

/* 开关 */
.switch {
  width: 38px;
  height: 22px;
  flex-shrink: 0;
  padding: 0;
  border: 1px solid var(--inner-border);
  border-radius: 11px;
  background: var(--inner-bg);
  cursor: pointer;
  position: relative;
  transition: background-color 0.2s ease;
}

.switch--on {
  background: var(--accent);
  border-color: transparent;
}

.switch__dot {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s ease;
}

.switch--on .switch__dot {
  transform: translateX(16px);
}

/* 背景遮罩滑杆 */
.opacity-control {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 240px;
  flex-shrink: 0;
}

.opacity-control input[type='range'] {
  flex: 1;
  height: 4px;
  appearance: none;
  border-radius: 99px;
  outline: none;
  background: linear-gradient(to right,
      var(--accent) 0 var(--range-value),
      var(--inner-border) var(--range-value) 100%);
  cursor: pointer;
}

.opacity-control input[type='range']::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--panel-bg);
  background: var(--accent);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
}

.opacity-control span {
  width: 36px;
  text-align: right;
  color: var(--text-sub);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

/* 分段控件（亮/暗） */
.segment {
  display: flex;
  flex-shrink: 0;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: var(--inner-bg);
  border: 1px solid var(--inner-border);
}

.segment__item {
  padding: 4px 14px;
  font-size: 12px;
  color: var(--text-sub);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}

.segment__item:hover {
  background: var(--bg-hover);
}

.segment__item--active {
  background: var(--panel-bg);
  color: var(--text);
}

/* 背景卡片 */
.bg-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.bg-card {
  width: 200px;
  border-radius: 10px;
  border: 1px solid var(--inner-border);
  background: var(--inner-bg);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.bg-card--active {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.bg-card--empty {
  cursor: default;
}

.bg-card__preview {
  height: 100px;
  background: var(--card-bg);
}

.bg-card__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.bg-card__placeholder {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--text-faint);
  border-bottom: 1px dashed var(--inner-border);
}

.bg-card__foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
}

.bg-card__name {
  flex: 1;
  font-size: 12px;
}

.bg-card__tag {
  font-size: 10px;
  color: var(--text-faint);
}

.bg-card__upload,
.bg-card__del {
  padding: 3px 8px;
  font-size: 11px;
  color: var(--text-sub);
  background: var(--inner-bg);
  border: 1px solid var(--inner-border);
  border-radius: 6px;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}

.bg-card__upload:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.bg-card__del:hover:not(:disabled) {
  background: #e74f4f55;
  color: #fff;
}

.bg-card__del:disabled {
  color: var(--text-faint);
  cursor: not-allowed;
  opacity: 0.6;
}

.tip {
  display: inline-flex;
}

/* 关于 */
.about {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.about__row {
  display: flex;
  gap: 16px;
  font-size: 12px;
  line-height: 1.6;
}

.about__key {
  width: 56px;
  flex-shrink: 0;
  color: var(--text-sub);
}

.about__val {
  flex: 1;
  min-width: 0;
  color: var(--text);
  word-break: break-word;
}
</style>
