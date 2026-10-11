<script setup lang="ts">
defineProps<{ message?: string; tone?: 'error' | 'success' | 'info' }>();
</script>

<template>
  <p
    v-if="message"
    class="rc-alert"
    :class="`rc-alert--${tone ?? 'info'}`"
    :role="tone === 'error' ? 'alert' : 'status'"
  >
    {{ message }}
  </p>
</template>
