<template>
  <div class="relative" @mousemove="handleMove">
    <div
      class="absolute inset-0 pointer-events-none transition-all duration-300"
      :style="{
        background: `radial-gradient(400px circle at ${mouseX}px ${mouseY}px, rgba(0,41,102,0.25), transparent 80%)`
      }"
    ></div>

    <div
      v-if="isLoading && topics.length === 0"
      class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 space-y-1 sm:space-y-3 md:space-y-4 relative z-10"
    >
      <div
        v-for="n in count"
        :key="n"
        class="break-inside-avoid mb-1 sm:mb-3 md:mb-4 rounded-2xl bg-slate-800/20 border border-slate-700/30 shadow-md overflow-hidden animate-pulse"
        :class="`h-${randomHeights[n % randomHeights.length]}`"
      >
        <div
          :class="`w-full md:h-${randomHeights[n % randomHeights.length]} sm:h-40 h-32 bg-slate-700/30`"
        ></div>
        <div class="p-4 space-y-2">
          <div class="h-4 bg-slate-700/30 rounded w-3/4"></div>
          <div class="h-3 bg-slate-700/20 rounded w-1/2"></div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-1 sm:gap-3 md:gap-4 relative z-10">
      <div
        v-for="(value, index) in topics"
        :key="value.id"
        class="b"
      >
        <TopicCard v-bind="value" :index="index" :is-loading="isLoading" />
      </div>
      <div ref="bottomRef" class="h-10 w-full"></div>
    </div>

    <div v-if="isFetchingNextPage" class="text-center py-4 text-slate-400">
      Memuat topik berikutnya...
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useInfiniteQuery } from '@tanstack/vue-query'
import { topicsService } from '~/services/curriculum/topics'
import type { TopicDetailResponse, TopicsListResponse } from '~/interfaces/curriculum/topics'
import TopicCard from './TopicCard.vue'

const mouseX = ref(0)
const mouseY = ref(0)
const route = useRoute()
const limit = ref(Number(route.query.limit) || 10)

const handleMove = (e: MouseEvent) => {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  mouseX.value = e.clientX - rect.left
  mouseY.value = e.clientY - rect.top
}

const count = 10
const randomHeights = Array.from({ length: count }, () =>
  Math.floor(Math.random() * 20) + 36
)

const { data, fetchNextPage, isFetchingNextPage, hasNextPage, isLoading } = useInfiniteQuery({
  queryKey: ['topics', limit],
  queryFn: async ({ pageParam = 1 }) => {
    return await topicsService.findAll({ page: pageParam, limit: limit.value })
  },
  getNextPageParam: (lastPage) => {
    const meta = lastPage?.data?.pagination
    if (!meta || meta.page === undefined || meta.totalPages === undefined) return undefined
    const nextPage = meta.page + 1
    return nextPage <= meta.totalPages ? nextPage : undefined
  },
  initialPageParam: 1,
})

const topics = computed<TopicDetailResponse<true>[]>(() => {
  const pages = data.value?.pages || []
  return pages.flatMap((page) => {
    const d = page.data
    if (Array.isArray(d)) return d as TopicDetailResponse<true>[]
    const innerData = (d as TopicsListResponse<true> | null | undefined)?.data
    if (Array.isArray(innerData)) return innerData as TopicDetailResponse<true>[]
    return []
  })
})

const bottomRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      const entry = entries?.[0]
      if (entry && entry.isIntersecting && hasNextPage.value && !isFetchingNextPage.value) {
        fetchNextPage()
      }
    },
    { threshold: 1 }
  )
  if (bottomRef.value) observer.observe(bottomRef.value)
})

onBeforeUnmount(() => {
  if (observer && bottomRef.value) observer.unobserve(bottomRef.value)
})
</script>
