<script setup lang="ts">
import { ordersApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { formatDate, formatMoney } from '~/lib/format';
import { orderStatusMeta, orderTitle } from '~/lib/order-status';

definePageMeta({
  title: 'Pesanan Saya — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'learner',
});

const { data: orders, status, error, refresh } = useAsyncData('orders:list', () => ordersApi.list(), { lazy: true });
</script>

<template>
  <main id="main" aria-labelledby="orders-h">
    <h1 id="orders-h">Pesanan Saya</h1>

    <LoadingSkeleton v-if="status === 'pending'" variant="row" :count="3" />
    <ErrorState
      v-else-if="error"
      title="Gagal memuat pesanan"
      :message="describeApiError(error)"
      @retry="refresh()"
    />
    <EmptyState
      v-else-if="!orders || orders.length === 0"
      title="Belum ada pesanan"
      message="Mulai belanja di marketplace untuk melihat pesanan Anda di sini."
      cta-label="Buka marketplace"
      cta-to="/marketplace"
    />
    <ul v-else class="rc-orders__list">
      <li v-for="o in orders" :key="o.id" class="rc-orders__item">
        <header class="rc-orders__item-head">
          <div>
            <p class="rc-orders__item-date">{{ formatDate(o.createdAt) }}</p>
            <h2>{{ orderTitle(o.items) }}</h2>
          </div>
          <StatusBadge :tone="orderStatusMeta(o.status).tone" :label="orderStatusMeta(o.status).label" />
        </header>
        <footer class="rc-orders__item-foot">
          <span class="rc-orders__item-amount">{{ formatMoney(o.total, o.currency) }}</span>
          <NuxtLink :to="o.status === 'PENDING' && o.payment ? `/learn/orders/${o.id}/pay` : `/learn/orders/${o.id}`">
            {{ o.status === 'PENDING' && o.payment ? 'Bayar' : 'Detail' }}
          </NuxtLink>
        </footer>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.rc-orders__list {
  list-style: none;
  margin: 1rem 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}
.rc-orders__item {
  padding: 1rem;
  border-radius: 0.75rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  background: var(--ui-bg, white);
}
.rc-orders__item-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}
.rc-orders__item-date {
  font-size: 0.75rem;
  color: var(--ui-text-muted);
}
.rc-orders__item-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.5rem;
}
.rc-orders__item-amount {
  font-weight: 600;
}
</style>