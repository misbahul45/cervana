<script setup lang="ts">
import { ref, onMounted } from 'vue';
import StatCard from '~/components/charts/StatCard.vue';

const users = ref(0);
const articles = ref(0);
const classes = ref(0);
const decisionTraces = ref(0);
const loading = ref(true);

async function load() {
  try {
    const res = await fetch('http://localhost:3002/api/v1/admin/backup', {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    });
    const json = await res.json();
    decisionTraces.value = json?.data?.length || 0;
  } catch {
    decisionTraces.value = 0;
  }
  loading.value = false;
}

onMounted(async () => {
  await load();
});
</script>

<template>
  <main class="max-w-6xl mx-auto p-6 space-y-6">
    <h1 class="text-3xl font-bold">Dashboard Admin</h1>
    <p class="text-[var(--rc-fg-muted,#6b7280)]">Ringkasan operasional sistem dan kendali utama.</p>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatCard title="Pengguna" :value="users" />
      <StatCard title="Artikel" :value="articles" />
      <StatCard title="Kelas" :value="classes" />
      <StatCard title="Agent Decisions (90d)" :value="decisionTraces" />
    </div>

    <section>
      <h2 class="text-xl font-semibold mb-3">Kelola Sistem</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NuxtLink to="/admin/moderation" class="bg-[var(--rc-bg,#fff)] rounded-lg p-6 border border-[var(--rc-border)]">
          <h3 class="font-semibold">🛡️ Antrian Moderasi</h3>
          <p class="text-sm text-[var(--rc-fg-muted,#6b7280)] mt-1">Tinjau konten menunggu</p>
        </NuxtLink>
        <NuxtLink to="/admin/analytics" class="bg-[var(--rc-bg,#fff)] rounded-lg p-6 border border-[var(--rc-border)]">
          <h3 class="font-semibold">📈 Analytics Sistem</h3>
          <p class="text-sm text-[var(--rc-fg-muted,#6b7280)] mt-1">Metrik agregat & kesehatan</p>
        </NuxtLink>
      </div>
    </section>
  </main>
</template>