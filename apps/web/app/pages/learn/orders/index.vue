<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import PlayCard from '~/components/play/PlayCard.vue';
import EmptyState from '~/components/ui/EmptyState.vue';
import ErrorState from '~/components/ui/ErrorState.vue';
import LoadingSkeleton from '~/components/ui/LoadingSkeleton.vue';
import StatusBadge from '~/components/ui/StatusBadge.vue';
import { ordersApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { formatDate, formatMoney } from '~/lib/format';
import { orderStatusMeta, orderTitle } from '~/lib/order-status';

definePageMeta({
  title: 'Pesanan Saya — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'learner',
});

useHead({ title: 'Pesanan Saya — ReduCera' });

const { data: orders, status, error, refresh } = useAsyncData('orders:list', () => ordersApi.list(), { lazy: true });
</script>

<template>
  <div class="rc-stack">
    <PageHeader title="Pesanan saya" subtitle="Pantau pembayaran dan buka lagi artikel atau kelas yang sudah kamu beli.">
      <template #actions>
        <PlayButton to="/marketplace" variant="secondary" size="sm">Ke marketplace</PlayButton>
      </template>
    </PageHeader>

    <LoadingSkeleton v-if="status === 'pending'" variant="row" :count="3" />
    <ErrorState v-else-if="error" title="Gagal memuat pesanan" :message="describeApiError(error)" @retry="refresh()" />
    <EmptyState
      v-else-if="!orders || orders.length === 0"
      title="Belum ada pesanan"
      message="Pesanan dari marketplace akan muncul di sini."
      cta-label="Buka marketplace"
      cta-to="/marketplace"
    />
    <ul v-else class="rc-orders" aria-label="Daftar pesanan">
      <li v-for="order in orders" :key="order.id">
        <PlayCard class="rc-orders__item">
          <div class="rc-orders__main">
            <p class="rc-hint">{{ formatDate(order.createdAt) }}</p>
            <h2 class="rc-orders__title">{{ orderTitle(order.items) }}</h2>
            <p class="rc-orders__amount">{{ formatMoney(order.total, order.currency) }}</p>
          </div>
          <div class="rc-orders__side">
            <StatusBadge :tone="orderStatusMeta(order.status).tone" :label="orderStatusMeta(order.status).label" />
            <PlayButton
              :to="order.status === 'PENDING' ? `/learn/orders/${order.id}/pay` : `/learn/orders/${order.id}`"
              :variant="order.status === 'PENDING' ? 'primary' : 'secondary'"
              size="sm"
            >
              {{ order.status === 'PENDING' ? 'Bayar sekarang' : 'Lihat detail' }}
            </PlayButton>
          </div>
        </PlayCard>
      </li>
    </ul>
  </div>
</template>
