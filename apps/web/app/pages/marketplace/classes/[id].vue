<script setup lang="ts">
import { marketplaceApi } from '~/lib/api';
import { describeApiError, isApiError } from '~/lib/api-error';
import { formatDate, formatMoney } from '~/lib/format';

definePageMeta({
  title: 'Kelas — ReduCera Marketplace',
  protection: { kind: 'public' },
  layout: 'public',
});

const route = useRoute();
const classId = computed(() => String(route.params.id || ''));
const user = useState<{ id: string } | null>('user', () => null);

const { data: cls, status, error: loadError, refresh } = useAsyncData(
  () => `marketplace:class:${classId.value}`,
  () => marketplaceApi.class(classId.value),
  { lazy: true, watch: [classId] },
);

const purchase = usePurchase('CLASS', () => classId.value);
const enrolling = ref(false);
const enrollError = ref<string | null>(null);
const enrolled = ref(false);
const submitting = computed(() => purchase.buying.value || enrolling.value);
const error = computed(() => (loadError.value ? describeApiError(loadError.value, 'Kelas tidak ditemukan atau belum terbit.') : purchase.error.value ?? enrollError.value));

async function enroll() {
  if (enrolling.value) return;
  if (!user.value) {
    await navigateTo('/login');
    return;
  }
  enrolling.value = true;
  enrollError.value = null;
  try {
    await marketplaceApi.enrollFreeClass(classId.value);
    enrolled.value = true;
  } catch (err) {
    if (isApiError(err) && err.kind === 'unauthorized') {
      await navigateTo('/login');
      return;
    }
    enrollError.value = describeApiError(err, 'Tidak bisa mendaftar ke kelas. Coba lagi.');
  } finally {
    enrolling.value = false;
  }
}

function act() {
  if (!cls.value) return Promise.resolve();
  return cls.value.accessType === 'FREE' ? enroll() : purchase.buy();
}

useHead({
  title: () => (cls.value ? `${cls.value.title} | ReduCera` : 'Kelas | ReduCera'),
});
</script>
<template>
  <div class="min-h-screen px-4 py-10 md:py-14 mx-auto max-w-4xl" :style="{ backgroundColor: 'var(--rc-bg)', color: 'var(--rc-fg)' }">
    <div v-if="loadError" class="p-6 rounded-lg text-center" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
      <p :style="{ color: 'var(--rc-muted)' }">{{ error }}</p>
      <UButton color="primary" class="mt-4" @click="refresh()">Coba lagi</UButton>
      <UButton to="/marketplace" variant="outline" class="mt-4">Kembali ke Marketplace</UButton>
    </div>

    <article v-else-if="cls">
      <header class="mb-8">
        <span
          class="inline-block px-2 py-0.5 text-xs rounded-full uppercase tracking-wide mb-3"
          :style="{ backgroundColor: 'var(--rc-foam)', color: 'var(--rc-primary)' }"
        >
          Kelas · {{ cls.difficulty.toLowerCase() }} · {{ cls.format.toLowerCase() }}
        </span>
        <h1 class="text-3xl md:text-4xl font-bold" :style="{ color: 'var(--rc-fg)' }">{{ cls.title }}</h1>
        <p class="mt-3 text-sm" :style="{ color: 'var(--rc-muted)' }">
          Pengajar {{ cls.instructor?.name ?? '-' }} · {{ cls.tenant?.name ?? '-' }}
          <span v-if="cls.durationMinutes"> · {{ cls.durationMinutes }} menit</span>
          <span v-if="cls.publishedAt"> · {{ formatDate(cls.publishedAt) }}</span>
        </p>
        <p v-if="cls.description" class="mt-4 text-base leading-relaxed" :style="{ color: 'var(--rc-fg)' }">
          {{ cls.description }}
        </p>
      </header>

      <section class="p-6 rounded-xl" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-2xl font-mono">
              <template v-if="cls.accessType === 'FREE'">Gratis</template>
              <template v-else>{{ formatMoney(cls.price, cls.currency) }}</template>
            </p>
            <p class="text-xs mt-1" :style="{ color: 'var(--rc-muted)' }">
              {{ cls.accessType === 'FREE' ? 'Tidak perlu pembayaran' : 'Pembayaran manual via transfer bank' }}
            </p>
            <p v-if="cls.capacity" class="text-xs mt-1" :style="{ color: 'var(--rc-muted)' }">
              Kapasitas: {{ cls.capacity }} peserta
            </p>
          </div>
          <UButton
            color="primary"
            size="lg"
            :disabled="submitting"
            @click="act"
          >
            {{ submitting ? 'Memproses…' : (cls.accessType === 'FREE' ? 'Daftar' : 'Beli Sekarang') }}
          </UButton>
        </div>
        <p v-if="enrolled" class="mt-3 text-sm" role="status">Pendaftaran berhasil. Kelas ada di daftar kelas Anda.</p>
        <p v-else-if="purchase.error.value || enrollError" class="mt-3 text-sm" role="alert">{{ purchase.error.value ?? enrollError }}</p>
      </section>
    </article>

    <LoadingSkeleton v-else-if="status === 'pending'" variant="panel" :count="2" />
  </div>
</template>
