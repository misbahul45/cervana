<script setup lang="ts">
import { ordersApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { formatDateTime, formatMoney } from '~/lib/format';
import { orderItemTitle, orderStatusMeta } from '~/lib/order-status';

definePageMeta({
  title: 'Detail Pesanan — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'learner',
});

const route = useRoute();
const orderId = computed(() => String(route.params.id || ''));

const { data: order, status, error, refresh } = useAsyncData(
  () => `order:${orderId.value}`,
  () => ordersApi.get(orderId.value),
  { lazy: true, watch: [orderId] },
);
</script>

<template>
  <main id="main" aria-labelledby="order-h">
    <LoadingSkeleton v-if="status === 'pending'" variant="panel" :count="2" />
    <ErrorState
      v-else-if="error || !order"
      title="Pesanan tidak dapat dimuat"
      :message="describeApiError(error)"
      @retry="refresh()"
    />
    <template v-else>
      <header>
        <h1 id="order-h">Pesanan #{{ order.id.slice(0, 8) }}</h1>
        <StatusBadge :tone="orderStatusMeta(order.status).tone" :label="orderStatusMeta(order.status).label" />
        <p>Total: <strong>{{ formatMoney(order.total, order.currency) }}</strong></p>
        <p>Dibuat: {{ formatDateTime(order.createdAt) }}</p>
        <p v-if="order.paidAt">Dibayar: {{ formatDateTime(order.paidAt) }}</p>
      </header>

      <section aria-labelledby="items-h">
        <h2 id="items-h">Isi pesanan</h2>
        <ul>
          <li v-for="item in order.items" :key="item.id">
            {{ orderItemTitle(item) }} — {{ formatMoney(item.totalPrice, order.currency) }}
          </li>
        </ul>
      </section>

      <NuxtLink v-if="order.status === 'PENDING' && order.payment" :to="`/learn/orders/${order.id}/pay`">
        Lanjutkan pembayaran
      </NuxtLink>
      <p v-else-if="order.status === 'PAYMENT_SUBMITTED'">
        Bukti pembayaran Anda sedang diverifikasi.
      </p>
    </template>
  </main>
</template>

