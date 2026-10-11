<script setup lang="ts">
import PlayCard from '~/components/play/PlayCard.vue';
import { analyticsApi } from '~/lib/api';

const { data, status, error, refresh } = useAsyncData(
  'admin:analytics',
  async () => {
    const [overview, topConcepts] = await Promise.all([analyticsApi.adminOverview(), analyticsApi.topConcepts()]);
    return { overview, topConcepts };
  },
  { lazy: true },
);

const totals = computed(() => {
  const overview = data.value?.overview;
  if (!overview) return [];
  return [
    { label: 'Pengguna', value: overview.totalUsers },
    { label: 'Kreator disetujui', value: overview.totalCreators },
    { label: 'Konten terbit', value: overview.totalContent },
    { label: 'Keputusan agen', value: overview.totalAgentDecisions },
  ];
});
</script>

<template>
  <AdminState :status="status" :error="error" error-title="Analitik gagal dimuat" :skeleton="4" @retry="refresh()">
    <section class="rc-stack" aria-labelledby="totals-h">
      <h2 id="totals-h" class="rc-h2">Ringkasan</h2>
      <div class="rc-statgrid">
        <PlayCard v-for="item in totals" :key="item.label">
          <div class="rc-statcard">
            <span class="rc-statcard__value">{{ item.value }}</span>
            <span class="rc-statcard__label">{{ item.label }}</span>
          </div>
        </PlayCard>
      </div>
    </section>

    <section class="rc-stack" aria-labelledby="engagement-h">
      <h2 id="engagement-h" class="rc-h2">Keterlibatan terbaru</h2>
      <p v-if="!data?.overview?.recentEngagement?.length" class="rc-hint">Belum ada rekap keterlibatan.</p>
      <div v-else class="rc-table-wrap">
        <table class="rc-table">
          <caption>Rekap keterlibatan terbaru</caption>
          <thead>
            <tr>
              <th scope="col">Kohort</th>
              <th scope="col">Periode</th>
              <th scope="col" class="rc-table__num">Pengguna unik</th>
              <th scope="col" class="rc-table__num">Total kejadian</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.overview.recentEngagement" :key="row.id">
              <td>{{ row.cohortId }}</td>
              <td>{{ row.window }}</td>
              <td class="rc-table__num">{{ row.uniqueUsers }}</td>
              <td class="rc-table__num">{{ row.totalEvents }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="rc-stack" aria-labelledby="concepts-h">
      <h2 id="concepts-h" class="rc-h2">Konsep dengan penguasaan tertinggi</h2>
      <p v-if="!data?.topConcepts?.length" class="rc-hint">Belum ada data penguasaan konsep.</p>
      <div v-else class="rc-table-wrap">
        <table class="rc-table">
          <caption>Konsep teratas</caption>
          <thead>
            <tr>
              <th scope="col">Konsep</th>
              <th scope="col" class="rc-table__num">Pelajar</th>
              <th scope="col" class="rc-table__num">Rata-rata skor</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="concept in data.topConcepts" :key="concept.conceptId">
              <td>{{ concept.title }}</td>
              <td class="rc-table__num">{{ concept.learners }}</td>
              <td class="rc-table__num">{{ concept.avgScore.toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </AdminState>
</template>
