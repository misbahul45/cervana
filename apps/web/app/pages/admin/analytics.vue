<script setup lang="ts">
import { analyticsApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';

definePageMeta({
  title: 'Analitik Admin — ReduCera',
  protection: { kind: 'role', role: 'ADMIN' },
});

useHead({ title: 'Analitik Admin — ReduCera' });

const { data, status, error, refresh } = useAsyncData(
  'admin:analytics',
  async () => {
    const [overview, topTopics] = await Promise.all([analyticsApi.adminOverview(), analyticsApi.topTopics()]);
    return { overview, topTopics };
  },
  { lazy: true },
);
</script>

<template>
  <main>
    <h1>Analitik Admin</h1>
    <LoadingSkeleton v-if="status === 'pending'" variant="panel" :count="2" />
    <ErrorState
      v-else-if="error || !data"
      title="Gagal memuat analitik"
      :message="describeApiError(error)"
      @retry="refresh()"
    />
    <template v-else>
    <section v-if="data.overview">
      <h2>Ringkasan</h2>
      <ul>
        <li>Total pengguna: {{ data.overview.totalUsers }}</li>
        <li>Total kreator (approved): {{ data.overview.totalCreators }}</li>
        <li>Total konten: {{ data.overview.totalContent }}</li>
        <li>Total agent decisions: {{ data.overview.totalAgentDecisions }}</li>
      </ul>

      <h2>Engagement Terbaru</h2>
      <ul>
        <li v-for="e in data.overview.recentEngagement" :key="e.id">
          {{ e.cohortId }} · {{ e.window }} · uniqueUsers={{ e.uniqueUsers }} · totalEvents={{ e.totalEvents }}
        </li>
      </ul>
    </section>

    <section>
      <h2>Top Topik (mastery)</h2>
      <ul>
        <li v-for="t in data.topTopics" :key="t.topicId">
          {{ t.topicId }} — {{ t.learners }} learners — avg {{ t.avgScore.toFixed(2) }}
        </li>
      </ul>
    </section>
    </template>
  </main>
</template>