<script setup lang="ts">
import { analyticsApi } from '~/lib/api';

const [overview, topTopics] = await Promise.all([
  analyticsApi.adminOverview().catch(() => null),
  analyticsApi.topTopics().catch(() => [] as any[]),
]);

useHead({ title: 'Analitik Admin — ReduCera' });
</script>

<template>
  <main>
    <h1>Analitik Admin</h1>
    <section v-if="overview">
      <h2>Ringkasan</h2>
      <ul>
        <li>Total pengguna: {{ overview.totalUsers }}</li>
        <li>Total kreator (approved): {{ overview.totalCreators }}</li>
        <li>Total konten: {{ overview.totalContent }}</li>
        <li>Total agent decisions: {{ overview.totalAgentDecisions }}</li>
      </ul>

      <h2>Engagement Terbaru</h2>
      <ul>
        <li v-for="e in overview.recentEngagement" :key="e.id">
          {{ e.cohortId }} · {{ e.window }} · uniqueUsers={{ e.uniqueUsers }} · totalEvents={{ e.totalEvents }}
        </li>
      </ul>
    </section>

    <section>
      <h2>Top Topik (mastery)</h2>
      <ul>
        <li v-for="t in topTopics" :key="t.topicId">
          {{ t.topicId }} — {{ t.learners }} learners — avg {{ t.avgScore.toFixed(2) }}
        </li>
      </ul>
    </section>
  </main>
</template>