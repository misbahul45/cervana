<script setup lang="ts">
import { ref, onMounted } from 'vue';
import StatCard from '~/components/charts/StatCard.vue';
import { creatorApi } from '~/lib/api';

const articles = ref<any[]>([]);
const classes = ref<any[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const [artData, clsData] = await Promise.all([
      creatorApi.profile ? Promise.resolve([]) : Promise.resolve([]),
      Promise.resolve([]),
    ]);
    articles.value = artData;
    classes.value = clsData;
  } catch {
    // ignore
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <main class="max-w-5xl mx-auto p-6 space-y-6">
    <h1 class="text-3xl font-bold">Dashboard Kreator</h1>
    <p class="text-[var(--rc-fg-muted,#6b7280)]">Kelola artikel, kelas, dan pendapatan Anda.</p>

    <div v-if="loading" class="text-center py-8">Memuat...</div>

    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard title="Artikel" :value="articles.length" />
      <StatCard title="Kelas" :value="classes.length" />
      <StatCard title="Pendapatan Bulan Ini" :value="0" prefix="Rp " />
    </div>

    <section class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
      <NuxtLink to="/studio/articles" class="bg-[var(--rc-bg,#fff)] rounded-lg p-6 border border-[var(--rc-border)] hover:border-[var(--rc-primary,#3b82f6)]">
        <h3 class="font-semibold text-lg">📚 Kelola Artikel</h3>
        <p class="text-sm text-[var(--rc-fg-muted,#6b7280)] mt-1">Buat, edit, dan submit artikel untuk ditinjau</p>
      </NuxtLink>
      <NuxtLink to="/studio/classes" class="bg-[var(--rc-bg,#fff)] rounded-lg p-6 border border-[var(--rc-border)] hover:border-[var(--rc-primary,#3b82f6)]">
        <h3 class="font-semibold text-lg">🎓 Kelola Kelas</h3>
        <p class="text-sm text-[var(--rc-fg-muted,#6b7280)] mt-1">Buat dan jadwalkan sesi kelas</p>
      </NuxtLink>
      <NuxtLink to="/studio/earnings" class="bg-[var(--rc-bg,#fff)] rounded-lg p-6 border border-[var(--rc-border)] hover:border-[var(--rc-primary,#3b82f6)]">
        <h3 class="font-semibold text-lg">💰 Pendapatan</h3>
        <p class="text-sm text-[var(--rc-fg-muted,#6b7280)] mt-1">Lihat pendapatan & tarik saldo</p>
      </NuxtLink>
      <NuxtLink to="/studio/chat" class="bg-[var(--rc-bg,#fff)] rounded-lg p-6 border border-[var(--rc-border)] hover:border-[var(--rc-primary,#3b82f6)]">
        <h3 class="font-semibold text-lg">🤖 Asisten Kreator</h3>
        <p class="text-sm text-[var(--rc-fg-muted,#6b7280)] mt-1">Tanya ide konten, judul, strategi</p>
      </NuxtLink>
    </section>
  </main>
</template>