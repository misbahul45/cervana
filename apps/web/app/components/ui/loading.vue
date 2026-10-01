<template>
  <div class="flex items-center gap-2">
    <div :style="{ width: imageSize, height: imageSize }">
      <svg width="100%" height="100%" viewBox="0 0 50 50">
        <g fill="none" stroke="#fd941c" stroke-width="2">
          <path d="M15 10h15l5 5v20H15V10">
            <animate attributeName="stroke-dasharray" values="0,100;100,0" dur="2s" repeatCount="indefinite" />
          </path>
          <path d="M30 10v5h5">
            <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" />
          </path>
          <path d="M20 20h10M20 25h10M20 30h10">
            <animate attributeName="stroke-dasharray" values="0,60;60,0" dur="2s" repeatCount="indefinite" />
          </path>
        </g>
      </svg>
    </div>

    <div v-if="props.showText" class="flex flex-1 flex-col text-left animate-pulse">
      <span :class="[titleSize, 'font-semibold']">{{ currentText }}</span>
      <span :class="[infoSize, 'opacity-70']">Please wait…</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, defineProps } from 'vue'

const props = defineProps({
  size: {
    type: String,
    default: 'md',
  },
  showText: {
    type: Boolean,
    default: true,
  },
})

const sizeMap = {
  xs: { image: '32px', title: 'text-[12px]', info: 'text-[10px]' },
  sm: { image: '48px', title: 'text-base', info: 'text-xs' },
  md: { image: '64px', title: 'text-lg', info: 'text-sm' },
  lg: { image: '80px', title: 'text-xl', info: 'text-md' }, 
}

const imageSize = computed(() => sizeMap[props.size].image)
const titleSize = computed(() => sizeMap[props.size].title)
const infoSize = computed(() => sizeMap[props.size].info)

const texts = [
  'Getting contextual…',
  'Analyzing…',
  'Fetching data…',
  'Creating AI-driven insights…',
  'Finalizing results…',
  'Structring results'
]

const currentText = ref(texts[0])

onMounted(() => {
  let index = 0
  setInterval(() => {
    index = (index + 1) % texts.length
    currentText.value = texts[index]
  }, 3000)
})
</script>
