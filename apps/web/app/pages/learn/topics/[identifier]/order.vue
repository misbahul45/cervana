<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import PlayCard from '~/components/play/PlayCard.vue';
import ErrorState from '~/components/ui/ErrorState.vue';
import LoadingSkeleton from '~/components/ui/LoadingSkeleton.vue';
import { ordersApi } from '~/lib/api';
import { describeApiError, isApiError } from '~/lib/api-error';
import { loginHref } from '~/lib/next-path';
import { topicOrderState } from '~/lib/order-status';
import { plainText, priceLabel } from '~/lib/topics';
import { topicsService } from '~/services/curriculum/topics';

definePageMeta({
  title: 'Beli Topik — ReduCera',
  protection: { kind: 'authenticated' },
});

useHead({ title: 'Beli Topik — ReduCera' });

const route = useRoute();
const topicId = computed(() => String(route.params.identifier || ''));

const { data, status, error, refresh } = useAsyncData(
  () => `topic-checkout:${topicId.value}`,
  async () => {
    const [topic, orders] = await Promise.all([topicsService.findOne(topicId.value, {}), ordersApi.list()]);
    if (!topic.success || !topic.data) throw new Error(topic.message || 'Topik tidak ditemukan');
    return { topic: topic.data, state: topicOrderState(orders, topic.data.id) };
  },
  { lazy: true, watch: [topicId] },
);

const idempotency = useIdempotencyKey();
const buying = ref(false);
const buyError = ref<string | null>(null);

async function buy() {
  if (buying.value || !data.value) return;
  buying.value = true;
  buyError.value = null;
  try {
    const order = await ordersApi.create([{ type: 'TOPIC', id: data.value.topic.id }], idempotency.current());
    idempotency.reset();
    await navigateTo(order.status === 'PENDING' && order.payment ? `/learn/orders/${order.id}/pay` : `/learn/orders/${order.id}`);
  } catch (err) {
    if (isApiError(err) && err.kind === 'unauthorized') {
      await navigateTo(loginHref(route.fullPath));
      return;
    }
    buyError.value = describeApiError(err, 'Tidak bisa membuat pesanan. Coba lagi.');
  } finally {
    buying.value = false;
  }
}
</script>

<template>
  <div class="rc-stack rc-pay">
    <LoadingSkeleton v-if="status === 'pending' && !data" variant="panel" :count="2" />
    <ErrorState v-else-if="error || !data" title="Topik tidak dapat dimuat" :message="describeApiError(error, 'Topik tidak ditemukan.')" @retry="refresh()" />

    <template v-else>
      <PageHeader :title="data.topic.title" subtitle="Konfirmasi pembelian topik" />

      <PlayCard as="section" aria-labelledby="topic-order-h">
        <h2 id="topic-order-h" class="rc-h2">Ringkasan</h2>
        <p v-if="data.topic.description">{{ plainText(data.topic.description, 220) }}</p>
        <p class="rc-orders__total">Harga <strong>{{ priceLabel(data.topic.price) }}</strong></p>

        <template v-if="data.state.kind === 'owned'">
          <p class="rc-alert rc-alert--success" role="status">Topik ini sudah menjadi milikmu.</p>
          <div class="rc-actions">
            <PlayButton :to="`/my-learning/topics/${data.topic.slug}`">Mulai belajar</PlayButton>
          </div>
        </template>
        <template v-else-if="data.state.kind === 'open'">
          <p class="rc-alert" role="status">
            {{ data.state.next === 'pay' ? 'Kamu sudah punya pesanan yang menunggu pembayaran.' : 'Bukti pembayaranmu sedang diverifikasi admin.' }}
          </p>
          <div class="rc-actions">
            <PlayButton :to="data.state.next === 'pay' ? `/learn/orders/${data.state.orderId}/pay` : `/learn/orders/${data.state.orderId}`">
              {{ data.state.next === 'pay' ? 'Lanjutkan pembayaran' : 'Lihat pesanan' }}
            </PlayButton>
          </div>
        </template>
        <template v-else>
          <p v-if="buyError" class="rc-alert rc-alert--error" role="alert">{{ buyError }}</p>
          <div class="rc-actions">
            <PlayButton :loading="buying" @click="buy">Buat pesanan</PlayButton>
            <PlayButton :to="`/learn/topics/${data.topic.slug}/detail`" variant="secondary">Kembali</PlayButton>
          </div>
        </template>
      </PlayCard>
    </template>
  </div>
</template>
