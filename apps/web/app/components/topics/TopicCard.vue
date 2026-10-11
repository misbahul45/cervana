<script setup lang="ts">
import { computed } from 'vue';
import TopicCover from '~/components/topics/TopicCover.vue';
import { useHydrated } from '~/composables/useHydrated';
import { useTopicUnlock } from '~/composables/useTopicUnlock';
import type { TopicDetailResponse } from '~/interfaces/curriculum/topics';
import { plainText, priceLabel, visibleCategories } from '~/lib/topics';

const props = defineProps<{ topic: TopicDetailResponse<true> }>();

const { hasAccess, open, pending } = useTopicUnlock();
const hydrated = useHydrated();

const titleId = computed(() => `topic-${props.topic.id}`);
const detailTo = computed(() => `/learn/topics/${props.topic.slug}/detail`);
const summary = computed(() => plainText(props.topic.description, 110));
const categories = computed(() => visibleCategories(props.topic.categories, 2));
const teacherName = computed(() => props.topic.teacher?.name?.trim() || 'Tanpa nama');
const teacherInitial = computed(() => teacherName.value.charAt(0).toUpperCase());
const free = computed(() => props.topic.price === 0);
const owned = computed(() => hydrated.value && hasAccess(props.topic.id));
const actionLabel = computed(() => (owned.value ? 'Belajar' : free.value ? 'Mulai gratis' : 'Beli topik'));
</script>

<template>
  <article class="rc-card rc-topic" :aria-labelledby="titleId">
    <div class="rc-topic__media">
      <TopicCover :src="topic.image?.url" :title="topic.title" />
      <span class="rc-chip rc-topic__price" :class="{ 'rc-chip--success': free }">{{ priceLabel(topic.price) }}</span>
    </div>

    <div class="rc-topic__body">
      <h3 :id="titleId" class="rc-topic__title">
        <NuxtLink :to="detailTo" class="rc-topic__link">{{ topic.title }}</NuxtLink>
      </h3>
      <p v-if="summary" class="rc-topic__summary">{{ summary }}</p>
      <ul v-if="categories.shown.length" class="rc-topic__cats">
        <li v-for="category in categories.shown" :key="category.id" class="rc-topic__cat">{{ category.name }}</li>
        <li v-if="categories.hidden" class="rc-topic__cat">+{{ categories.hidden }}</li>
      </ul>
      <p class="rc-topic__teacher">
        <span class="rc-topic__avatar" aria-hidden="true">{{ teacherInitial }}</span>
        <span class="rc-topic__teacher-name">{{ teacherName }}</span>
      </p>
    </div>

    <div class="rc-topic__actions">
      <PlayButton :to="detailTo" variant="outline" size="sm">Detail</PlayButton>
      <PlayButton size="sm" :variant="owned ? 'secondary' : 'primary'" :loading="pending" @click="open(topic)">
        {{ actionLabel }}
      </PlayButton>
    </div>
  </article>
</template>

<style>
.rc-card.rc-topic {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  padding: 0;
  overflow: hidden;
  transition: transform 90ms ease-out, background-color 120ms ease-out;
}
.rc-card.rc-topic:hover {
  background-color: var(--rc-foam);
}
.rc-card.rc-topic:focus-within {
  outline: 3px solid var(--rc-focus);
  outline-offset: 3px;
}
.rc-topic__media {
  position: relative;
  border-bottom: 2px solid var(--rc-border);
}
.rc-topic__price {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  background-color: var(--rc-surface);
}
.rc-topic__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.625rem;
  min-width: 0;
  padding: 1rem 1rem 0.5rem;
}
.rc-topic__title {
  margin: 0;
  font-size: 1.0625rem;
  line-height: 1.3;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.rc-topic__link {
  color: inherit;
  text-decoration: none;
}
.rc-topic__link::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
}
.rc-topic__link:focus-visible {
  outline: none;
}
.rc-topic__summary {
  margin: 0;
  color: var(--rc-muted);
  font-size: 0.875rem;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.rc-topic__cats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.rc-topic__cat {
  padding: 0.125rem 0.625rem;
  border: 2px solid var(--rc-border);
  border-radius: 999px;
  color: var(--rc-muted);
  font-size: 0.75rem;
  font-weight: 800;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rc-topic__teacher {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  margin: auto 0 0;
  color: var(--rc-muted);
  font-size: 0.8125rem;
  font-weight: 700;
}
.rc-topic__avatar {
  display: grid;
  flex: none;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--rc-secondary) 18%, var(--rc-surface));
  color: var(--rc-secondary);
  font-size: 0.8125rem;
  font-weight: 900;
}
.rc-topic__teacher-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rc-topic__actions {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem 1rem 1rem;
}
.rc-topic__actions > * {
  flex: 1 1 7rem;
}
</style>
