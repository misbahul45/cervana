<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import StatCard from '~/components/charts/StatCard.vue';

const events = ref<Array<{ id: string; action: string; createdAt: string; metadata?: any }>>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const raw = localStorage.getItem('recent-events');
    if (raw) events.value = JSON.parse(raw);
  } catch {
    events.value = [];
  } finally {
    loading.value = false;
  }
});

const grouped = computed(() => {
  const byDay: Record<string, typeof events.value> = {};
  for (const e of events.value) {
    const d = new Date(e.createdAt).toLocaleDateString('id-ID');
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(e);
  }
  return byDay;
});
</script>

<template>
  <main class="max-w-3xl mx-auto p-6 space-y-4">
    <h1 class="text-3xl font-bold">Pemberitahuan</h1>
    <p class="text-[var(--rc-fg-muted,#6b7280)]">Aktivitas terbaru dari sistem dan kreator Anda.</p>

    <div v-if="loading" class="text-center py-8">Memuat...</div>

    <div v-else-if="Object.keys(grouped).length === 0" class="text-center py-8 text-[var(--rc-fg-muted,#6b7280)]">
      Tidak ada pemberitahuan
    </div>

    <div v-else class="space-y-4">
      <div v-for="(items, day) in grouped" :key="day">
        <h3 class="text-xs text-[var(--rc-fg-muted,#6b7280)] uppercase tracking-wide">{{ day }}</h3>
        <ul class="space-y-1">
          <li v-for="e in items" :key="e.id" class="bg-[var(--rc-bg-elevated,#f3f4f6)] rounded px-3 py-2 text-sm">
            <strong class="text-xs">{{ e.action }}</strong>
            <p v-if="e.metadata && Object.keys(e.metadata).length" class="text-xs text-[var(--rc-fg-muted,#6b7280)] truncate">{{ JSON.stringify(e.metadata) }}</p>
          </li>
        </ul>
      </div>
    </div>
  </main>
</template>