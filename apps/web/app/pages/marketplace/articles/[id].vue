<script setup lang="ts">
import MarkdownIt from 'markdown-it';
import { marketplaceApi } from '~/lib/api';
import { describeApiError } from '~/lib/api-error';
import { formatMoney } from '~/lib/format';

definePageMeta({
  title: 'Artikel — ReduCera Marketplace',
  protection: { kind: 'public' },
  layout: 'public',
});

const route = useRoute();
const articleId = computed(() => String(route.params.id || ''));
const user = useState<{ id: string } | null>('user', () => null);

const { data: article, status, error, refresh } = useAsyncData(
  () => `marketplace:article:${articleId.value}`,
  () => marketplaceApi.article(articleId.value),
  { lazy: true, watch: [articleId] },
);

const { data: access } = useAsyncData(
  () => `marketplace:article-access:${articleId.value}`,
  async () => (user.value ? marketplaceApi.articleAccess(articleId.value) : null),
  { lazy: true, watch: [articleId, user] },
);

const { data: content, error: contentError } = useAsyncData(
  () => `marketplace:article-content:${articleId.value}`,
  async () => (access.value?.accessible ? marketplaceApi.articleContent(articleId.value) : null),
  { lazy: true, watch: [access] },
);

const markdown = new MarkdownIt({ html: false, linkify: true });
const renderedContent = computed(() => (content.value ? markdown.render(content.value.content) : ''));

const purchase = usePurchase('ARTICLE', () => articleId.value);

useHead({ title: () => (article.value ? `${article.value.title} | ReduCera` : 'Artikel | ReduCera') });
</script>

<template>
  <main id="main" aria-labelledby="article-h">
    <LoadingSkeleton v-if="status === 'pending'" variant="panel" :count="3" />
    <ErrorState
      v-else-if="error || !article"
      title="Produk tidak ditemukan"
      :message="describeApiError(error, 'Artikel tidak ditemukan atau belum terbit.')"
      @retry="refresh()"
    />
    <template v-else>
      <header class="rc-article__head">
        <p class="rc-article__eyebrow">Artikel</p>
        <h1 id="article-h">{{ article.title }}</h1>
        <p v-if="article.author || article.tenant">
          Oleh {{ article.author?.name ?? article.tenant?.name }}<template v-if="article.tenant && article.author"> · {{ article.tenant.name }}</template>
        </p>
        <p v-if="article.excerpt">{{ article.excerpt }}</p>
      </header>

      <article v-if="content" class="rc-article__panel" aria-label="Isi artikel" v-html="renderedContent" />
      <p v-else-if="contentError" role="alert">{{ describeApiError(contentError, 'Isi artikel tidak dapat dimuat.') }}</p>

      <aside v-if="!access?.accessible" class="rc-article__purchase" aria-label="Aksi pembelian">
        <div>
          <p class="rc-article__price">
            <strong>{{ article.accessType === 'FREE' ? 'Gratis' : formatMoney(article.price, article.currency) }}</strong>
          </p>
          <p v-if="purchase.error.value" role="alert">{{ purchase.error.value }}</p>
        </div>
        <button v-if="article.accessType === 'PAID'" type="button" class="rc-btn rc-btn--lg" :disabled="purchase.buying.value" @click="purchase.buy()">
          {{ purchase.buying.value ? 'Memproses...' : 'Beli dan mulai belajar' }}
        </button>
        <NuxtLink v-else-if="!user" to="/login">Masuk untuk membaca</NuxtLink>
      </aside>
    </template>
  </main>
</template>

<style scoped>
.rc-article__head { margin-bottom: 1.5rem; }
.rc-article__eyebrow {
  font-size: 0.75rem;
  color: var(--ui-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.rc-article__head h1 { font-size: 1.75rem; font-weight: 700; margin: 0.25rem 0; }
.rc-article__panel {
  padding: 1rem;
  border-radius: 0.75rem;
  background: var(--ui-bg, white);
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  margin-bottom: 1rem;
}
.rc-article__purchase {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-radius: 0.75rem;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.05), rgba(124, 58, 237, 0.03));
  border: 1px solid rgba(37, 99, 235, 0.15);
}
.rc-article__price { font-size: 1.25rem; margin: 0 0.5rem 0 0; }
.rc-article__buy {
  padding: 0.625rem 1.25rem;
  border-radius: 0.625rem;
  border: 0;
  background: var(--ui-primary, #2563eb);
  color: var(--ui-primary-fg, white);
  font-weight: 600;
  cursor: pointer;
}
.rc-article__buy:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
