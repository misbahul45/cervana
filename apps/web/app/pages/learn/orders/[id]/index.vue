<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import PlayCard from '~/components/play/PlayCard.vue';
import ErrorState from '~/components/ui/ErrorState.vue';
import LoadingSkeleton from '~/components/ui/LoadingSkeleton.vue';
import StatusBadge from '~/components/ui/StatusBadge.vue';
import { ordersApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { formatDateTime, formatMoney } from '~/lib/format';
import { orderItemLink, orderItemTitle, orderNext, orderStatusMeta } from '~/lib/order-status';

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

const next = computed(() => (order.value ? orderNext(order.value) : null));

useHead({ title: () => (order.value ? `Pesanan #${order.value.id.slice(0, 8)} — ReduCera` : 'Detail Pesanan — ReduCera') });
</script>

<template>
  <div class="rc-stack">
    <LoadingSkeleton v-if="status === 'pending'" variant="panel" :count="2" />
    <ErrorState v-else-if="error || !order" title="Pesanan tidak dapat dimuat" :message="describeApiError(error)" @retry="refresh()" />

    <template v-else>
      <PageHeader :title="`Pesanan #${order.id.slice(0, 8)}`" :subtitle="`Dibuat ${formatDateTime(order.createdAt)}`">
        <template #actions>
          <StatusBadge :tone="orderStatusMeta(order.status).tone" :label="orderStatusMeta(order.status).label" />
        </template>
      </PageHeader>

      <PlayCard as="section" aria-labelledby="order-items">
        <h2 id="order-items" class="rc-h2">Isi pesanan</h2>
        <ul class="rc-orders__lines">
          <li v-for="item in order.items" :key="item.id">
            <div>
              <NuxtLink v-if="orderItemLink(item) && next?.kind === 'open'" :to="orderItemLink(item)!" class="rc-cdetail__link">
                {{ orderItemTitle(item) }}
              </NuxtLink>
              <span v-else>{{ orderItemTitle(item) }}</span>
            </div>
            <strong>{{ formatMoney(item.totalPrice, order.currency) }}</strong>
          </li>
        </ul>
        <p class="rc-orders__total">Total <strong>{{ formatMoney(order.total, order.currency) }}</strong></p>
        <p v-if="order.paidAt" class="rc-hint">Dibayar {{ formatDateTime(order.paidAt) }}</p>
      </PlayCard>

      <div v-if="next" class="rc-actions">
        <PlayButton v-if="next.kind === 'pay'" :to="next.to">{{ next.label }}</PlayButton>
        <p v-else class="rc-alert" :class="{ 'rc-alert--success': next.kind === 'open' }" role="status">{{ next.message }}</p>
        <PlayButton to="/learn/orders" variant="secondary">Semua pesanan</PlayButton>
      </div>
    </template>
  </div>
</template>
