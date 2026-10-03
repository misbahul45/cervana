<script setup lang="ts">
defineProps<{
  topic: { id: string; title: string };
  state?: 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'MASTERED';
  mastery?: number;
}>();
</script>

<template>
  <li :class="`skill-leaf skill-leaf--${state ?? 'AVAILABLE'}`">
    <NuxtLink :to="state === 'LOCKED' ? '' : `/my-learning/topics/${topic.id}`">
      <h3>{{ topic.title }}</h3>
      <span class="state-label">{{ state ?? 'AVAILABLE' }}</span>
      <progress v-if="mastery !== undefined" :value="mastery" max="1" />
    </NuxtLink>
  </li>
</template>

<style scoped>
.skill-leaf { list-style: none; padding: 0.5rem; border-bottom: 1px solid var(--rc-border, #e5e7eb); }
.skill-leaf--LOCKED a { pointer-events: none; opacity: 0.5; }
.skill-leaf--MASTERED a { color: var(--theme-mastered, #16a34a); font-weight: 700; }
.skill-leaf--IN_PROGRESS a { color: var(--theme-in-progress, #ca8a04); }
.skill-leaf--AVAILABLE a { color: var(--theme-available, #2563eb); }
</style>