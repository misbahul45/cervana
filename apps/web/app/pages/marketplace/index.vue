<script setup lang="ts">
import { marketplaceApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { formatMoney } from '~/lib/format';

definePageMeta({
  title: 'Marketplace — ReduCera',
  protection: { kind: 'public' },
  layout: 'public',
});

useHead({
  title: 'Marketplace — ReduCera',
  meta: [
    { name: 'description', content: 'Marketplace pembelajaran akuntansi dari kreator ReduCera.' },
    { property: 'og:title', content: 'Marketplace — ReduCera' },
    { property: 'og:description', content: 'Temukan artikel dan kelas akuntansi dari kreator ReduCera.' },
  ],
});

const route = useRoute();
const query = computed(() => String(route.query.q ?? '').trim());
const typeFilter = computed(() => (route.query.type === 'ARTIKEL' || route.query.type === 'KELAS' ? route.query.type : 'ALL'));
const searchText = ref(query.value);

interface CatalogItem {
  id: string;
  title: string;
  creator: string | undefined;
  productType: 'ARTIKEL' | 'KELAS';
  difficulty?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  estimatedMinutes?: number;
  priceLabel: string;
  to: string;
}

const { data: products, status, error, refresh } = useAsyncData<CatalogItem[]>(
  'marketplace:catalog',
  async () => {
    const [articles, classes] = await Promise.all([
      marketplaceApi.articles(query.value ? { q: query.value } : {}),
      marketplaceApi.classes(query.value ? { q: query.value } : {}),
    ]);
    const fromArticles: CatalogItem[] = articles.data.map((article) => ({
      id: article.id,
      title: article.title,
      creator: article.author?.name ?? article.tenant?.name,
      productType: 'ARTIKEL',
      priceLabel: article.accessType === 'FREE' ? 'Gratis' : formatMoney(article.price, article.currency),
      to: `/marketplace/articles/${article.id}`,
    }));
    const fromClasses: CatalogItem[] = classes.data.map((cls) => ({
      id: cls.id,
      title: cls.title,
      creator: cls.instructor?.name ?? cls.tenant?.name,
      productType: 'KELAS',
      difficulty: cls.difficulty as CatalogItem['difficulty'],
      estimatedMinutes: cls.durationMinutes ?? undefined,
      priceLabel: cls.accessType === 'FREE' ? 'Gratis' : formatMoney(cls.price, cls.currency),
      to: `/marketplace/classes/${cls.id}`,
    }));
    return [...fromArticles, ...fromClasses];
  },
  { lazy: true, watch: [query] },
);

const visible = computed(() =>
  (products.value ?? []).filter((product) => typeFilter.value === 'ALL' || product.productType === typeFilter.value),
);

function search() {
  navigateTo({ query: { ...route.query, q: searchText.value.trim() || undefined } });
}

function filterType(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  navigateTo({ query: { ...route.query, type: value === 'ALL' ? undefined : value } });
}
</script>

<template>
  <main id="main" aria-labelledby="marketplace-h">
    <header class="rc-marketplace__head">
      <h1 id="marketplace-h">Marketplace</h1>
      <p>Temukan artikel dan kelas akuntansi dari kreator ReduCera.</p>
    </header>

    <form class="rc-marketplace__filters" role="search" aria-label="Filter marketplace" @submit.prevent="search">
      <label>
        Cari
        <input v-model="searchText" type="search" placeholder="Cari judul" aria-label="Cari produk" class="rc-field" />
      </label>
      <label>
        Tipe
        <select :value="typeFilter" aria-label="Tipe produk" class="rc-field" @change="filterType">
          <option value="ALL">Semua</option>
          <option value="ARTIKEL">Artikel</option>
          <option value="KELAS">Kelas</option>
        </select>
      </label>
      <button type="submit" class="rc-btn rc-btn--sm">Cari</button>
    </form>

    <LoadingSkeleton v-if="status === 'pending'" variant="card" :count="3" />
    <ErrorState
      v-else-if="error"
      title="Gagal memuat marketplace"
      :message="describeApiError(error)"
      @retry="refresh()"
    />
    <EmptyState
      v-else-if="visible.length === 0"
      title="Belum ada produk yang cocok"
      message="Coba ubah filter atau cari dengan kata kunci lain."
    />
    <ul v-else class="rc-marketplace__grid">
      <li v-for="p in visible" :key="`${p.productType}-${p.id}`">
        <ProductCard
          :title="p.title"
          :creator="p.creator"
          :product-type="p.productType"
          :difficulty="p.difficulty"
          :estimated-minutes="p.estimatedMinutes"
          :price-label="p.priceLabel"
          :to="p.to"
        />
      </li>
    </ul>
  </main>
</template>

<style scoped>
.rc-marketplace__head { margin-bottom: 1rem; }
.rc-marketplace__head h1 { font-size: 1.5rem; font-weight: 700; }
.rc-marketplace__filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: flex-end;
  margin-bottom: 1rem;
}
.rc-marketplace__filters label {
  display: flex;
  flex-direction: column;
  font-size: 0.75rem;
  color: var(--ui-text-muted);
}
.rc-marketplace__filters input,
.rc-marketplace__filters select {
  padding: 0.5rem;
  border-radius: 0.375rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
  font-size: 0.875rem;
}
.rc-marketplace__filters button {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
  cursor: pointer;
}
.rc-marketplace__grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}
</style>
