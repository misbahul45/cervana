<script setup lang="ts">
import TopicCover from '~/components/topics/TopicCover.vue';
import type { CatalogCard } from '~/lib/marketplace';

defineProps<{ card: CatalogCard }>();

const titleId = useId();
</script>

<template>
  <article class="rc-card rc-mcard" :aria-labelledby="titleId">
    <div class="rc-mcard__media">
      <TopicCover :src="card.coverUrl" :title="card.title" />
    </div>
    <div class="rc-mcard__body">
      <p class="rc-mcard__meta">{{ card.meta }}</p>
      <h3 :id="titleId" class="rc-mcard__title">
        <NuxtLink :to="card.to" class="rc-mcard__link">{{ card.title }}</NuxtLink>
      </h3>
      <p v-if="card.summary" class="rc-mcard__summary">{{ card.summary }}</p>
      <div class="rc-mcard__foot">
        <span class="rc-mcard__creator">{{ card.creator }}</span>
        <span class="rc-chip" :class="{ 'rc-chip--success': card.free }">{{ card.priceLabel }}</span>
      </div>
    </div>
  </article>
</template>
