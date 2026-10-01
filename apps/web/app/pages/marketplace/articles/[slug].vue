<script setup lang="ts">
interface ArticleDetail {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: unknown;
  accessType: 'FREE' | 'PAID';
  price: number | null;
  currency: string;
  author: { id: string; name: string };
  tenant: { id: string; name: string; slug: string; logo: unknown };
  category: { id: string; name: string } | null;
  publishedAt: string | null;
}

interface AccessCheck {
  accessible: boolean;
  reason: 'FREE' | 'ENTITLED' | 'ENTITLEMENT_REQUIRED';
}

const route = useRoute();
const user = useState<{ id: string } | null>('user');
const article = ref<ArticleDetail | null>(null);
const access = ref<AccessCheck | null>(null);
const error = ref<string | null>(null);
const submitting = ref(false);

async function load() {
  try {
    const res = await $fetch<{ data: ArticleDetail }>(
      `/v1/marketplace/articles/${route.params.slug}`,
    );
    article.value = res.data;
    if (user.value) {
      const accessRes = await $fetch<{ data: AccessCheck }>(
        `/v1/marketplace/articles/${article.value.id}/access`,
      );
      access.value = accessRes.data;
    }
  } catch (err) {
    error.value = 'Materi tidak ditemukan atau belum terbit.';
    console.error(err);
  }
}

async function purchase() {
  if (!article.value) return;
  submitting.value = true;
  try {
    const res = await $fetch<{ data: { id: string } }>('/v1/orders', {
      method: 'POST',
      body: { items: [{ articleId: article.value.id, quantity: 1 }] },
    });
    const orderId = res.data.id;
    const intentRes = await $fetch<{ data: { id: string } }>(`/v1/payments/intents`, {
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
  title: () => (article.value ? `${article.value.title} | ReduCera` : 'Materi | ReduCera'),
});
</script>

<template>
  <div class="min-h-screen px-4 py-10 md:py-14 mx-auto max-w-4xl" :style="{ backgroundColor: 'var(--rc-bg)', color: 'var(--rc-fg)' }">
    <div v-if="error" class="p-6 rounded-lg text-center" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
      <p :style="{ color: 'var(--rc-muted)' }">{{ error }}</p>
      <UButton to="/marketplace" color="primary" class="mt-4">Kembali ke Marketplace</UButton>
    </div>

    <article v-else-if="article">
      <header class="mb-8">
        <span
          v-if="article.category"
          class="inline-block px-2 py-0.5 text-xs rounded-full uppercase tracking-wide mb-3"
          :style="{ backgroundColor: 'var(--rc-foam)', color: 'var(--rc-primary)' }"
        >
          {{ article.category.name }}
        </span>
        <h1 class="text-3xl md:text-4xl font-bold" :style="{ color: 'var(--rc-fg)' }">{{ article.title }}</h1>
        <p class="mt-3 text-sm" :style="{ color: 'var(--rc-muted)' }">
          oleh {{ article.author.name }} · {{ article.tenant.name }}
          <span v-if="article.publishedAt"> · {{ new Date(article.publishedAt).toLocaleDateString('id-ID') }}</span>
        </p>
        <p v-if="article.excerpt" class="mt-4 text-base leading-relaxed" :style="{ color: 'var(--rc-fg)' }">
          {{ article.excerpt }}
        </p>
      </header>

      <section class="p-6 rounded-xl" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
        <h2 class="text-lg font-semibold" :style="{ color: 'var(--rc-fg)' }">Akses Materi</h2>
        <div v-if="access?.accessible" class="mt-3" :style="{ color: 'var(--rc-primary)' }">
          ✓ Anda sudah memiliki akses. <NuxtLink :to="`/learn/articles/${article.slug}`" class="underline">Baca sekarang</NuxtLink>
        </div>
        <div v-else class="mt-4 flex items-center justify-between">
          <div>
            <p class="text-2xl font-mono">
              <template v-if="article.accessType === 'FREE'">Gratis</template>
              <template v-else>Rp {{ (article.price ?? 0).toLocaleString('id-ID') }}</template>
            </p>
            <p class="text-xs mt-1" :style="{ color: 'var(--rc-muted)' }">
              {{ article.accessType === 'FREE' ? 'Tidak perlu pembayaran' : `Pembayaran manual via transfer bank` }}
            </p>
          </div>
          <UButton
            color="primary"
            size="lg"
            :disabled="submitting"
            @click="purchase"
          >
            {{ submitting ? 'Memproses…' : (article.accessType === 'FREE' ? 'Mulai Baca' : 'Beli Sekarang') }}
          </UButton>
        </div>
      </section>
    </article>

    <div v-else class="p-6 rounded-lg text-center" :style="{ backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }">
      <p :style="{ color: 'var(--rc-muted)' }">Memuat…</p>
    </div>
  </div>
</template>
