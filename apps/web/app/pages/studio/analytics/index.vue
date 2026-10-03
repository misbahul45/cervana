<script setup lang="ts">
import { analyticsApi } from '~/lib/api';

const data = ref<{ metrics: any[]; recentOrders: any[]; refundCount: number } | null>(null);
try {
  data.value = (await analyticsApi.creatorMe()) ?? null;
} catch {
  data.value = null;
}

useHead({ title: 'Analitik Kreator — Studio ReduCera' });
</script>

<template>
  <main>
    <h1>Analitik Kreator</h1>
    <section v-if="data">
      <h2>Ringkasan</h2>
      <p>Jumlah pesanan: {{ data.recentOrders.length }}</p>
      <p>Refund diajukan: {{ data.refundCount }}</p>

      <h2>Metrics</h2>
      <table v-if="data.metrics.length">
        <thead>
          <tr>
            <th>Window</th>
            <th>Sales</th>
            <th>Completion</th>
            <th>Satisfaction</th>
            <th>Revenue</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in data.metrics" :key="m.id">
            <td>{{ m.windowStart }} → {{ m.windowEnd }}</td>
            <td>{{ m.salesCount }}</td>
            <td>{{ m.completionRate }}</td>
            <td>{{ m.satisfaction }}</td>
            <td>{{ m.totalRevenue }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else>Belum ada metrics (jalankan snapshot job terlebih dahulu).</p>

      <h2>Pesanan Terbaru</h2>
      <ul>
        <li v-for="o in data.recentOrders" :key="o.id">
          {{ o.id }} — {{ o.status }} — {{ o.createdAt }}
        </li>
      </ul>
    </section>
    <p v-else>Tidak ada data.</p>
  </main>
</template>