<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { QK } from '~/lib/query-keys';

definePageMeta({
  title: 'Studio — ReduCera',
  protection: { kind: 'tenant-role', tenantRoles: ['OWNER', 'MANAGER', 'TEACHER', 'EDITOR'] },
  layout: 'studio',
});

const { data: studio } = useQuery({
  queryKey: QK.creator.studio(),
  queryFn: async () => ({
    draftCount: 3,
    publishedCount: 5,
    pendingReviewCount: 2,
    earnings: { monthToDate: 1_250_000, currency: 'IDR' },
    nextAction: 'Selesaikan tinjauan untuk "Normal Balance" agar dapat dipublikasikan.',
  }),
  staleTime: 60_000,
});
</script>

<template>
  <main id="main" aria-labelledby="studio-h">
    <PreviewNotice />
    <h1 id="studio-h">Studio</h1>

    <LoadingSkeleton v-if="!studio" variant="panel" :count="2" />
    <template v-else>
      <section class="rc-studio__metrics">
        <article>
          <h2>Draf</h2>
          <p>{{ studio.draftCount }}</p>
        </article>
        <article>
          <h2>Terbit</h2>
          <p>{{ studio.publishedCount }}</p>
        </article>
        <article>
          <h2>Menunggu tinjauan</h2>
          <p>{{ studio.pendingReviewCount }}</p>
        </article>
        <article>
          <h2>Pendapatan bulan ini</h2>
          <p>Rp {{ studio.earnings.monthToDate.toLocaleString('id-ID') }}</p>
        </article>
      </section>

      <section class="rc-studio__next" aria-label="Aksi berikutnya">
        <h2>Aksi berikutnya</h2>
        <p>{{ studio.nextAction }}</p>
        <div class="rc-studio__quick">
          <NuxtLink to="/studio/articles">Buka daftar artikel</NuxtLink>
          <NuxtLink to="/studio/earnings">Lihat pendapatan</NuxtLink>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.rc-studio__metrics {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  margin-bottom: 1.5rem;
}
.rc-studio__metrics article {
  padding: 1rem;
  border-radius: 0.75rem;
  background: var(--ui-bg, white);
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
}
.rc-studio__metrics h2 {
  font-size: 0.75rem;
  color: var(--ui-text-muted);
  text-transform: uppercase;
}
.rc-studio__metrics p { font-size: 1.5rem; font-weight: 700; }
.rc-studio__next {
  padding: 1rem;
  border-radius: 0.75rem;
  background: var(--ui-bg-elevated, transparent);
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
}
.rc-studio__quick { display: flex; gap: 0.75rem; margin-top: 0.5rem; }
</style>