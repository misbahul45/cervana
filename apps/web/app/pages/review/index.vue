<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { QK } from '~/lib/query-keys';

definePageMeta({
  title: 'Antrian Tinjauan — ReduCera',
  protection: { kind: 'capability', capability: 'REVIEWER' },
  layout: 'studio',
});

const { data: items, isLoading, error } = useQuery({
  queryKey: QK.review.queue(),
  queryFn: async () => ([
    { id: 'r-1', title: 'Normal Balance', creator: 'Andi P.', submittedAt: '2026-10-04', status: 'PENDING_REVIEW' as const },
    { id: 'r-2', title: 'Adjusting Entries', creator: 'Sinta W.', submittedAt: '2026-10-03', status: 'PENDING_REVIEW' as const },
  ]),
  staleTime: 30_000,
});
</script>

<template>
  <main id="main" aria-labelledby="review-h">
    <PreviewNotice />
    <h1 id="review-h">Antrian Tinjauan</h1>

    <LoadingSkeleton v-if="isLoading" variant="row" :count="3" />
    <ErrorState v-else-if="error" title="Gagal memuat antrian tinjauan" />
    <EmptyState
      v-else-if="!items || items.length === 0"
      title="Antrian kosong"
      message="Tidak ada kiriman yang menunggu tinjauan saat ini."
    />
    <ul v-else class="rc-review__list">
      <li v-for="it in items" :key="it.id" class="rc-review__item">
        <div>
          <h2>{{ it.title }}</h2>
          <p>oleh {{ it.creator }} · {{ it.submittedAt }}</p>
        </div>
        <div class="rc-review__actions">
          <NuxtLink :to="`/review/${it.id}`">Tinjau</NuxtLink>
        </div>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.rc-review__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}
.rc-review__item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.875rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  background: var(--ui-bg, white);
}
.rc-review__item h2 { font-size: 1rem; font-weight: 600; }
.rc-review__item p { font-size: 0.75rem; color: var(--ui-text-muted); }
.rc-review__actions a {
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
  background: var(--ui-bg, white);
  color: var(--ui-text);
  text-decoration: none;
}
</style>