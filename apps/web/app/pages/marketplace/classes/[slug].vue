<script setup lang="ts">
interface ClassDetail {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImage: unknown;
  accessType: 'FREE' | 'PAID';
  price: number | null;
  currency: string;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  format: string;
  durationMinutes: number | null;
  capacity: number | null;
  instructor: { id: string; name: string };
  tenant: { id: string; name: string; slug: string; logo: unknown };
  publishedAt: string | null;
}

const route = useRoute();
const user = useState<{ id: string } | null>('user');
const cls = ref<ClassDetail | null>(null);
const error = ref<string | null>(null);
const submitting = ref(false);

async function load() {
  try {
    const res = await $fetch<{ data: ClassDetail }>(
      `/v1/marketplace/classes/${route.params.slug}`,
    );
    cls.value = res.data;
  } catch (err) {
    error.value = 'Kelas tidak ditemukan atau belum terbit.';
    console.error(err);
  }
}

async function purchase() {
  if (!cls.value) return;
  submitting.value = true;
  try {
    const res = await $fetch<{ data: { id: string } }>('/v1/orders', {
      method: 'POST',
      body: { items: [{ classId: cls.value.id, quantity: 1 }] },
    });
    const orderId = res.data.id;
    const intentRes = await $fetch<{ data: { id: string } }>('/v1/payments/intents', {
      method: 'POST',
      body: { orderId },
    });
    await navigateTo(`/learn/orders/${orderId}/pay?intentId=${intentRes.data.id}`);
  } catch (err) {
    error.value = 'Tidak bisa membuat pesanan. Coba lagi.';
    console.error(err);
  } finally {
    submitting.value = false;
  }
}

onMounted(load);

useHead({
  title: () => (cls.value ? `${cls.value.title} | ReduCera` : 'Kelas | ReduCera'),
});
</script>

<template>
  <div class="min-h-screen px-4 py-10 md:py-14 mx-auto max-w-4xl" :style="{ backgroundColor: 'var(--rc-bg)', color: 'var(--rc-fg)' }">
    <div v-if="error" class="p-6 rounded-lg text-center" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
      <p :style="{ color: 'var(--rc-muted)' }">{{ error }}</p>
      <UButton to="/marketplace" color="primary" class="mt-4">Kembali ke Marketplace</UButton>
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
          Pengajar {{ cls.instructor.name }} · {{ cls.tenant.name }}
          <span v-if="cls.durationMinutes"> · {{ cls.durationMinutes }} menit</span>
          <span v-if="cls.publishedAt"> · {{ new Date(cls.publishedAt).toLocaleDateString('id-ID') }}</span>
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
              <template v-else>Rp {{ (cls.price ?? 0).toLocaleString('id-ID') }}</template>
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
            @click="purchase"
          >
            {{ submitting ? 'Memproses…' : (cls.accessType === 'FREE' ? 'Daftar' : 'Beli Sekarang') }}
          </UButton>
        </div>
      </section>
    </article>

    <div v-else class="p-6 rounded-lg text-center" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
      <p :style="{ color: 'var(--rc-muted)' }">Memuat…</p>
    </div>
  </div>
</template>
