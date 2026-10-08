<script setup lang="ts">
import StatCard from '~/components/charts/StatCard.vue';
import { analyticsApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';

definePageMeta({
  title: 'Dashboard Admin — ReduCera',
  protection: { kind: 'role', role: 'ADMIN' },
});

const { data: overview, status, error, refresh } = useAsyncData('admin:overview', () => analyticsApi.adminOverview(), {
  lazy: true,
});
</script>

<template>
  <main class="max-w-6xl mx-auto p-6 space-y-6">
    <h1 class="text-3xl font-bold">Dashboard Admin</h1>
    <p class="text-[var(--rc-fg-muted,#6b7280)]">Ringkasan operasional sistem dan kendali utama.</p>

    <LoadingSkeleton v-if="status === 'pending'" variant="card" :count="4" />
    <ErrorState
      v-else-if="error || !overview"
      title="Gagal memuat ringkasan"
      :message="describeApiError(error)"
      @retry="refresh()"
    />
    <div v-else class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatCard title="Pengguna" :value="overview.totalUsers" />
      <StatCard title="Kreator" :value="overview.totalCreators" />
      <StatCard title="Konten" :value="overview.totalContent" />
      <StatCard title="Keputusan Agent" :value="overview.totalAgentDecisions" />
    </div>

    <section>
      <h2 class="text-xl font-semibold mb-3">Kelola Sistem</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NuxtLink to="/admin/moderation" class="bg-[var(--rc-bg,#fff)] rounded-lg p-6 border border-[var(--rc-border)]">
          <h3 class="font-semibold">Antrian Moderasi</h3>
          <p class="text-sm text-[var(--rc-fg-muted,#6b7280)] mt-1">Tinjau konten menunggu</p>
        </NuxtLink>
        <NuxtLink to="/admin/analytics" class="bg-[var(--rc-bg,#fff)] rounded-lg p-6 border border-[var(--rc-border)]">
          <h3 class="font-semibold">Analytics Sistem</h3>
          <p class="text-sm text-[var(--rc-fg-muted,#6b7280)] mt-1">Metrik agregat & kesehatan</p>
        </NuxtLink>
      </div>
    </section>
  </main>
</template>
