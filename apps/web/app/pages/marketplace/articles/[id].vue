<script setup lang="ts">
import PlayButton from '~/components/play/PlayButton.vue';
import { marketplaceApi } from '~/lib/api';
import { describeApiError, isApiError } from '~/lib/api-error';
import { articleSubtitle, bylineParts, estimateMinutes, paywallKind } from '~/lib/article';
import { formatDate } from '~/lib/format';
import { priceText } from '~/lib/marketplace';
import { renderMarkdown } from '~/lib/markdown';
import { loginHref } from '~/lib/next-path';

definePageMeta({
  title: 'Artikel — ReduCera',
  protection: { kind: 'public' },
  layout: 'reader',
});

const FONT_PATHS = [
  '/fonts/source-serif/SourceSerif4-latin-wght-normal.woff2',
  '/fonts/source-serif/SourceSerif4-latin-wght-italic.woff2',
];

const route = useRoute();
const articleId = computed(() => String(route.params.id || ''));
const user = useState<{ id: string } | null>('user', () => null);
const userKey = computed(() => user.value?.id ?? 'guest');

const { data: loaded, refresh } = await useAsyncData(
  () => `marketplace:article:${articleId.value}`,
  async () => {
    try {
      return { ok: true as const, article: await marketplaceApi.article(articleId.value) };
    } catch (err) {
      return {
        ok: false as const,
        missing: isApiError(err) && err.kind === 'not_found',
        message: describeApiError(err, 'Artikel tidak dapat dimuat.'),
      };
    }
  },
  { watch: [articleId] },
);

async function readFull(id: string) {
  try {
    const access = await marketplaceApi.articleAccess(id);
    return access.accessible ? await marketplaceApi.articleContent(id) : null;
  } catch {
    return null;
  }
}

async function readPreview(id: string) {
  try {
    return await marketplaceApi.articlePreview(id);
  } catch {
    return null;
  }
}

const { data: reading } = await useAsyncData(
  () => `marketplace:article-read:${articleId.value}:${userKey.value}`,
  async () => {
    const id = articleId.value;
    const full = user.value ? await readFull(id) : null;
    if (full) return { full: true, truncated: false, text: full.content, minutes: estimateMinutes(full.content) };
    const preview = await readPreview(id);
    return preview ? { full: false, truncated: preview.truncated, text: preview.preview, minutes: preview.readingMinutes } : null;
  },
  { watch: [articleId, userKey] },
);

const article = computed(() => (loaded.value?.ok ? loaded.value.article : null));
const missing = computed(() => loaded.value?.ok === false && loaded.value.missing);

if (import.meta.server && missing.value) setResponseStatus(useRequestEvent(), 404);

const html = computed(() => renderMarkdown(reading.value?.text));
const subtitle = computed(() => articleSubtitle(article.value?.excerpt));
const byline = computed(() =>
  article.value
    ? bylineParts({
        author: article.value.author?.name,
        tenant: article.value.tenant?.name,
        publishedLabel: formatDate(article.value.publishedAt),
        minutes: reading.value?.minutes,
      })
    : [],
);

const wall = computed(() =>
  article.value
    ? paywallKind({
        fullAccess: Boolean(reading.value?.full) || reading.value?.truncated === false,
        signedIn: Boolean(user.value),
        accessType: article.value.accessType,
      })
    : 'none',
);

const price = computed(() => (article.value ? priceText(article.value.accessType, article.value.price, article.value.currency) : ''));
const purchase = usePurchase('ARTICLE', () => articleId.value);
const hasPreview = computed(() => html.value.length > 0);

useHead({
  title: () => (article.value ? `${article.value.title} — ReduCera` : 'Artikel — ReduCera'),
  link: FONT_PATHS.map((href) => ({ rel: 'preload', as: 'font', type: 'font/woff2', href, crossorigin: 'anonymous' })),
  meta: [
    { name: 'description', content: () => subtitle.value || article.value?.title || 'Artikel akuntansi di ReduCera' },
    { property: 'og:type', content: 'article' },
    { property: 'og:title', content: () => article.value?.title ?? 'Artikel — ReduCera' },
    { property: 'og:description', content: () => subtitle.value },
    { property: 'og:image', content: () => article.value?.coverImage?.url ?? '' },
  ],
});
</script>

<template>
  <article v-if="article" class="rc-story" aria-labelledby="story-title">
    <header class="rc-story__head">
      <h1 id="story-title" class="rc-story__title">{{ article.title }}</h1>
      <p v-if="subtitle" class="rc-story__subtitle">{{ subtitle }}</p>
      <ul v-if="byline.length" class="rc-story__byline" aria-label="Info artikel">
        <li v-for="(part, index) in byline" :key="part">
          <strong v-if="index === 0 && article.author?.id && user"><NuxtLink :to="`/creators/${article.author.id}`" class="rc-story__author">{{ part }}</NuxtLink></strong>
          <strong v-else-if="index === 0">{{ part }}</strong>
          <template v-else>{{ part }}</template>
        </li>
        <li v-if="article.accessType === 'PAID'">Artikel premium</li>
      </ul>
    </header>

    <figure v-if="article.coverImage?.url" class="rc-story__cover">
      <img :src="article.coverImage.url" alt="" width="1280" height="720" decoding="async" fetchpriority="high" />
    </figure>

    <div v-if="hasPreview" class="rc-story__preview">
      <div class="rc-story__body" :class="{ 'rc-story__body--faded': wall !== 'none' }" aria-label="Isi artikel" v-html="html" />
      <div v-if="wall !== 'none'" class="rc-story__fade" aria-hidden="true" />
    </div>
    <p v-else class="rc-wall__hint" role="status">Isi artikel belum tersedia.</p>

    <section v-if="wall !== 'none'" class="rc-wall" aria-labelledby="wall-title">
      <template v-if="wall === 'purchase'">
        <h2 id="wall-title" class="rc-wall__title">Lanjutkan membaca</h2>
        <p class="rc-wall__text">Beli artikel ini untuk membaca sisanya. Akses terbuka setelah pembayaranmu diverifikasi.</p>
        <p class="rc-wall__price">{{ price }}</p>
        <div class="rc-wall__actions">
          <PlayButton :loading="purchase.buying.value" @click="purchase.buy()">Beli artikel ini</PlayButton>
        </div>
        <p v-if="purchase.error.value" class="rc-alert rc-alert--error" role="alert">{{ purchase.error.value }}</p>
      </template>
      <template v-else>
        <h2 id="wall-title" class="rc-wall__title">{{ article.accessType === 'PAID' ? 'Masuk untuk membeli' : 'Masuk untuk membaca selengkapnya' }}</h2>
        <p class="rc-wall__text">
          {{ article.accessType === 'PAID' ? 'Buat akun atau masuk, lalu beli artikel ini untuk membaca sisanya.' : 'Artikel ini gratis. Masuk dengan akunmu untuk membaca sampai selesai.' }}
        </p>
        <p v-if="article.accessType === 'PAID'" class="rc-wall__price">{{ price }}</p>
        <div class="rc-wall__actions">
          <PlayButton :to="loginHref(route.fullPath)">Masuk</PlayButton>
          <PlayButton to="/register" variant="secondary">Daftar gratis</PlayButton>
        </div>
      </template>
    </section>
  </article>

  <div v-else-if="loaded" class="rc-story__missing">
    <h1 class="rc-wall__title">{{ missing ? 'Artikel tidak ditemukan' : 'Artikel gagal dimuat' }}</h1>
    <p class="rc-wall__text">
      {{ missing ? 'Artikel ini belum terbit atau sudah tidak tersedia.' : loaded.ok ? '' : loaded.message }}
    </p>
    <div class="rc-wall__actions">
      <PlayButton v-if="!missing" variant="secondary" @click="refresh()">Coba lagi</PlayButton>
      <PlayButton to="/marketplace">Kembali ke marketplace</PlayButton>
    </div>
  </div>
</template>
