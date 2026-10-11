<script setup lang="ts">
import MarketplaceCard from '~/components/marketplace/MarketplaceCard.vue';
import PageHeader from '~/components/play/PageHeader.vue';
import PlayButton from '~/components/play/PlayButton.vue';
import LoadingSkeleton from '~/components/ui/LoadingSkeleton.vue';
import type { CreatorProfileView } from '~/interfaces/commerce';
import { creatorApi } from '~/lib/api';
import { describeApiError, isApiError } from '~/lib/api-error';
import { creatorCards, externalUrl } from '~/lib/marketplace';

definePageMeta({
  title: 'Kreator — ReduCera',
  protection: { kind: 'authenticated' },
});

const route = useRoute();
const creatorId = computed(() => String(route.params.id || ''));

const { data: loaded, status, refresh } = await useAsyncData(
  () => `creator:${creatorId.value}`,
  async () => {
    try {
      const profile = (await creatorApi.profile(creatorId.value)) as unknown as CreatorProfileView | null;
      if (!profile) return { ok: false as const, missing: true, message: 'Kreator tidak ditemukan.' };
      return { ok: true as const, profile };
    } catch (err) {
      return {
        ok: false as const,
        missing: isApiError(err) && err.kind === 'not_found',
        message: describeApiError(err, 'Profil kreator tidak dapat dimuat.'),
      };
    }
  },
  { watch: [creatorId] },
);

const profile = computed(() => (loaded.value?.ok ? loaded.value.profile : null));
const cards = computed(() => (profile.value ? creatorCards(profile.value) : []));
const portfolio = computed(() => externalUrl(profile.value?.portfolioUrl));

if (import.meta.server && loaded.value?.ok === false && loaded.value.missing) setResponseStatus(useRequestEvent(), 404);

useHead({ title: () => (profile.value ? `${profile.value.fullName} — ReduCera` : 'Kreator — ReduCera') });
</script>

<template>
  <div class="rc-stack">
    <LoadingSkeleton v-if="status === 'pending' && !loaded" variant="panel" :count="2" />

    <template v-else-if="profile">
      <PageHeader :title="profile.fullName" :subtitle="profile.bio ?? undefined" />
      <p v-if="portfolio">
        <a :href="portfolio" target="_blank" rel="noopener noreferrer" class="rc-cdetail__link">Lihat portofolio</a>
      </p>

      <section v-if="cards.length" aria-labelledby="creator-products">
        <h2 id="creator-products" class="rc-h2">Karya kreator</h2>
        <ul class="rc-mgrid" aria-label="Artikel dan kelas kreator">
          <li v-for="card in cards" :key="`${card.kind}-${card.id}`">
            <MarketplaceCard :card="card" />
          </li>
        </ul>
      </section>
      <p v-else class="rc-hint">Kreator ini belum punya artikel atau kelas yang terbit.</p>

      <section v-if="profile.badges.length" aria-labelledby="creator-badges">
        <h2 id="creator-badges" class="rc-h2">Pencapaian</h2>
        <ul class="rc-cdetail__list">
          <li v-for="badge in profile.badges" :key="badge.id" class="rc-card">
            <p class="rc-cdetail__when">{{ badge.title }}</p>
            <p v-if="badge.description" class="rc-hint">{{ badge.description }}</p>
          </li>
        </ul>
      </section>
    </template>

    <template v-else>
      <PageHeader
        :title="loaded?.ok === false && loaded.missing ? 'Kreator tidak ditemukan' : 'Kreator gagal dimuat'"
        :subtitle="loaded?.ok === false && !loaded.missing ? loaded.message : 'Profil ini belum tersedia.'"
      />
      <div class="rc-actions">
        <PlayButton v-if="loaded?.ok === false && !loaded.missing" variant="secondary" @click="refresh()">Coba lagi</PlayButton>
        <PlayButton to="/marketplace">Ke marketplace</PlayButton>
      </div>
    </template>
  </div>
</template>
