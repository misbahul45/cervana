<script setup lang="ts">
import { ordersApi, paymentsApi, uploadApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { formatDateTime, formatMoney } from '~/lib/format';
import { orderTitle } from '~/lib/order-status';

definePageMeta({
  title: 'Selesaikan Pembayaran | ReduCera',
  protection: { kind: 'authenticated' },
});

const route = useRoute();
const orderId = computed(() => String(route.params.id || ''));

const { data: order, status, error, refresh } = useAsyncData(
  () => `order:${orderId.value}`,
  () => ordersApi.get(orderId.value),
  { lazy: true, watch: [orderId] },
);

const payment = computed(() => order.value?.payment ?? null);
const instructions = computed(() => payment.value?.presentation?.data ?? null);
const accounts = computed(() => instructions.value?.accounts ?? []);

const selectedMethod = ref('');
const referenceNumber = ref('');
const note = ref('');
const proofFile = ref<File | null>(null);
const uploadedProof = ref<{ url: string; fileId: string } | null>(null);
const submitting = ref(false);
const submitError = ref<string | null>(null);
const idempotency = useIdempotencyKey();

watchEffect(() => {
  if (!selectedMethod.value && accounts.value.length > 0) selectedMethod.value = accounts.value[0]!.method;
});

function onProofChange(event: Event) {
  const input = event.target as HTMLInputElement;
  proofFile.value = input.files?.[0] ?? null;
  uploadedProof.value = null;
}

async function submit() {
  if (submitting.value || !payment.value) return;
  if (!proofFile.value) {
    submitError.value = 'Unggah bukti transfer terlebih dahulu.';
    return;
  }
  if (!selectedMethod.value) {
    submitError.value = 'Pilih metode pembayaran.';
    return;
  }

  submitting.value = true;
  submitError.value = null;
  try {
    uploadedProof.value ??= await uploadApi.proof(proofFile.value);
    await paymentsApi.submitManual(
      payment.value.id,
      {
        paymentMethod: selectedMethod.value,
        proof: uploadedProof.value,
        ...(referenceNumber.value.trim() ? { referenceNumber: referenceNumber.value.trim() } : {}),
        ...(note.value.trim() ? { note: note.value.trim() } : {}),
      },
      idempotency.current(),
    );
    idempotency.reset();
    await navigateTo(`/learn/orders/${orderId.value}/submitted`);
  } catch (err) {
    submitError.value = describeApiError(err, 'Tidak bisa mengirim bukti transfer. Coba lagi.');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen px-4 py-10 md:py-14 mx-auto max-w-2xl" :style="{ backgroundColor: 'var(--rc-bg)', color: 'var(--rc-fg)' }">
    <main id="main" aria-labelledby="pay-h">
      <LoadingSkeleton v-if="status === 'pending'" variant="panel" :count="2" />
      <ErrorState
        v-else-if="error || !order"
        title="Pesanan tidak dapat dimuat"
        :message="describeApiError(error)"
        @retry="refresh()"
      />

      <template v-else-if="order.status !== 'PENDING'">
        <h1 id="pay-h" class="text-2xl md:text-3xl font-bold">Pembayaran</h1>
        <p class="mt-3" :style="{ color: 'var(--rc-muted)' }">
          <template v-if="order.status === 'PAYMENT_SUBMITTED'">Bukti pembayaran sudah diterima dan sedang diverifikasi.</template>
          <template v-else>Pesanan ini tidak menunggu pembayaran lagi.</template>
        </p>
        <NuxtLink class="mt-4 inline-block" :to="`/learn/orders/${order.id}`">Lihat detail pesanan</NuxtLink>
      </template>

      <ErrorState
        v-else-if="!payment || !instructions"
        title="Instruksi pembayaran belum tersedia"
        message="Instruksi pembayaran untuk pesanan ini belum dapat ditampilkan. Coba lagi beberapa saat."
        @retry="refresh()"
      />

      <template v-else>
        <h1 id="pay-h" class="text-2xl md:text-3xl font-bold">Selesaikan Pembayaran</h1>
        <p class="mt-2 text-sm" :style="{ color: 'var(--rc-muted)' }">
          {{ orderTitle(order.items) }} · Pesanan #{{ order.id.slice(0, 8) }}
        </p>

        <section class="mt-6 p-6 rounded-xl" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }" aria-labelledby="summary-h">
          <h2 id="summary-h" class="text-lg font-semibold">Ringkasan</h2>
          <dl class="mt-4 space-y-2 text-sm">
            <div class="flex justify-between">
              <dt :style="{ color: 'var(--rc-muted)' }">Total</dt>
              <dd class="font-mono">{{ formatMoney(instructions.amount, instructions.currency) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt :style="{ color: 'var(--rc-muted)' }">Kode referensi</dt>
              <dd class="font-mono">{{ instructions.referenceCode }}</dd>
            </div>
            <div class="flex justify-between">
              <dt :style="{ color: 'var(--rc-muted)' }">Batas waktu</dt>
              <dd>{{ formatDateTime(instructions.expiresAt) }}</dd>
            </div>
          </dl>
        </section>

        <section class="mt-6 p-6 rounded-xl" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }" aria-labelledby="accounts-h">
          <h2 id="accounts-h" class="text-lg font-semibold">Transfer ke</h2>
          <fieldset class="mt-4 space-y-3">
            <legend class="sr-only">Pilih rekening tujuan</legend>
            <label
              v-for="account in accounts"
              :key="`${account.method}-${account.accountNumber}`"
              class="block p-4 rounded-lg cursor-pointer"
              :style="{
                backgroundColor: selectedMethod === account.method ? 'var(--rc-foam)' : 'var(--rc-bg)',
                border: selectedMethod === account.method ? '2px solid var(--rc-primary)' : '1px solid var(--rc-border)',
              }"
            >
              <input v-model="selectedMethod" type="radio" name="method" :value="account.method" class="sr-only" />
              <span class="block text-xs uppercase tracking-wide" :style="{ color: 'var(--rc-muted)' }">{{ account.label }}</span>
              <span class="mt-1 block font-mono text-lg">{{ account.accountNumber }}</span>
              <span class="block text-sm" :style="{ color: 'var(--rc-muted)' }">a.n. {{ account.accountName }}</span>
            </label>
          </fieldset>
        </section>

        <form class="mt-6 p-6 rounded-xl" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }" aria-labelledby="proof-h" @submit.prevent="submit">
          <h2 id="proof-h" class="text-lg font-semibold">Bukti Transfer</h2>

          <label class="mt-3 block text-sm" for="proof">Unggah bukti (gambar)</label>
          <input id="proof" type="file" accept="image/*" required class="mt-1 block w-full text-sm" @change="onProofChange" />

          <label class="mt-3 block text-sm" for="reference">Nomor referensi transfer (opsional)</label>
          <input
            id="reference"
            v-model="referenceNumber"
            type="text"
            maxlength="64"
            class="rc-field mt-1 font-mono"
          />

          <label class="mt-3 block text-sm" for="note">Catatan (opsional)</label>
          <textarea
            id="note"
            v-model="note"
            maxlength="500"
            rows="2"
            class="rc-field mt-1"
          />

          <p v-if="submitError" role="alert" class="mt-3 text-sm" :style="{ color: 'var(--ui-error, #dc2626)' }">{{ submitError }}</p>

          <UButton type="submit" color="primary" size="lg" block class="mt-4" :disabled="submitting" :loading="submitting">
            {{ submitting ? 'Mengirim…' : 'Kirim Bukti Pembayaran' }}
          </UButton>
        </form>
      </template>
    </main>
  </div>
</template>
