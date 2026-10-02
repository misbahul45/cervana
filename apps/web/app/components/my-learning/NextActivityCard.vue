<script setup lang="ts">
import type { NextActivityDecision } from '~/interfaces/sandbox';

defineProps<{ decision: NextActivityDecision | null }>();
</script>

<template>
  <div v-if="decision" class="next-card">
    <h3>Topik {{ decision.topicId }}</h3>
    <p>Level {{ decision.level }} · {{ decision.rationaleKind }}</p>
    <NuxtLink :to="`/my-learning/topics/${decision.topicId}`">Mulai aktivitas</NuxtLink>
  </div>
  <p v-else>Tidak ada rekomendasi saat ini.</p>
</template>