<script setup lang="ts">
import { useInfiniteQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import type { BaseCategory } from '~/interfaces/categories';
import { listFromResponse } from '~/lib/topics';
import PlayScroller from '~/components/play/PlayScroller.vue';
import { categoriesService } from '~/services/categories';

const model = defineModel<string | null>({ default: null });

const PAGE_SIZE = 12;

const { data, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = useInfiniteQuery({
  queryKey: ['categories', 'popular'],
  initialPageParam: 1,
  queryFn: ({ pageParam }) => categoriesService.findAll({ page: pageParam, limit: PAGE_SIZE, type: 'popular' }),
  getNextPageParam: (last) => {
    const pagination = last?.data?.pagination;
    if (!pagination || pagination.page === undefined || pagination.totalPages === undefined) return undefined;
    return pagination.page < pagination.totalPages ? pagination.page + 1 : undefined;
  },
  staleTime: 5 * 60 * 1000,
});

const categories = computed(() => {
  const seen = new Set<string>();
  const result: BaseCategory[] = [];
  for (const page of data.value?.pages ?? []) {
    for (const category of listFromResponse<BaseCategory>(page?.data)) {
      if (seen.has(category.id)) continue;
      seen.add(category.id);
      result.push(category);
    }
  }
  return result;
});

const isActive = (name: string | null) => (name ?? '').trim().toLowerCase() === (model.value ?? '').trim().toLowerCase();
</script>

<template>
  <PlayScroller label="Kategori topik" class="rc-cats-scroller">
  <nav class="rc-cats" aria-label="Filter kategori">
    <template v-if="isLoading">
      <span v-for="n in 6" :key="n" class="rc-skel rc-cats__skel" aria-hidden="true"></span>
    </template>

    <template v-else-if="isError">
      <p class="rc-hint">Kategori belum bisa dimuat.</p>
      <button type="button" class="rc-cats__chip" @click="refetch()">Coba lagi</button>
    </template>

    <template v-else>
      <button type="button" class="rc-cats__chip" :aria-pressed="!model" @click="model = null">Semua</button>
      <button
        v-for="category in categories"
        :key="category.id"
        type="button"
        class="rc-cats__chip"
        :aria-pressed="isActive(category.name)"
        @click="model = category.name"
      >
        {{ category.name }}
      </button>
      <button
        v-if="hasNextPage"
        type="button"
        class="rc-cats__chip rc-cats__chip--more"
        :disabled="isFetchingNextPage"
        @click="fetchNextPage()"
      >
        {{ isFetchingNextPage ? 'Memuat…' : 'Muat lagi' }}
      </button>
    </template>
  </nav>
  </PlayScroller>
</template>

<style>
.rc-cats {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.5rem;
  width: max-content;
  min-width: 100%;
  padding: 0.25rem 0.25rem 0.5rem;
}
.rc-cats__chip {
  flex: none;
  min-height: 2.5rem;
  padding: 0.375rem 1rem;
  border: 2px solid var(--rc-border);
  border-radius: 999px;
  background-color: var(--rc-surface);
  color: var(--rc-fg);
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 800;
  cursor: pointer;
}
.rc-cats__chip:hover {
  background-color: var(--rc-foam);
}
.rc-cats__chip[aria-pressed="true"] {
  border-color: var(--rc-primary);
  background-color: color-mix(in srgb, var(--rc-primary) 14%, var(--rc-surface));
  color: var(--rc-primary);
}
.rc-cats__chip:focus-visible {
  outline: 3px solid var(--rc-focus);
  outline-offset: 2px;
}
.rc-cats__chip--more {
  border-style: dashed;
  color: var(--rc-muted);
}
.rc-cats__chip:disabled {
  opacity: 0.6;
  cursor: progress;
}
.rc-cats__skel {
  flex: none;
  width: 6rem;
  height: 2.5rem;
  border-radius: 999px;
}

@media (min-width: 640px) {
  .rc-cats {
    flex-wrap: wrap;
    margin: 0;
    padding: 0;
    overflow: visible;
  }
}
</style>
