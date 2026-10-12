<template>
    <div class="fs" ref="rootRef">
        <div class="fs__trigger" :class="{ open: isOpen }" @click="isOpen = !isOpen">
            <span>{{ currentLabel }}</span>
            <svg class="arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 6l4 4 4-4" />
            </svg>
        </div>

        <Transition name="fs">
            <div class="fs__panel" v-if="isOpen">
                <div class="fs__option" v-for="opt in props.options" :key="opt.value"
                    :class="{ active: modelValue === opt.value }" @click="pick(opt.value)">
                    {{ opt.label }}
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
    modelValue: [String, Number],
    options: Array,
})

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const rootRef = ref(null)

const currentLabel = computed(() => {
    const found = props.options.find(o => o.value === props.modelValue)
    return found ? found.label : '请选择'
})

const pick = (val) => {
    emit('update:modelValue', val)
    isOpen.value = false
}

const handleClickOutside = (e) => {
    if (rootRef.value && !rootRef.value.contains(e.target)) {
        isOpen.value = false
    }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<style scoped>
.fs {
    position: relative;
    display: inline-block;
    font-size: 12px;
    user-select: none;
}

.fs__trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid var(--inner-border);
    background: var(--inner-bg);
    color: var(--text);
    cursor: pointer;
    transition: border-color .2s ease;
}

.fs__trigger:hover {
    border-color: var(--accent);
}

.fs__trigger.open {
    border-color: var(--accent);
}

.fs__trigger .arrow {
    width: 10px;
    height: 10px;
    color: var(--text-sub);
    transition: transform .2s ease;
}

.fs__trigger.open .arrow {
    transform: rotate(180deg);
}

.fs__panel {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 100%;
    padding: 4px;
    border-radius: 8px;
    border: 1px solid var(--panel-border);
    background: var(--panel-bg);
    backdrop-filter: var(--panel-blur);
    -webkit-backdrop-filter: var(--panel-blur);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    z-index: 100;
}

.fs__option {
    padding: 6px 10px;
    border-radius: 6px;
    color: var(--text);
    cursor: pointer;
    white-space: nowrap;
    transition: background-color .15s ease;
}

.fs__option:hover {
    background: var(--bg-hover);
}

.fs__option.active {
    color: var(--accent);
}

/* 过渡 */
.fs-enter-active,
.fs-leave-active {
    transition: opacity .15s ease, transform .15s ease;
}

.fs-enter-from,
.fs-leave-to {
    opacity: 0;
    transform: translateY(-4px);
}
</style>