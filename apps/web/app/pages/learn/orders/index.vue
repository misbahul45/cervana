<script setup lang="ts">
interface OrderRow {
  id: string;
  status: string;
  total: number;
  currency: string;
  createdAt: string;
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    articleId: string | null;
    classId: string | null;
    topicId: string | null;
  }>;
}

const orders = ref<OrderRow[]>([]);
const error = ref<string | null>(null);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    const res = await $fetch<{ data: { data: OrderRow[] } }>('/v1/orders');
    orders.value = res.data.data;
  } catch (err) {
    error.value = 'Tidak bisa memuat pesanan.';
    console.error(err);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

useHead({
  title: 'Pesanan Saya | ReduCera',
});

function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

function statusColor(status: string): string {
  switch (status) {
    case 'PAID':
    case 'FULFILLED':
      return 'var(--rc-primary)';
    case 'PENDING':
    case 'PAYMENT_SUBMITTED':
    case 'REFUND_PENDING':
      return 'var(--rc-secondary)';
    case 'FAILED':
    case 'EXPIRED':
    case 'CANCELLED':
    case 'REFUNDED':
      return 'var(--rc-accent)';
    default:
      return 'var(--rc-muted)';
  }
}
</script>

<template>
  <div class="min-h-screen px-4 py-10 md:py-14 mx-auto max-w-4xl" :style="{ backgroundColor: 'var(--rc-bg)', color: 'var(--rc-fg)' }">
    <header class="mb-8">
      <h1 class="text-3xl font-bold" :style="{ color: 'var(--rc-fg)' }">Pesanan Saya</h1>
      <p class="mt-1 text-sm" :style="{ color: 'var(--rc-muted)' }">Riwayat pesanan dan status pembayaran.</p>
    </header>

    <div v-if="error" class="p-4 rounded-md" :style="{ backgroundColor: 'var(--rc-foam)', color: 'var(--rc-fg)' }">
      {{ error }}
    </div>

    <div v-if="loading" class="p-6 rounded-lg text-center" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
      <p :style="{ color: 'var(--rc-muted)' }">Memuat…</p>
    </div>

    <div v-else-if="orders.length === 0" class="p-6 rounded-lg text-center" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
      <p :style="{ color: 'var(--rc-muted)' }">Belum ada pesanan.</p>
      <UButton to="/marketplace" color="primary" class="mt-4">Jelajahi Marketplace</UButton>
    </div>

    <ul v-else class="space-y-3">
      <li
        v-for="o in orders"
        :key="o.id"
        class="p-4 rounded-xl"
        :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }"
      >
        <header class="flex items-baseline justify-between">
          <code class="text-sm font-mono" :style="{ color: 'var(--rc-muted)' }">#{{ o.id.slice(0, 8) }}</code>
          <span
            class="text-xs uppercase tracking-wide font-semibold"
            :style="{ color: statusColor(o.status) }"
          >
            {{ statusLabel(o.status) }}
          </span>
        </header>
        <div class="mt-2 flex items-baseline justify-between">
          <span class="text-xs" :style="{ color: 'var(--rc-muted)' }">
            {{ new Date(o.createdAt).toLocaleString('id-ID') }} · {{ o.items.length }} item
          </span>
          <span class="font-mono">Rp {{ o.total.toLocaleString('id-ID') }}</span>
        </div>
        <div class="mt-3 flex gap-2">
          <UButton
            v-if="['PENDING', 'PAYMENT_SUBMITTED'].includes(o.status)"
            :to="`/learn/orders/${o.id}/pay`"
            color="primary"
            size="xs"
          >
            Selesaikan Pembayaran
          </UButton>
          <UButton :to="`/v1/orders/${o.id}`" variant="outline" size="xs">Detail</UButton>
        </div>
      </li>
    </ul>
  </div>
</template>
