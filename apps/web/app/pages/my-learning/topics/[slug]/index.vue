<script setup lang="ts">
import { computed, inject, type Ref } from 'vue'
import EmptyState from '~/components/ui/EmptyState.vue'
import ErrorState from '~/components/ui/ErrorState.vue'
import LoadingSkeleton from '~/components/ui/LoadingSkeleton.vue'
import type { BaseSubTopic } from '~/interfaces/curriculum/subTopics'
import type { TopicDetailResponse } from '~/interfaces/curriculum/topics'
import { buildPathNodes, pathSummary, type PathSubTopic } from '~/lib/learning-path'
import { plainText } from '~/lib/topics'

useHead({ title: 'Jalur belajar | ReduCera' })

const topic = inject('topic') as Ref<TopicDetailResponse<true> | undefined> | undefined
const subTopics = inject('subTopics') as Ref<BaseSubTopic[]> | undefined
const topicStatus = inject('topicStatus') as Ref<'idle' | 'pending' | 'success' | 'error'> | undefined
const loading = computed(() => !topic?.value && (topicStatus?.value === 'pending' || topicStatus?.value === 'idle'))
const failed = computed(() => !topic?.value && !loading.value)

const nodes = computed(() => buildPathNodes((subTopics?.value ?? []) as unknown as PathSubTopic[]))
const summary = computed(() => pathSummary(nodes.value))
const intro = computed(() => plainText(topic?.value?.description, 160))
</script>

<template>
  <div class="rc-stack rc-learning">
    <PageHeader :title="topic?.title ?? 'Jalur belajar'" :subtitle="intro || undefined">
      <template #actions>
        <PlayButton to="/learn/topics" variant="outline" size="sm">Semua topik</PlayButton>
        <PlayButton to="/my-learning/mastery" variant="outline" size="sm">Penguasaan</PlayButton>
      </template>
    </PageHeader>

    <PlayCard v-if="summary.total" as="section" aria-labelledby="path-progress">
      <h2 id="path-progress" class="rc-h2">Kemajuan jalur</h2>
      <PlayProgress :value="summary.percent" :label="`${summary.done} dari ${summary.total} bagian selesai`" tone="success" show-value />
      <p class="rc-hint">{{ summary.done }} dari {{ summary.total }} bagian selesai.</p>
    </PlayCard>

    <section aria-labelledby="path-title">
      <h2 id="path-title" class="rc-h2">Bagian topik</h2>
      <LoadingSkeleton v-if="loading" variant="card" :count="3" />
      <ErrorState v-else-if="failed" title="Topik tidak dapat dimuat" message="Topik ini tidak ditemukan atau gagal dimuat. Coba muat ulang halaman." />
      <LearningPath v-else-if="nodes.length" :nodes="nodes" />
      <EmptyState
        v-else
        icon-name="i-lucide-route"
        title="Belum ada bagian"
        message="Topik ini belum punya bagian belajar. Coba lagi nanti."
        cta-label="Pilih topik lain"
        cta-to="/learn/topics"
      />
    </section>
  </div>
</template>
