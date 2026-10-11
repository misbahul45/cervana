<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import EmptyState from '~/components/ui/EmptyState.vue';
import ErrorState from '~/components/ui/ErrorState.vue';
import LoadingSkeleton from '~/components/ui/LoadingSkeleton.vue';
import { analyticsApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { formatAmount, formatDate } from '~/lib/format';
import { orderStatusMeta } from '~/lib/order-status';

definePageMeta({
  title: 'Analitik — ReduCera Studio',
  protection: { kind: 'tenant-role', tenantRoles: ['OWNER', 'MANAGER', 'TEACHER', 'EDITOR'] },
  layout: 'studio',
});

useHead({ title: 'Analitik — ReduCera Studio' });

const { data, status, error, refresh } = useAsyncData('studio:analytics', () => analyticsApi.creatorMe(), { lazy: true });
</script>

<template>
  <div class="rc-stack">
    <PageHeader title="Analitik" subtitle="Penjualan dan pesanan terbaru dari karyamu." />

    <LoadingSkeleton v-if="status === 'pending'" variant="panel" :count="2" />
    <ErrorState v-else-if="error || !data" title="Gagal memuat analitik" :message="describeApiError(error)" @retry="refresh()" />

    <template v-else>
      <ul class="rc-studio-stats" aria-label="Ringkasan">
        <li class="rc-card"><span class="rc-hint">Pesanan terbaru</span><strong>{{ data.recentOrders.length }}</strong></li>
        <li class="rc-card"><span class="rc-hint">Refund diajukan</span><strong>{{ data.refundCount }}</strong></li>
      </ul>

      <section aria-labelledby="metrics-h">
        <h2 id="metrics-h" class="rc-h2">Metrik periode</h2>
        <EmptyState v-if="data.metrics.length === 0" title="Belum ada metrik" message="Metrik muncul setelah ada penjualan dan snapshot harian berjalan." />
        <div v-else class="rc-table-wrap">
          <table class="rc-table">
            <caption>Metrik per periode</caption>
            <thead>
              <tr>
                <th scope="col">Periode</th>
                <th scope="col" class="rc-table__num">Penjualan</th>
                <th scope="col" class="rc-table__num">Penyelesaian</th>
                <th scope="col" class="rc-table__num">Kepuasan</th>
                <th scope="col" class="rc-table__num">Pendapatan</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="metric in data.metrics" :key="metric.id">
                <td>{{ formatDate(metric.windowStart) }} – {{ formatDate(metric.windowEnd) }}</td>
                <td class="rc-table__num">{{ metric.salesCount }}</td>
                <td class="rc-table__num">{{ metric.completionRate }}</td>
                <td class="rc-table__num">{{ metric.satisfaction }}</td>
                <td class="rc-table__num">{{ formatAmount(metric.totalRevenue) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="orders-h">
        <h2 id="orders-h" class="rc-h2">Pesanan terbaru</h2>
        <EmptyState v-if="data.recentOrders.length === 0" title="Belum ada pesanan" message="Pesanan pembeli akan muncul di sini." />
        <ul v-else class="rc-studio-list" aria-label="Pesanan terbaru">
          <li v-for="order in data.recentOrders" :key="order.id" class="rc-card">
            <div class="rc-studio-list__main">
              <p class="rc-studio-list__title">Pesanan #{{ String(order.id).slice(0, 8) }}</p>
              <p class="rc-hint">{{ formatDate(order.createdAt) }} · {{ orderStatusMeta(order.status).label }}</p>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
