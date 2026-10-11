<script setup lang="ts">
import type { AiFact } from '~/lib/ai-stages';

defineProps<{
  facts: AiFact[];
  animated?: boolean;
}>();
</script>

<template>
  <TransitionGroup v-if="animated" tag="ul" name="rc-ai-pop" class="rc-ai-facts">
    <li v-for="fact in facts" :key="fact.key" class="rc-ai-fact" :data-tone="fact.tone">{{ fact.text }}</li>
  </TransitionGroup>
  <ul v-else class="rc-ai-facts">
    <li v-for="fact in facts" :key="fact.key" class="rc-ai-fact" :data-tone="fact.tone">{{ fact.text }}</li>
  </ul>
</template>

<style>
.rc-ai-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.rc-ai-fact {
  padding: 0.25rem 0.75rem;
  border: 2px solid color-mix(in srgb, var(--rc-primary) 45%, var(--rc-border));
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--rc-primary) 9%, var(--rc-surface));
  color: var(--rc-fg);
  font-size: 0.8125rem;
  font-weight: 800;
  line-height: 1.4;
}
.rc-ai-fact[data-tone='muted'] {
  border-color: var(--rc-border);
  background-color: var(--rc-foam);
  color: var(--rc-muted);
}
.rc-ai-fact[data-tone='warn'] {
  border-color: color-mix(in srgb, var(--rc-warning) 70%, var(--rc-border));
  background-color: color-mix(in srgb, var(--rc-warning) 12%, var(--rc-surface));
}
.rc-ai-pop-enter-active {
  transition:
    opacity 0.35s ease,
    transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.rc-ai-pop-enter-from {
  opacity: 0;
  transform: translateY(0.5rem) scale(0.8);
}
@media (prefers-reduced-motion: reduce) {
  .rc-ai-pop-enter-active {
    transition: none;
  }
}
</style>
