<script setup lang="ts">
interface Citation {
  source: string;
  snippet: string;
  lessonId?: string;
}

interface Props {
  citations?: Citation[];
}

defineProps<Props>();
</script>

<template>
  <aside
    v-if="citations && citations.length > 0"
    class="rc-citation-list"
    aria-labelledby="rc-citation-list-heading"
  >
    <h3 id="rc-citation-list-heading" class="rc-citation-list__title">Sumber</h3>
    <ol class="rc-citation-list__items">
      <li v-for="(cite, i) in citations" :key="i" class="rc-citation-list__item">
        <a
          v-if="cite.lessonId"
          :href="`/my-learning/lessons/${cite.lessonId}`"
          class="rc-citation-list__link"
        >
          <span class="rc-citation-list__source">{{ cite.source }}</span>
          <span class="rc-citation-list__snippet">"{{ cite.snippet }}"</span>
        </a>
        <div v-else>
          <span class="rc-citation-list__source">{{ cite.source }}</span>
          <span class="rc-citation-list__snippet">"{{ cite.snippet }}"</span>
        </div>
      </li>
    </ol>
  </aside>
</template>

<style scoped>
.rc-citation-list {
  padding: 1rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  border-radius: 0.5rem;
  background: var(--ui-bg-elevated, transparent);
}
.rc-citation-list__title {
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ui-text-muted);
  margin-bottom: 0.5rem;
}
.rc-citation-list__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}
.rc-citation-list__item {
  border-left: 3px solid var(--ui-primary, #2563eb);
  padding-left: 0.75rem;
}
.rc-citation-list__link {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  color: var(--ui-text);
  text-decoration: none;
}
.rc-citation-list__link:hover {
  text-decoration: underline;
}
.rc-citation-list__source {
  font-size: 0.875rem;
  font-weight: 600;
}
.rc-citation-list__snippet {
  font-size: 0.875rem;
  color: var(--ui-text-muted);
}
</style>