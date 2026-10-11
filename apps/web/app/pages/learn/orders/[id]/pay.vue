<script setup lang="ts">
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import PlayCard from '~/components/play/PlayCard.vue';
import ErrorState from '~/components/ui/ErrorState.vue';
import LoadingSkeleton from '~/components/ui/LoadingSkeleton.vue';
import { evidenceProblem } from '~/lib/admin';
import { ordersApi, paymentsApi, uploadApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { formatDateTime, formatMoney } from '~/lib/format';
import { orderTitle } from '~/lib/order-status';

definePageMeta({
  title: 'Selesaikan Pembayaran — ReduCera',
  protection: { kind: 'authenticated' },
  layout: 'learner',
});

useHead({ title: 'Selesaikan Pembayaran — ReduCera' });

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

const proofProblem = ref<string | null>(null);

function onProofChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  uploadedProof.value = null;
  proofProblem.value = file ? evidenceProblem(file) : null;
  proofFile.value = proofProblem.value ? null : file;
  if (proofProblem.value) input.value = '';
}

async function submit() {
  if (submitting.value || !payment.value) return;
  if (!proofFile.value) {
    submitError.value = proofProblem.value ?? 'Unggah bukti transfer terlebih dahulu.';
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
  <div class="rc-stack rc-pay">
    <LoadingSkeleton v-if="status === 'pending'" variant="panel" :count="2" />
    <ErrorState v-else-if="error || !order" title="Pesanan tidak dapat dimuat" :message="describeApiError(error)" @retry="refresh()" />

    <template v-else-if="order.status !== 'PENDING'">
      <PageHeader
        title="Pembayaran"
        :subtitle="order.status === 'PAYMENT_SUBMITTED' ? 'Bukti pembayaran sudah diterima dan sedang diverifikasi.' : 'Pesanan ini tidak menunggu pembayaran lagi.'"
      />
      <div class="rc-actions">
        <PlayButton :to="`/learn/orders/${order.id}`">Lihat detail pesanan</PlayButton>
      </div>
    </template>

    <ErrorState
      v-else-if="!payment || !instructions"
      title="Instruksi pembayaran belum tersedia"
      message="Instruksi pembayaran untuk pesanan ini belum dapat ditampilkan. Coba lagi beberapa saat."
      @retry="refresh()"
    />

    <template v-else>
      <PageHeader title="Selesaikan pembayaran" :subtitle="`${orderTitle(order.items)} · Pesanan #${order.id.slice(0, 8)}`" />

      <PlayCard as="section" aria-labelledby="summary-h">
        <h2 id="summary-h" class="rc-h2">Ringkasan</h2>
        <dl class="rc-pay__summary">
          <div><dt>Total</dt><dd>{{ formatMoney(instructions.amount, instructions.currency) }}</dd></div>
          <div><dt>Kode referensi</dt><dd>{{ instructions.referenceCode }}</dd></div>
          <div><dt>Batas waktu</dt><dd>{{ formatDateTime(instructions.expiresAt) }}</dd></div>
        </dl>
      </PlayCard>

      <form class="rc-stack" aria-labelledby="proof-h" novalidate @submit.prevent="submit">
        <PlayCard as="fieldset" class="rc-pay__fieldset">
          <legend id="accounts-h" class="rc-h2">Transfer ke</legend>
          <label
            v-for="account in accounts"
            :key="`${account.method}-${account.accountNumber}`"
            class="rc-pay__account"
            :class="{ 'is-selected': selectedMethod === account.method }"
          >
            <input v-model="selectedMethod" type="radio" name="method" :value="account.method" />
            <span class="rc-pay__account-body">
              <span class="rc-hint">{{ account.label }}</span>
              <strong class="rc-pay__number">{{ account.accountNumber }}</strong>
              <span>a.n. {{ account.accountName }}</span>
            </span>
          </label>
        </PlayCard>

        <PlayCard as="section" aria-labelledby="proof-h">
          <h2 id="proof-h" class="rc-h2">Bukti transfer</h2>
          <label class="rc-label" for="proof">
            Unggah bukti (gambar, maksimal 4 MB)
            <input id="proof" type="file" accept="image/*" required class="rc-field" @change="onProofChange" />
          </label>
          <p v-if="proofProblem" class="rc-error-text" role="alert">{{ proofProblem }}</p>

          <label class="rc-label" for="reference">
            Nomor referensi transfer (opsional)
            <input id="reference" v-model="referenceNumber" type="text" maxlength="64" class="rc-field" />
          </label>

          <label class="rc-label" for="note">
            Catatan (opsional)
            <textarea id="note" v-model="note" maxlength="500" rows="2" class="rc-field" />
          </label>

          <p v-if="submitError" class="rc-alert rc-alert--error" role="alert">{{ submitError }}</p>

          <PlayButton type="submit" block :loading="submitting">Kirim bukti pembayaran</PlayButton>
        </PlayCard>
      </form>
    </template>
  </div>
</template>
