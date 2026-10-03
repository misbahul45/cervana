<script setup lang="ts">
defineProps<{ items: Array<{ achievement: { id: string; title: string; icon?: string }; awardedAt: string }> }>();
</script>

<template>
  <ul class="badge-grid">
    <li v-for="ua in items" :key="ua.achievement.id" class="badge-tile">
      <img v-if="ua.achievement.icon" :src="ua.achievement.icon" :alt="ua.achievement.title" />
      <h3>{{ ua.achievement.title }}</h3>
      <p>Diberikan {{ new Date(ua.awardedAt).toLocaleDateString('id-ID') }}</p>
    </li>
  </ul>
</template>

<style scoped>
.badge-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; padding: 0; }
.badge-tile { list-style: none; padding: 1rem; border: 1px solid var(--rc-border, #d4d4d8); border-radius: 8px; }
</style>