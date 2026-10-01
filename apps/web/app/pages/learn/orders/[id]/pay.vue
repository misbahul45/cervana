<script setup lang="ts">
interface OrderDetail {
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

interface IntentDetail {
  id: string;
  amount: number;
  currency: string;
  status: string;
  expiresAt: string;
}

interface ManualPaymentMethod {
  method: 'BANK_TRANSFER';
  label: string;
  accountNumber: string;
  accountName: string;
}

const route = useRoute();
const order = ref<OrderDetail | null>(null);
const intent = ref<IntentDetail | null>(null);
const methods = ref<ManualPaymentMethod[]>([]);
const selectedMethod = ref<string>('BANK_TRANSFER');
const referenceNumber = ref('');
const error = ref<string | null>(null);
const submitting = ref(false);

async function load() {
  try {
    const orderId = route.params.id as string;
    const orderRes = await $fetch<{ data: OrderDetail }>(`/v1/orders/${orderId}`);
    order.value = orderRes.data;
    const intentId = (route.query.intentId as string) ?? '';
    if (intentId) {
      const intentRes = await $fetch<{ data: IntentDetail }>(`/v1/payments/intents/${intentId}`);
      intent.value = intentRes.data;
    }
    const cfgRes = await $fetch<{ data: { manual: ManualPaymentMethod[] } }>(`/v1/payments/config`);
    methods.value = cfgRes.data.manual;
  } catch (err) {
    error.value = 'Pesanan tidak ditemukan.';
    console.error(err);
  }
}

async function submit() {
  if (!order.value || !intent.value) return;
  if (referenceNumber.value.trim().length < 3) {
    error.value = 'Mohon isi nomor referensi transfer.';
    return;
  }
  submitting.value = true;
  try {
    await $fetch(`/v1/payments/intents/${intent.value.id}/manual-submissions`, {
      method: 'POST',
      body: {
        orderId: order.value.id,
        amount: intent.value.amount,
        currency: intent.value.currency,
        paymentMethod: selectedMethod.value,
        referenceNumber: referenceNumber.value.trim(),
      },
    });
    await navigateTo(`/learn/orders/${order.value.id}/submitted`);
  } catch (err) {
    error.value = 'Tidak bisa mengirim bukti transfer. Coba lagi.';
    console.error(err);
  } finally {
    submitting.value = false;
  }
}

onMounted(load);

useHead({
  title: 'Selesaikan Pembayaran | ReduCera',
});
</script>

<template>
  <div class="min-h-screen px-4 py-10 md:py-14 mx-auto max-w-2xl" :style="{ backgroundColor: 'var(--rc-bg)', color: 'var(--rc-fg)' }">
    <div v-if="error" class="p-6 rounded-lg text-center" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
      <p :style="{ color: 'var(--rc-muted)' }">{{ error }}</p>
    </div>

    <template v-else-if="order && intent">
      <h1 class="text-2xl md:text-3xl font-bold" :style="{ color: 'var(--rc-fg)' }">Selesaikan Pembayaran</h1>
      <p class="mt-2 text-sm" :style="{ color: 'var(--rc-muted)' }">Pesanan #{{ order.id.slice(0, 8) }}</p>

      <section class="mt-6 p-6 rounded-xl" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
        <h2 class="text-lg font-semibold" :style="{ color: 'var(--rc-fg)' }">Ringkasan</h2>
        <dl class="mt-4 space-y-2 text-sm">
          <div class="flex justify-between">
            <dt :style="{ color: 'var(--rc-muted)' }">Total</dt>
            <dd class="font-mono">Rp {{ intent.amount.toLocaleString('id-ID') }}</dd>
          </div>
          <div class="flex justify-between">
            <dt :style="{ color: 'var(--rc-muted)' }">Batas waktu</dt>
            <dd>{{ new Date(intent.expiresAt).toLocaleString('id-ID') }}</dd>
          </div>
        </dl>
      </section>

      <section class="mt-6 p-6 rounded-xl" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
        <h2 class="text-lg font-semibold" :style="{ color: 'var(--rc-fg)' }">Transfer Bank</h2>
        <div class="mt-4 space-y-3">
          <div
            v-for="m in methods"
            :key="m.method"
            class="p-4 rounded-lg"
            :style="{
              backgroundColor: selectedMethod === m.method ? 'var(--rc-foam)' : 'var(--rc-bg)',
              border: selectedMethod === m.method ? '2px solid var(--rc-primary)' : '1px solid var(--rc-border)',
            }"
            @click="selectedMethod = m.method"
          >
            <p class="text-xs uppercase tracking-wide" :style="{ color: 'var(--rc-muted)' }">{{ m.label }}</p>
            <p class="mt-1 font-mono text-lg">{{ m.accountNumber }}</p>
            <p class="text-sm" :style="{ color: 'var(--rc-muted)' }">a.n. {{ m.accountName }}</p>
          </div>
        </div>
      </section>

      <section class="mt-6 p-6 rounded-xl" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
        <h2 class="text-lg font-semibold" :style="{ color: 'var(--rc-fg)' }">Bukti Transfer</h2>
        <p class="mt-2 text-sm" :style="{ color: 'var(--rc-muted)' }">Mohon isi nomor referensi transfer Anda.</p>
        <input
          v-model="referenceNumber"
          type="text"
          placeholder="contoh: TRF20240929001"
          class="mt-3 w-full px-3 py-2 rounded-md font-mono text-sm"
          :style="{ backgroundColor: 'var(--rc-bg)', color: 'var(--rc-fg)', border: '1px solid var(--rc-border)' }"
        />
        <UButton
          color="primary"
          size="lg"
          block
          class="mt-4"
          :disabled="submitting"
          @click="submit"
        >
          {{ submitting ? 'Mengirim…' : 'Kirim Bukti Pembayaran' }}
        </UButton>
      </section>
    </template>

    <div v-else class="p-6 rounded-lg text-center" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
      <p :style="{ color: 'var(--rc-muted)' }">Memuat…</p>
    </div>
  </div>
</template>
