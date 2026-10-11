<script setup lang="ts">
import { computed } from 'vue'
import type { ApiResponse } from '~/interfaces/api'
import type { User } from '~/interfaces/auth'
import type { TopicDetailResponse } from '~/interfaces/curriculum/topics'
import { topicsService } from '~/services/curriculum/topics'
import MappingTopics from '~/components/topics/MappingTopics.vue'
import TopicCover from '~/components/topics/TopicCover.vue'
import { useHydrated } from '~/composables/useHydrated'
import { useTopicUnlock } from '~/composables/useTopicUnlock'
import { plainText, priceLabel } from '~/lib/topics'

const route = useRoute()

const { data: resTopic } = await useAsyncData<ApiResponse<TopicDetailResponse<true>>>(
  `topic-${route.params.identifier}`,
  async () => topicsService.findOne(route.params.identifier as string, {})
)

const topic = computed(() => resTopic.value?.data)

const { hasAccess, open, pending } = useTopicUnlock()
const hydrated = useHydrated()

const owned = computed(() => hydrated.value && (topic.value ? hasAccess(topic.value.id) : false))
const free = computed(() => topic.value?.price === 0)
const actionLabel = computed(() => (owned.value ? 'Belajar' : free.value ? 'Mulai gratis' : 'Beli topik'))
const intro = computed(() => plainText(topic.value?.description))
const teacherName = computed(() => topic.value?.teacher?.name?.trim() || 'Tanpa nama')
const categories = computed(() => topic.value?.categories ?? [])

const siteUrl = useRuntimeConfig().public.SITE_URL

useHead(() => ({
  title: topic.value?.title
    ? `${topic.value.title} | Detail Topik Penguasaan | ReduCera`
    : 'Detail Topik Penguasaan | ReduCera',
  meta: [
    {
      name: 'description',
      content:
        intro.value ||
        'Pelajari topik penguasaan akuntansi berbasis AI dan gamifikasi. Tingkatkan kompetensi akuntansi perguruan tinggi sesuai standar akuntansi dan akuntansi.',
    },
    {
      name: 'keywords',
      content:
        'ReduCera, topik penguasaan, akuntansi perguruan tinggi, pembelajaran AI, gamifikasi, microlearning, penguasaan akuntansi, akuntansi',
    },
    { property: 'og:type', content: 'article' },
    { property: 'og:url', content: `${siteUrl}${route.fullPath}` },
    {
      property: 'og:title',
      content:
        topic.value?.title
          ? `${topic.value.title} | ReduCera`
          : 'Detail Topik Penguasaan | ReduCera',
    },
    {
      property: 'og:description',
      content:
        intro.value ||
        'Temukan materi pembelajaran dan penguasaan akuntansi berbasis AI & gamifikasi di platform ReduCera.',
    },
    { property: 'og:image', content: topic.value?.image?.url || '/meta/og-detail.png' },
    { name: 'twitter:card', content: 'summary_large_image' },
    {
      name: 'twitter:title',
      content: topic.value?.title || 'Detail Topik Penguasaan | ReduCera',
    },
    {
      name: 'twitter:description',
      content:
        intro.value ||
        'Pelajari topik pembelajaran akuntansi untuk persiapan penguasaan akuntansi dengan pendekatan AI dan gamifikasi.',
    },
    { name: 'twitter:image', content: topic.value?.image?.url || '/meta/og-detail.png' },
  ],
}))

</script>

<template>
  <div class="rc-stack rc-detail">
    <section class="rc-card rc-detail__hero" aria-labelledby="detail-title">
      <TopicCover :src="topic?.image?.url" :title="topic?.title ?? 'Topik'" class="rc-detail__cover" />
      <div class="rc-detail__head">
        <h1 id="detail-title" class="rc-detail__title">{{ topic?.title }}</h1>
        <p class="rc-hint">Pengajar: {{ teacherName }}</p>
        <ul v-if="categories.length" class="rc-detail__cats">
          <li v-for="category in categories" :key="category.id" class="rc-chip">{{ category.name }}</li>
        </ul>
      </div>
    </section>

    <div class="rc-detail__grid">
      <div class="rc-detail__main">
        <section class="rc-card" aria-labelledby="detail-about">
          <h2 id="detail-about" class="rc-h2">Tentang topik</h2>
          <p v-if="intro" class="rc-detail__about">{{ intro }}</p>
          <p v-else class="rc-hint">Deskripsi belum ditambahkan.</p>
        </section>
        <TopicsDetailMappingSubTopics :topic-id="topic?.id" />
      </div>

      <aside class="rc-card rc-detail__buy" aria-labelledby="detail-action">
        <h2 id="detail-action" class="rc-h2">Mulai belajar</h2>
        <p class="rc-detail__price">{{ priceLabel(topic?.price) }}</p>
        <PlayButton v-if="topic" block size="lg" :variant="owned ? 'secondary' : 'primary'" :loading="pending" @click="open(topic)">
          {{ actionLabel }}
        </PlayButton>
        <PlayButton to="/learn/topics" variant="outline" block>Lihat topik lain</PlayButton>
      </aside>
    </div>

    <MappingTopics heading="Topik lainnya" :exclude="topic?.id" />
  </div>
</template>

<style>
.rc-detail {
  --rc-stack-gap: 1.5rem;
}
.rc-card.rc-detail__hero {
  display: grid;
  padding: 0;
  overflow: hidden;
}
.rc-detail__cover {
  --cover-ratio: 21 / 9;
  border-bottom: 2px solid var(--rc-border);
}
.rc-detail__head {
  display: grid;
  gap: 0.5rem;
  padding: 1.25rem;
}
.rc-detail__title {
  margin: 0;
  font-size: clamp(1.5rem, 4vw, 2.25rem);
  overflow-wrap: anywhere;
}
.rc-detail__cats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.rc-detail__grid {
  display: grid;
  gap: 1rem;
  align-items: start;
}
.rc-detail__main {
  display: grid;
  gap: 1rem;
  min-width: 0;
}
.rc-detail__about {
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-line;
}
.rc-card.rc-detail__buy {
  display: grid;
  gap: 0.75rem;
}
.rc-detail__price {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 900;
}

@media (min-width: 64rem) {
  .rc-detail__grid {
    grid-template-columns: minmax(0, 1fr) 20rem;
  }
  .rc-detail__buy {
    position: sticky;
    top: 5rem;
  }
}
</style>
