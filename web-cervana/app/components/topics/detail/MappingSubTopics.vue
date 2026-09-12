<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import type { TimelineItem } from '@nuxt/ui'
import type { ApiResponse } from '~/interfaces/api'
import type { SubTopicsListResponse } from '~/interfaces/curriculum/subTopics'
import { subTopicsService } from '~/services/curriculum/subTopics'
import { universeIcons } from '~/constants'


const randomIcon = () => universeIcons[Math.floor(Math.random() * universeIcons.length)]

const { topicId } = defineProps<{ topicId?: string }>()

const { data: resSubTopic } = await useAsyncData<ApiResponse<SubTopicsListResponse<true>>>(
  `subTopic-${topicId}`,
  async () =>
    subTopicsService.findAll({ page: 1, limit: 100, topicId, include: 'theme' })
)

const items = computed<(TimelineItem & { idx: number })[]>(() =>
  (resSubTopic.value?.data?.data || []).map((subtopic, i) => ({
    idx: i,
    title: subtopic.title,
    description: subtopic.description || '',
    icon: randomIcon(),
  }))
)

const activeIndexes = ref<Set<number>>(new Set())
const defaultValue = ref(0)
let observer: IntersectionObserver | null = null

const openedIndex = ref<number | null>(null)

function toggleDescription(index: number) {
  openedIndex.value = openedIndex.value === index ? null : index
}

onMounted(async () => {
  await nextTick()
  const els = document.querySelectorAll('.timeline-item')
  if (!els.length) return

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const index = Number((entry.target as HTMLElement).dataset.index)
        if (entry.isIntersecting) activeIndexes.value.add(index)
        else activeIndexes.value.delete(index)
        const lastVisible = [...activeIndexes.value].sort((a, b) => b - a)[0] ?? 0
        defaultValue.value = lastVisible + 1
      })
    },
    { threshold: 0.5 }
  )

  els.forEach((el) => observer!.observe(el))
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <div class="max-h-fit overflow-y-auto px-2 z-0">
    <UTimeline
      :items="items"
      color="primary"
      size="md"
      class="max-w-2xl mx-auto space-y-4"
      :default-value="defaultValue"
    >
      <template #title="{ item }">
        <button
          class="flex items-center justify-between w-full font-semibold text-primary hover:underline transition-colors text-left"
          @click="toggleDescription(item.idx)"
        >
          <span>{{ item.title }}</span>
          <UIcon
            :name="openedIndex === item.idx ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            class="transition-transform duration-300"
          />
        </button>
      </template>

      <template #description="{ item }">
        <div
          class="timeline-item transition-all duration-700 ease-out overflow-hidden"
          :class="{
            'opacity-100 max-h-[500px] translate-y-0': openedIndex === item.idx,
            'opacity-0 max-h-0 -translate-y-2': openedIndex !== item.idx
          }"
          :data-index="item.idx"
        >
          <div
            class="prose prose-invert max-w-none pt-2"
            v-html="item.description"
          ></div>
        </div>
      </template>
    </UTimeline>
  </div>
</template>
