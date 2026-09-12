<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import BannerTopicSckeleton from '~/components/ui/BannerTopicSckeleton.vue'
import { topicsService } from '~/services/curriculum/topics'
import type { TopicDetailResponse, TopicsListResponse } from '~/interfaces/curriculum/topics'

const showPopuler = ref(0)
const animate = ref(false)
const progress = ref(0)
const progressText = ref(0)
const loading = ref(true)
const router = useRouter()

const toPage = (slug: string) => {
  router.push(`/app/topics/${slug}/detail`)
}

const { data: topicsRes, isLoading } = useQuery({
  queryKey: ['topics'],
  queryFn: async () => {
    const res = await topicsService.findAll<true>({
      include: 'categories',
      page: 1,
      limit: 10,
    })
    return res
  },
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 10,
})

const topics = computed<TopicDetailResponse<true>[]>(() => {
  const data = topicsRes.value?.data
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray((data as TopicsListResponse<true>).data)) {
    return (data as TopicsListResponse<true>).data
  }
  return []
})

onMounted(() => {
  let interval: any
  let progressInterval: any
  const DURATION = 5000
  const PROGRESS_STEP = 100 / (DURATION / 50)

  const startCycle = () => {
    if (!topics.value.length) return
    progress.value = 0
    progressText.value = 0
    clearInterval(interval)
    clearInterval(progressInterval)
    progressInterval = setInterval(() => {
      if (progress.value < 100) {
        progress.value += PROGRESS_STEP
        progressText.value = Math.round(progress.value)
      }
    }, 50)
    interval = setInterval(() => {
      animate.value = true
      setTimeout(() => {
        showPopuler.value = (showPopuler.value + 1) % topics.value.length
        animate.value = false
        progress.value = 0
        progressText.value = 0
      }, 400)
    }, DURATION)
  }

  if (topics.value.length > 0) {
    loading.value = false
    startCycle()
  }

  watch(isLoading, (val) => {
    if (!val) {
      setTimeout(() => {
        loading.value = false
        if (topics.value.length > 0) startCycle()
      }, 500)
    }
  })

  onUnmounted(() => {
    clearInterval(interval)
    clearInterval(progressInterval)
  })
})
</script>

<template>
  <div v-if="loading" class="animate-pulse space-y-4">
    <BannerTopicSckeleton />
  </div>

  <div v-else class="w-full flex gap-3 sm:gap-4 md:gap-6 items-start">
    <div
      class="flex-1 2xl:h-[60vh] md:h-96 sm:h-72 h-40 shadow-sm sm:shadow-xl md:shadow-2xl shadow-white/10 relative rounded-2xl overflow-hidden transition-all duration-500"
      :class="{ 'fade-out': animate, 'fade-in': !animate }"
    >
      <NuxtImg
        :src="topics[showPopuler]?.image?.url"
        class="w-full h-full object-cover transition-all duration-500"
      />

      <div class="absolute inset-0 bg-black/40 z-20 p-4 flex flex-col justify-between">
        <div class="relative w-6 h-6 md:w-10 md:h-10 ml-auto">
          <svg class="absolute inset-0 rotate-90" viewBox="0 0 36 36">
            <circle
              cx="18"
              cy="18"
              r="16"
              stroke="white"
              stroke-opacity="0.2"
              stroke-width="3"
              fill="none"
            />
            <circle
              cx="18"
              cy="18"
              r="16"
              stroke="#ffe6cc"
              stroke-width="3"
              fill="none"
              stroke-linecap="round"
              :stroke-dasharray="100"
              :stroke-dashoffset="100 - progress"
              class="transition-all duration-100 linear"
            />
          </svg>
          <span
            class="absolute inset-0 flex items-center justify-center text-[8px] md:text-xs text-white font-semibold"
          >
            {{ progressText }}
          </span>
        </div>

        <div class="w-full md:max-w-3/4 max-w-full space-y-1 sm:space-y-2 md:space-y-3">
          <h3 class="text-white text-[12px] sm:text-sm md:text-md lg:text-lg font-bold text-nowrap truncate">
            {{ topics[showPopuler]?.title }}
          </h3>
          <p v-html="topics[showPopuler]?.description" class="text-white/60 text-[10px] sm:text-xs lg:text-sm line-clamp-1 sm:line-clamp-2" />
          <div class="flex items-center flex-wrap gap-2">
            <UBadge
              v-for="(value, index) in topics[showPopuler]?.categories"
              :key="value.id"
              :label="value.name"
              class="text-dark md:text-base sm:text-sm text-[6px] p-0.5 sm:p-1 md:p-2"
            />
          </div>
        </div>
      </div>
    </div>

    <div
      class="sm:max-w-[25%] max-w-[30%] 2xl:h-[60vh] md:h-96 sm:h-72 h-40 group relative overflow-hidden"
    >
      <div
        class="text-[10px] text-center sm:text-sm md:text-base font-semibold mb-2 text-white/80 sm:px-4 px-1 sm:py-2 py-0.5 border-2 border-[#002966]/80 rounded-md relative overflow-hidden"
      >
        Hero&apos;s Missions
        <div class="shine"></div>
      </div>
      <div
        class="flex flex-col h-full overflow-auto no-scrollbar gap-3 pt-4 pb-16 sm:pb-18 md:pb-20 
        [mask-image:_linear-gradient(to_bottom,_transparent_0,_white_10px,_white_calc(100%-10px),_transparent_70%)]
        sm:[mask-image:_linear-gradient(to_bottom,_transparent_0,_white_14px,_white_calc(100%-14px),_transparent_70%)]
        md:[mask-image:_linear-gradient(to_bottom,_transparent_0,_white_16px,_white_calc(100%-16px),_transparent_70%)]"
      >
        <div
          v-for="value in topics"
          :key="value.id"
          @click="toPage(value.slug)"
          class="hover:shadow-2xl group p-1 hover:p-0 hover:shadow-secondary/80 cursor-pointer transition-all duration-200"
        >
          <NuxtImg
            :src="value?.image?.url"
            :alt="'image' + value.id"
            class="w-full h-14 sm:h-20 md:h-28 object-cover rounded-lg mb-3 transition-transform duration-300"
          />
          <p
            class="md:text-sm text-xs text-white/60 group-hover:text-white transition-all duration-200 truncate transition-colors"
          >
            {{ value.title }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-out {
  opacity: 0;
  transform: scale(0.98);
}
.fade-in {
  opacity: 1;
  transform: scale(1);
  transition: opacity 0.4s ease, transform 0.4s ease;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 50%;
  height: 100%;
  background: linear-gradient(
    120deg,
    transparent 0%,
    rgba(0, 41, 102, 0.3) 20%,
    rgba(0, 41, 102, 0.1) 50%,
    transparent 100%
  );
  transform: skewX(-20deg);
  pointer-events: none;
  z-index: 20;
}
.group:hover .shine {
  animation: shine-move 1s ease forwards;
}
@keyframes shine-move {
  0% {
    left: -100%;
  }
  100% {
    left: 120%;
  }
}
</style>
