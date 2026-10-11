<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import PlayCard from '~/components/play/PlayCard.vue';
import ErrorState from '~/components/ui/ErrorState.vue';
import LoadingSkeleton from '~/components/ui/LoadingSkeleton.vue';
import { earningsApi, studioArticlesApi, studioClassesApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { formatAmount } from '~/lib/format';
import { contentCounts, nextStep, sumCounts } from '~/lib/studio';

definePageMeta({
  title: 'Studio — ReduCera',
  protection: { kind: 'tenant-role', tenantRoles: ['OWNER', 'MANAGER', 'TEACHER', 'EDITOR'] },
  layout: 'studio',
});

useHead({ title: 'Studio — ReduCera' });

const { data, status, error, refresh } = useAsyncData(
  'studio:home',
  async () => {
    const [articles, classes, earnings] = await Promise.all([
      studioArticlesApi.list(),
      studioClassesApi.list(),
      earningsApi.me().catch(() => null),
    ]);
    const counts = sumCounts(contentCounts(articles), contentCounts(classes));
    return { counts, earnings, step: nextStep(counts) };
  },
  { lazy: true },
);
</script>

<template>
  <div class="rc-stack">
    <PageHeader title="Studio" subtitle="Tulis, kirim untuk ditinjau, lalu pantau hasilnya.">
      <template #actions>
        <PlayButton to="/studio/articles/new" size="sm">Artikel baru</PlayButton>
        <PlayButton to="/studio/classes/new" variant="secondary" size="sm">Kelas baru</PlayButton>
      </template>
    </PageHeader>

    <LoadingSkeleton v-if="status === 'pending' && !data" variant="panel" :count="2" />
    <ErrorState v-else-if="error && !data" title="Studio gagal dimuat" :message="describeApiError(error)" @retry="refresh()" />

    <template v-else-if="data">
      <ul class="rc-studio-stats" aria-label="Ringkasan karya">
        <li class="rc-card"><span class="rc-hint">Draf</span><strong>{{ data.counts.draft }}</strong></li>
        <li class="rc-card"><span class="rc-hint">Menunggu tinjauan</span><strong>{{ data.counts.pending }}</strong></li>
        <li class="rc-card"><span class="rc-hint">Terbit</span><strong>{{ data.counts.published }}</strong></li>
        <li class="rc-card"><span class="rc-hint">Ditolak</span><strong>{{ data.counts.rejected }}</strong></li>
        <li v-if="data.earnings" class="rc-card">
          <span class="rc-hint">Pendapatan dirilis</span>
          <strong>{{ formatAmount(data.earnings.available, data.earnings.currency) }}</strong>
        </li>
      </ul>

      <PlayCard tone="soft" as="section" aria-labelledby="studio-next">
        <h2 id="studio-next" class="rc-h2">Langkah berikutnya</h2>
        <p>{{ data.step.message }}</p>
        <div class="rc-actions">
          <PlayButton :to="data.step.to">{{ data.step.label }}</PlayButton>
        </div>
      </PlayCard>
    </template>
  </div>
</template>
