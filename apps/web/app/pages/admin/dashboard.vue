<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayCard from '~/components/play/PlayCard.vue';
import { analyticsApi } from '~/lib/api';
import { adminService } from '~/services/admin';

definePageMeta({
  title: 'Beranda admin — ReduCera',
  protection: { kind: 'role', role: 'ADMIN' },
  layout: 'admin',
});

useHead({ title: 'Beranda admin — ReduCera' });

const { data: counts, status: countsStatus, error: countsError, refresh: refreshCounts } = useAsyncData(
  'admin:queue-counts',
  () => adminService.queueCounts(),
  { lazy: true },
);

const { data: overview, status: overviewStatus, error: overviewError, refresh: refreshOverview } = useAsyncData(
  'admin:overview',
  () => analyticsApi.adminOverview(),
  { lazy: true },
);

const queues = computed(() => {
  const value = counts.value;
  if (!value) return [];
  return [
    { label: 'Pembayaran menunggu', value: value.payments, to: '/admin/payments' },
    { label: 'Pencairan diajukan', value: value.payouts, to: '/admin/payouts?status=REQUESTED' },
    { label: 'Pengembalian dana diajukan', value: value.refunds, to: '/admin/refunds?status=REQUESTED' },
    { label: 'Artikel menunggu tinjauan', value: value.articles, to: '/admin/moderation?type=article' },
    { label: 'Kelas menunggu tinjauan', value: value.classes, to: '/admin/moderation?type=class' },
    { label: 'Pendaftar kreator menunggu', value: value.applications, to: '/admin/applications' },
  ];
});

const platform = computed(() => {
  const value = overview.value;
  if (!value) return [];
  return [
    { label: 'Pengguna', value: value.totalUsers },
    { label: 'Kreator', value: value.totalCreators },
    { label: 'Konten terbit', value: value.totalContent },
    { label: 'Keputusan agen', value: value.totalAgentDecisions },
  ];
});
</script>

<template>
  <div class="rc-stack">
    <PageHeader title="Beranda admin" subtitle="Antrean yang menunggu keputusanmu dan ringkasan platform." />

    <section class="rc-stack" aria-labelledby="queue-h">
      <h2 id="queue-h" class="rc-h2">Perlu ditindaklanjuti</h2>
      <AdminState
        :status="countsStatus"
        :error="countsError"
        error-title="Antrean gagal dimuat"
        :skeleton="2"
        @retry="refreshCounts()"
      >
        <div class="rc-statgrid">
          <PlayCard v-for="queue in queues" :key="queue.label" as="div" interactive :tone="queue.value > 0 ? 'gold' : 'default'">
            <NuxtLink :to="queue.to" class="rc-statcard">
              <span class="rc-statcard__value">{{ queue.value }}</span>
              <span class="rc-statcard__label">{{ queue.label }}</span>
            </NuxtLink>
          </PlayCard>
        </div>
      </AdminState>
    </section>

    <section class="rc-stack" aria-labelledby="platform-h">
      <h2 id="platform-h" class="rc-h2">Platform</h2>
      <AdminState
        :status="overviewStatus"
        :error="overviewError"
        error-title="Ringkasan gagal dimuat"
        :skeleton="2"
        @retry="refreshOverview()"
      >
        <div class="rc-statgrid">
          <PlayCard v-for="item in platform" :key="item.label">
            <div class="rc-statcard">
              <span class="rc-statcard__value">{{ item.value }}</span>
              <span class="rc-statcard__label">{{ item.label }}</span>
            </div>
          </PlayCard>
        </div>
        <p class="rc-hint">Rincian ada di <NuxtLink to="/admin/analytics">Analitik</NuxtLink>.</p>
      </AdminState>
    </section>
  </div>
</template>
