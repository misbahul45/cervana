<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import BannerTopicSckeleton from '~/components/ui/BannerTopicSckeleton.vue';
import ErrorState from '~/components/ui/ErrorState.vue';
import PlayScroller from '~/components/play/PlayScroller.vue';
import TopicCover from '~/components/topics/TopicCover.vue';
import type { TopicDetailResponse } from '~/interfaces/curriculum/topics';
import { listFromResponse, plainText, priceLabel } from '~/lib/topics';
import { topicsService } from '~/services/curriculum/topics';

const FEATURED_COUNT = 6;
const STALE_MS = 5 * 60 * 1000;

const selected = ref(0);

const { data, isLoading, isError, refetch } = useQuery({
  queryKey: ['topics', 'featured'],
  queryFn: () => topicsService.findAll<true>({ include: 'categories', page: 1, limit: FEATURED_COUNT }),
  staleTime: STALE_MS,
});

const topics = computed(() => listFromResponse<TopicDetailResponse<true>>(data.value?.data));
const featured = computed(() => topics.value[selected.value] ?? topics.value[0]);
const summary = computed(() => plainText(featured.value?.description, 220));
const categories = computed(() => (featured.value?.categories ?? []).slice(0, 4));
</script>

<template>
  <BannerTopicSckeleton v-if="isLoading" />

  <ErrorState v-else-if="isError" title="Topik pilihan belum bisa dimuat" message="Periksa koneksimu lalu coba lagi." @retry="refetch()" />

  <section v-else-if="featured" class="rc-featured" aria-labelledby="featured-list-title">
    <div class="rc-card rc-featured__main">
      <TopicCover :src="featured.image?.url" :title="featured.title" class="rc-featured__cover" />
      <div class="rc-featured__content">
        <h2 class="rc-featured__title">{{ featured.title }}</h2>
        <p v-if="summary" class="rc-featured__summary">{{ summary }}</p>
        <ul v-if="categories.length" class="rc-featured__cats">
          <li v-for="category in categories" :key="category.id" class="rc-chip">{{ category.name }}</li>
        </ul>
        <div class="rc-featured__actions">
          <PlayButton :to="`/learn/topics/${featured.slug}/detail`">Lihat detail</PlayButton>
          <span class="rc-chip" :class="{ 'rc-chip--success': featured.price === 0 }">{{ priceLabel(featured.price) }}</span>
        </div>
      </div>
    </div>

    <div v-if="topics.length > 1" class="rc-featured__list">
      <h2 id="featured-list-title" class="rc-featured__list-title">Topik pilihan</h2>
      <PlayScroller label="Daftar topik pilihan" class="rc-scroller--wide-off">
      <ul class="rc-featured__items">
        <li v-for="(topic, index) in topics" :key="topic.id">
          <button
            type="button"
            class="rc-featured__item"
            :aria-pressed="index === selected"
            @click="selected = index"
          >
            <TopicCover :src="topic.image?.url" :title="topic.title" class="rc-featured__thumb" />
            <span class="rc-featured__item-title">{{ topic.title }}</span>
          </button>
        </li>
      </ul>
      </PlayScroller>
    </div>
  </section>
</template>

<style>
.rc-featured {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
}
.rc-card.rc-featured__main {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-width: 0;
  padding: 0;
  overflow: hidden;
}
.rc-featured__cover {
  --cover-ratio: 16 / 9;
  border-bottom: 2px solid var(--rc-border);
}
.rc-featured__content {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  min-width: 0;
  padding: 1.25rem;
}
.rc-featured__title {
  margin: 0;
  font-size: clamp(1.375rem, 4vw, 1.875rem);
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.rc-featured__summary {
  margin: 0;
  color: var(--rc-muted);
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.rc-featured__cats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.rc-featured__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-top: auto;
}
.rc-featured__list {
  display: grid;
  gap: 0.75rem;
  min-width: 0;
  align-content: start;
}
.rc-featured__list-title {
  margin: 0;
  font-size: 1.125rem;
}
.rc-featured__items {
  display: flex;
  gap: 0.75rem;
  margin: 0;
  padding: 0.25rem 0.25rem 0.5rem;
  width: max-content;
  min-width: 100%;
  list-style: none;
}
.rc-featured__items > li {
  flex: 0 0 11rem;
  scroll-snap-align: start;
}
.rc-featured__item {
  display: grid;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem;
  border: 2px solid var(--rc-border);
  border-radius: var(--rc-radius, 16px);
  background-color: var(--rc-surface);
  color: var(--rc-fg);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.rc-featured__item:hover {
  background-color: var(--rc-foam);
}
.rc-featured__item[aria-pressed="true"] {
  border-color: var(--rc-primary);
  box-shadow: 0 var(--rc-depth, 4px) 0 0 var(--rc-primary-depth);
}
.rc-featured__item:focus-visible {
  outline: 3px solid var(--rc-focus);
  outline-offset: 3px;
}
.rc-featured__thumb {
  --cover-ratio: 16 / 10;
  border-radius: calc(var(--rc-radius, 16px) - 6px);
}
.rc-featured__item-title {
  font-size: 0.875rem;
  font-weight: 800;
  line-height: 1.25;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.rc-featured--loading .rc-featured__skel-cover {
  aspect-ratio: 16 / 9;
  border-radius: 0;
}
.rc-featured--loading .rc-featured__skel-items {
  display: flex;
  gap: 0.75rem;
  overflow: hidden;
}
.rc-featured--loading .rc-featured__skel-item {
  flex: 0 0 min(11rem, 60%);
  aspect-ratio: 16 / 12;
}

@media (min-width: 768px) {
  .rc-card.rc-featured__main {
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
  }
  .rc-featured__cover {
    --cover-ratio: auto;
    height: 100%;
    min-height: 16rem;
    border-right: 2px solid var(--rc-border);
    border-bottom: 0;
  }
  .rc-featured__content {
    padding: 1.75rem;
  }
}

@media (min-width: 1280px) {
  .rc-featured {
    grid-template-columns: minmax(0, 1fr) 17rem;
  }
  .rc-featured__items {
    display: grid;
    width: auto;
    max-height: 22rem;
    padding: 0.25rem 0.25rem 0.75rem 0.25rem;
    overflow-x: hidden;
    overflow-y: auto;
  }
  .rc-featured__items > li {
    flex: initial;
  }
  .rc-featured__item {
    grid-template-columns: 5.5rem minmax(0, 1fr);
    align-items: center;
  }
}
</style>
