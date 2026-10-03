<script setup lang="ts">
defineProps<{ badges: Array<{ id: string; title: string; description?: string }> }>();
</script>

<template>
  <transition name="fade">
    <section v-if="badges.length > 0" class="badge-toast" role="status">
      <h2>Selamat! Badge baru:</h2>
      <ul>
        <li v-for="b in badges" :key="b.id">
          <strong>{{ b.title }}</strong>
          <p v-if="b.description">{{ b.description }}</p>
        </li>
      </ul>
    </section>
  </transition>
</template>

<style scoped>
.badge-toast {
  background: var(--rc-bg-elevated, #fff7e6);
  border: 1px solid var(--rc-border, #f4b400);
  border-radius: 8px;
  padding: 1rem;
}
@media (prefers-reduced-motion: reduce) {
  .badge-toast { transition: none; }
}
</style>