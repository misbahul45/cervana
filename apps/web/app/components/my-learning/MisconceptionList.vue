<script setup lang="ts">
defineProps<{ items: Array<{ topicId?: string; conceptKey: string; confidence?: number }> }>();
</script>

<template>
  <ul v-if="items.length > 0">
    <li v-for="item in items" :key="`${item.topicId ?? ''}-${item.conceptKey}`">
      <strong>{{ item.conceptKey }}</strong>
      <span v-if="item.topicId"> pada topik {{ item.topicId }}</span>
      <span v-if="item.confidence !== undefined">
        ({{ Math.round(item.confidence * 100) }}% confidence)
      </span>
    </li>
  </ul>
  <p v-else>Tidak ada miskonsepsi aktif.</p>
</template>