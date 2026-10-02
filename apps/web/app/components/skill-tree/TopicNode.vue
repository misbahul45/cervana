<script setup lang="ts">
import type { SandboxGraphTopic } from '~/interfaces/sandbox';

defineProps<{ topic: SandboxGraphTopic }>();
</script>

<template>
  <li :class="`topic ${topic.prerequisites.length > 0 ? 'topic--gated' : 'topic--open'}`">
    <h3>{{ topic.title }}</h3>
    <p v-if="topic.estimatedMinutes">{{ topic.estimatedMinutes }} menit</p>
    <p v-if="topic.prerequisites.length" class="prereqs">
      Prasyarat: {{ topic.prerequisites.join(', ') }}
    </p>
  </li>
</template>

<style scoped>
.topic { padding: 0.5rem 0; border-bottom: 1px solid var(--rc-border, #e5e7eb); }
.topic:last-child { border-bottom: none; }
.topic--gated { color: var(--rc-fg-muted, #6b7280); }
.topic--open { color: var(--rc-fg, #111827); }
.prereqs { font-size: 0.85rem; opacity: 0.7; }
</style>