<script setup lang="ts">
defineProps<{ mastery: { topicId: string; score: number; attempts: number } }>();
</script>

<template>
  <div class="mastery-row">
    <span class="topic">{{ mastery.topicId }}</span>
    <progress :value="mastery.score" max="1" />
    <span class="attempts">{{ mastery.attempts }} percobaan</span>
  </div>
</template>

<style scoped>
.mastery-row { display: flex; gap: 0.5rem; align-items: center; padding: 0.25rem 0; }
.topic { font-weight: 600; min-width: 12rem; }
.attempts { color: var(--rc-fg-muted, #6b7280); font-size: 0.85rem; }
</style>