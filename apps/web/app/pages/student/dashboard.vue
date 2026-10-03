<script setup lang="ts">
import { ref, onMounted } from 'vue';
import StatCard from '~/components/charts/StatCard.vue';
import ProgressBar from '~/components/charts/ProgressBar.vue';
import { personalizationApi } from '~/lib/api';

const mastery = ref<Array<{ topicId: string; score: number; attempts: number }>>([]);
const recentEvents = ref<Array<{ id: string; action: string; createdAt: string }>>([]);

onMounted(async () => {
  try {
    mastery.value = (await personalizationApi.listMastery()) as Array<{ topicId: string; score: number; attempts: number }>;
  } catch {
    mastery.value = [];
  }
  try {
    recentEvents.value = (await personalizationApi.listMyEvents()) as Array<{ id: string; action: string; createdAt: string }>;
  } catch {
    recentEvents.value = [];
  }
});

const avgMastery = () => {
  if (mastery.value.length === 0) return 0;
  const sum = mastery.value.reduce((s, m) => s + m.score, 0);
  return Math.round((sum / mastery.value.length) * 100);
};
</script>

<template>
  <main class="max-w-6xl mx-auto p-6 space-y-6">
    <h1 class="text-3xl font-bold">Selamat Datang kembali</h1>
    <p class="text-[var(--rc-fg-muted,#6b7280)]">Lanjutkan perjalanan belajar Anda. Berikut ringkasan kemampuan Anda saat ini.</p>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard title="Topik Dipelajari" :value="mastery.length" />
      <StatCard title="Rata-rata Mastery" :value="avgMastery()" suffix="%" :color="avgMastery() >= 70 ? 'var(--rc-success,#16a34a)' : 'var(--rc-primary,#3b82f6)'" />
      <StatCard title="Aktivitas Bulan Ini" :value="recentEvents.length" />
    </div>

    <section>
      <h2 class="text-xl font-semibold mb-3">Topik Aktif</h2>
      <div v-if="mastery.length === 0" class="bg-[var(--rc-bg-elevated,#f3f4f6)] rounded p-6 text-center text-[var(--rc-fg-muted,#6b7280)]">
        Belum ada topik dipelajari. <NuxtLink to="/learn" class="text-[var(--rc-primary,#3b82f6)]">Mulai sekarang</NuxtLink>
      </div>
      <div v-else class="space-y-3">
        <div v-for="m in mastery" :key="m.topicId" class="bg-[var(--rc-bg,#fff)] rounded p-3 border border-[var(--rc-border)]">
          <div class="flex justify-between items-center mb-1">
            <strong class="text-sm">{{ m.topicId }}</strong>
            <span class="text-xs text-[var(--rc-fg-muted,#6b7280)]">{{ m.attempts }} percobaan</span>
          </div>
          <ProgressBar :value="m.score * 100" :max="100" :color="m.score >= 0.85 ? 'var(--rc-success,#16a34a)' : m.score >= 0.5 ? 'var(--rc-primary,#3b82f6)' : 'var(--rc-warning,#f59e0b)'" />
        </div>
      </div>
    </section>

    <section>
      <h2 class="text-xl font-semibold mb-3">Aktivitas Terbaru</h2>
      <ul v-if="recentEvents.length" class="bg-[var(--rc-bg,#fff)] rounded border border-[var(--rc-border)] divide-y divide-[var(--rc-border)]">
        <li v-for="e in recentEvents" :key="e.id" class="px-4 py-2 text-sm flex justify-between">
          <span>{{ e.action }}</span>
          <time class="text-[var(--rc-fg-muted,#6b7280)]">{{ new Date(e.createdAt).toLocaleString() }}</time>
        </li>
      </ul>
      <p v-else class="text-[var(--rc-fg-muted,#6b7280)] text-sm">Belum ada aktivitas.</p>
    </section>
  </main>
</template>