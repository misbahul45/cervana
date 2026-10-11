<script setup lang="ts">
import { computed } from 'vue'
import type { ApiResponse } from '~/interfaces/api'
import type { SubTopicsListResponse } from '~/interfaces/curriculum/subTopics'
import { plainText } from '~/lib/topics'
import { subTopicsService } from '~/services/curriculum/subTopics'

const { topicId } = defineProps<{ topicId?: string }>()

const { data: resSubTopic } = await useAsyncData<ApiResponse<SubTopicsListResponse<true>>>(
  `subTopic-${topicId}`,
  async () => subTopicsService.findAll({ page: 1, limit: 100, topicId }),
)

const items = computed(() =>
  [...(resSubTopic.value?.data?.data ?? [])]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((subTopic) => ({
      id: subTopic.id,
      title: subTopic.title,
      summary: plainText(subTopic.description, 140),
    })),
)
</script>

<template>
  <section class="rc-card" aria-labelledby="detail-contents">
    <h2 id="detail-contents" class="rc-h2">Isi topik</h2>
    <ol v-if="items.length" class="rc-contents">
      <li v-for="(item, index) in items" :key="item.id" class="rc-contents__item">
        <span class="rc-contents__num" aria-hidden="true">{{ index + 1 }}</span>
        <div class="rc-contents__text">
          <h3 class="rc-contents__title">{{ item.title }}</h3>
          <p v-if="item.summary" class="rc-hint">{{ item.summary }}</p>
        </div>
      </li>
    </ol>
    <p v-else class="rc-hint">Bagian belajar belum ditambahkan.</p>
  </section>
</template>

<style>
.rc-contents {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.rc-contents__item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}
.rc-contents__num {
  display: grid;
  flex: none;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--rc-border);
  border-radius: 999px;
  color: var(--rc-muted);
  font-size: 0.875rem;
  font-weight: 800;
}
.rc-contents__text {
  min-width: 0;
}
.rc-contents__title {
  margin: 0;
  font-size: 1rem;
  overflow-wrap: anywhere;
}
</style>
