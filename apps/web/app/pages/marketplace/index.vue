<script setup lang="ts">
import MarketplaceCard from '~/components/marketplace/MarketplaceCard.vue';
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import { articleCard, catalogPages, classCard, interleave, SORT_OPTIONS, type CatalogCard } from '~/lib/marketplace';
import EmptyState from '~/components/ui/EmptyState.vue';
import ErrorState from '~/components/ui/ErrorState.vue';
import LoadingSkeleton from '~/components/ui/LoadingSkeleton.vue';
import { marketplaceApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import type { FilterDefs } from '~/lib/query-filters';

definePageMeta({
  title: 'Marketplace — ReduCera',
  protection: { kind: 'public' },
});

useHead({
  title: 'Marketplace — ReduCera',
  meta: [
    { name: 'description', content: 'Artikel dan kelas akuntansi dari kreator ReduCera.' },
    { property: 'og:title', content: 'Marketplace — ReduCera' },
    { property: 'og:description', content: 'Temukan artikel dan kelas akuntansi dari kreator ReduCera.' },
  ],
});

const PAGE_SIZE = 12;

const defs = {
  page: { kind: 'page' },
  q: { kind: 'text', max: 100 },
  type: { kind: 'enum', values: ['article', 'class'] },
  access: { kind: 'enum', values: ['FREE', 'PAID'] },
  sort: { kind: 'enum', values: SORT_OPTIONS.map((option) => option.value) },
} satisfies FilterDefs;

const { filters, set } = useQueryFilters(defs);
const search = ref(String(filters.value.q ?? ''));

watch(
  () => filters.value.q,
  (value) => {
    search.value = String(value ?? '');
  },
);

const { data, status, error, refresh } = useAsyncData(
  'marketplace:catalog',
  async () => {
    const current = filters.value;
    const query = {
      q: current.q || undefined,
      accessType: current.access || undefined,
      sort: current.sort || undefined,
      page: Number(current.page),
      limit: PAGE_SIZE,
    };
    const wantArticles = current.type !== 'class';
    const wantClasses = current.type !== 'article';
    const [articles, classes] = await Promise.all([
      wantArticles ? marketplaceApi.articles(query) : Promise.resolve(undefined),
      wantClasses ? marketplaceApi.classes(query) : Promise.resolve(undefined),
    ]);
    const cards: CatalogCard[] = interleave((articles?.data ?? []).map(articleCard), (classes?.data ?? []).map(classCard));
    return {
      cards,
      page: Number(current.page),
      totalPages: catalogPages(articles?.pagination, classes?.pagination),
      total: (articles?.pagination.total ?? 0) + (classes?.pagination.total ?? 0),
    };
  },
  { lazy: true, watch: [filters] },
);

const cards = computed(() => data.value?.cards ?? []);
const state = computed(() => (data.value ? 'success' : status.value));
const filtered = computed(() => Boolean(filters.value.q || filters.value.type || filters.value.access));

const TYPES = [
  { value: '', label: 'Semua' },
  { value: 'article', label: 'Artikel' },
  { value: 'class', label: 'Kelas' },
] as const;

const ACCESS = [
  { value: '', label: 'Semua harga' },
  { value: 'FREE', label: 'Gratis' },
  { value: 'PAID', label: 'Berbayar' },
] as const;

function clearFilters() {
  search.value = '';
  set({ q: '', type: '', access: '', sort: '' });
}
</script>

<template>
  <div class="rc-stack">
    <PageHeader title="Marketplace" subtitle="Artikel dan kelas akuntansi dari kreator ReduCera." />

    <form class="rc-toolbar" role="search" aria-label="Cari di marketplace" @submit.prevent="set({ q: search })">
      <label class="rc-toolbar__grow">
        Cari judul atau ringkasan
        <input v-model="search" type="search" maxlength="100" class="rc-field" placeholder="Contoh: jurnal penyesuaian" />
      </label>
      <label>
        Urutkan
        <select class="rc-field" :value="filters.sort || 'newest'" @change="set({ sort: ($event.target as HTMLSelectElement).value })">
          <option v-for="option in SORT_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </label>
      <PlayButton type="submit" size="sm">Cari</PlayButton>
    </form>

    <div class="rc-toolbar">
      <div class="rc-segment" role="group" aria-label="Jenis produk">
        <button
          v-for="item in TYPES"
          :key="item.value"
          type="button"
          class="rc-segment__item"
          :aria-pressed="(filters.type || '') === item.value"
          @click="set({ type: item.value })"
        >
          {{ item.label }}
        </button>
      </div>
      <div class="rc-segment" role="group" aria-label="Harga">
        <button
          v-for="item in ACCESS"
          :key="item.value"
          type="button"
          class="rc-segment__item"
          :aria-pressed="(filters.access || '') === item.value"
          @click="set({ access: item.value })"
        >
          {{ item.label }}
        </button>
      </div>
    </div>

    <LoadingSkeleton v-if="state === 'pending' || state === 'idle'" variant="card" :count="6" />
    <ErrorState v-else-if="error && !data" title="Marketplace gagal dimuat" :message="describeApiError(error)" @retry="refresh()" />
    <EmptyState
      v-else-if="cards.length === 0"
      :title="filtered ? 'Tidak ada yang cocok' : 'Belum ada produk'"
      :message="filtered ? 'Coba kata kunci lain atau hapus filter.' : 'Produk dari kreator akan muncul di sini setelah terbit.'"
    />
    <template v-else>
      <ul class="rc-mgrid" aria-label="Hasil marketplace">
        <li v-for="card in cards" :key="`${card.kind}-${card.id}`">
          <MarketplaceCard :card="card" />
        </li>
      </ul>
      <AdminPager
        v-if="data"
        :page="data.page"
        :total-pages="data.totalPages"
        :total="data.total"
        label="Halaman hasil"
        @change="set({ page: $event })"
      />
    </template>

    <p v-if="filtered && cards.length > 0" class="rc-hint">
      <button type="button" class="rc-table__link" @click="clearFilters">Hapus semua filter</button>
    </p>
  </div>
</template>
