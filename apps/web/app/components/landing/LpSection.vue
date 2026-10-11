<script setup lang="ts">
defineProps<{ id: string; title: string; lead?: string }>();
</script>

<template>
  <section :id="id" class="lp-section" :aria-labelledby="`${id}-title`">
    <div class="lp-container">
      <h2 :id="`${id}-title`" class="lp-section__title">{{ title }}</h2>
      <p v-if="lead" class="lp-section__lead">{{ lead }}</p>
      <slot />
    </div>
  </section>
</template>
