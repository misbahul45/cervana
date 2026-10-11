<script setup lang="ts">
import { computed } from 'vue';
import { renderMarkdown } from '~/lib/markdown';

const props = defineProps<{ text: string }>();

const html = computed(() => renderMarkdown(props.text));
</script>

<template>
  <div class="rc-prose" v-html="html"></div>
</template>

<style>
.rc-prose {
  max-width: 100%;
  color: var(--rc-fg);
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.rc-prose :is(h1, h2, h3, h4) {
  margin: 1.25em 0 0.5em;
}
.rc-prose p,
.rc-prose ul,
.rc-prose ol {
  margin: 0 0 1em;
}
.rc-prose ul,
.rc-prose ol {
  padding-left: 1.5rem;
}
.rc-prose a {
  color: var(--rc-secondary);
  font-weight: 700;
  text-decoration: underline;
}
.rc-prose code {
  padding: 0.125rem 0.375rem;
  border-radius: 6px;
  background-color: var(--rc-foam);
  font-size: 0.9em;
}
.rc-prose pre {
  padding: 1rem;
  overflow-x: auto;
  border: 2px solid var(--rc-border);
  border-radius: var(--rc-radius, 16px);
  background-color: var(--rc-foam);
}
.rc-prose pre code {
  padding: 0;
  background: transparent;
}
.rc-prose blockquote {
  margin: 0 0 1em;
  padding: 0.25rem 1rem;
  border-left: 4px solid var(--rc-border-strong);
  color: var(--rc-muted);
}
.rc-prose table {
  display: block;
  max-width: 100%;
  margin: 0 0 1em;
  overflow-x: auto;
  border-collapse: collapse;
}
.rc-prose :is(th, td) {
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--rc-border);
}
</style>
