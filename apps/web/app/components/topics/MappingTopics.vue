<script setup lang="ts">
import { useInfiniteQuery } from '@tanstack/vue-query';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import TopicCard from '~/components/topics/TopicCard.vue';
import EmptyState from '~/components/ui/EmptyState.vue';
import ErrorState from '~/components/ui/ErrorState.vue';
import type { TopicDetailResponse } from '~/interfaces/curriculum/topics';
import { filterByCategory, listFromResponse } from '~/lib/topics';
import { topicsService } from '~/services/curriculum/topics';

const props = withDefaults(defineProps<{ category?: string | null; heading?: string; exclude?: string }>(), {
  category: null,
  heading: 'Semua topik',
  exclude: undefined,
});

const route = useRoute();
const limit = Number(route.query.limit) > 0 ? Number(route.query.limit) : 12;
const SKELETON_COUNT = 6;

const { data, fetchNextPage, isFetchingNextPage, hasNextPage, isLoading, isError, refetch } = useInfiniteQuery({
  queryKey: ['topics', 'list', limit],
  initialPageParam: 1,
  queryFn: ({ pageParam }) => topicsService.findAll<true>({ include: 'categories', page: pageParam, limit }),
  getNextPageParam: (last) => {
    const pagination = last?.data?.pagination;
    if (!pagination || pagination.page === undefined || pagination.totalPages === undefined) return undefined;
    return pagination.page < pagination.totalPages ? pagination.page + 1 : undefined;
  },
});

const allTopics = computed(() => {
  const seen = new Set<string>();
  const result: TopicDetailResponse<true>[] = [];
  for (const page of data.value?.pages ?? []) {
    for (const topic of listFromResponse<TopicDetailResponse<true>>(page?.data)) {
      if (seen.has(topic.id)) continue;
      seen.add(topic.id);
      result.push(topic);
    }
  }
  return result;
});

const topics = computed(() =>
  filterByCategory(allTopics.value, props.category).filter((topic) => topic.id !== props.exclude),
);

const loadMore = () => {
  if (hasNextPage.value && !isFetchingNextPage.value) fetchNextPage();
};

watch([topics, hasNextPage, isFetchingNextPage], () => {
  if (props.category && topics.value.length === 0) loadMore();
});

const sentinel = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    },
    { rootMargin: '400px 0px' },
  );
  if (sentinel.value) observer.observe(sentinel.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});
</script>

<template>
  <section class="rc-topics" aria-labelledby="topics-heading">
    <h2 id="topics-heading" class="rc-topics__heading">{{ category ? category : heading }}</h2>

    <div v-if="isLoading" class="rc-topics__grid" aria-hidden="true">
      <div v-for="n in SKELETON_COUNT" :key="n" class="rc-card rc-topics__skel">
        <div class="rc-skel rc-topics__skel-cover"></div>
        <div class="rc-topics__skel-body">
          <div class="rc-skel rc-skel--line rc-skel--w80"></div>
          <div class="rc-skel rc-skel--line rc-skel--w60"></div>
          <div class="rc-skel rc-skel--button"></div>
        </div>
      </div>
    </div>

    <ErrorState v-else-if="isError && !topics.length" title="Topik belum bisa dimuat" message="Periksa koneksimu lalu coba lagi." @retry="refetch()" />

    <EmptyState
      v-else-if="!topics.length && !hasNextPage"
      icon-name="i-lucide-book-open"
      :title="category ? `Belum ada topik ${category}` : 'Belum ada topik'"
      :message="category ? 'Coba kategori lain atau lihat semua topik.' : 'Topik akan muncul di sini begitu tersedia.'"
    />

    <ul v-else class="rc-topics__grid">
      <li v-for="topic in topics" :key="topic.id" class="rc-topics__cell">
        <TopicCard :topic="topic" />
      </li>
    </ul>

    <div ref="sentinel" class="rc-topics__sentinel" aria-hidden="true"></div>

    <div v-if="hasNextPage && topics.length" class="rc-topics__more">
      <PlayButton variant="outline" :loading="isFetchingNextPage" @click="loadMore">Muat lebih banyak</PlayButton>
    </div>
  </section>
</template>

<style>
.rc-topics {
  display: grid;
  gap: 1rem;
  min-width: 0;
}
.rc-topics__heading {
  margin: 0;
  font-size: 1.375rem;
}
.rc-topics__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.rc-topics__cell {
  min-width: 0;
}
.rc-topics__skel {
  display: grid;
  padding: 0;
  overflow: hidden;
}
.rc-topics__skel-cover {
  aspect-ratio: 16 / 10;
  border-radius: 0;
}
.rc-topics__skel-body {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
}
.rc-topics__sentinel {
  height: 1px;
}
.rc-topics__more {
  display: flex;
  justify-content: center;
}
</style>
