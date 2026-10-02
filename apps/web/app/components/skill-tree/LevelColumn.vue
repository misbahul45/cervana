<script setup lang="ts">
import type { SandboxGraphLevel } from '~/interfaces/sandbox';

defineProps<{ level: SandboxGraphLevel }>();
</script>

<template>
  <section :class="`level level--${level.id}`">
    <h2>{{ level.title }}</h2>
    <ul>
      <TopicNode v-for="topic in level.topics" :key="topic.id" :topic="topic" />
    </ul>
  </section>
</template>

<style scoped>
.level {
  border: 1px solid var(--rc-border, #d4d4d8);
  border-radius: 8px;
  padding: 1rem;
  background: var(--rc-bg, #fafafa);
}
.level ul {
  list-style: none;
  padding: 0;
}
</style>