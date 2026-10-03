<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import StatCard from '~/components/charts/StatCard.vue';
import ProgressBar from '~/components/charts/ProgressBar.vue';
import { personalizationApi } from '~/lib/api';

const mastery = ref<Array<{ topicId: string; score: number; attempts: number }>>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    mastery.value = (await personalizationApi.listMastery()) as any;
  } catch {
    mastery.value = [];
  } finally {
    loading.value = false;
  }
});

const totalTopics = computed(() => mastery.value.length);
const avgMastery = computed(() => {
  if (mastery.value.length === 0) return 0;
  const sum = mastery.value.reduce((s, m) => s + m.score, 0);
  return Math.round((sum / mastery.value.length) * 100);
});
const mastered = computed(() => mastery.value.filter((m) => m.score >= 0.9).length);
</script>

<template>
  <main class="max-w-5xl mx-auto p-6 space-y-6">
    <h1 class="text-3xl font-bold">Dashboard Belajar Saya</h1>
    <p class="text-[var(--rc-fg-muted,#6b7280)]">Pantau kemajuan penguasaan topik Anda dan rekomendasi aktivitas berikutnya.</p>

    <div v-if="loading" class="text-center py-8">Memuat...</div>

    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard title="Topik Dikerjakan" :value="totalTopics" />
      <StatCard title="Rata-rata Penguasaan" :value="avgMastery" suffix="%" />
      <StatCard title="Topik Dikuasai" :value="mastered" />
    </div>

    <section>
      <h2 class="text-xl font-semibold mb-3">Detail Penguasaan</h2>
      <div v-if="mastery.length === 0" class="text-center py-8 text-[var(--rc-fg-muted,#6b7280)]">Belum ada data penguasaan. Mulai kerjakan kuis untuk melihat progres.</div>
      <div v-else class="space-y-2">
        <ProgressBar
          v-for="m in mastery.slice(0, 20)"
          :key="m.topicId"
          :label="m.topicId"
          :value="Math.round(m.score * 100)"
          suffix="%"
        />
      </div>
    </section>
  </main>
</template>