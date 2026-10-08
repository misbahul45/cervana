<script setup lang="ts">
interface Props {
  layout?: 'public' | 'auth' | 'learner' | 'studio' | 'admin';
}

withDefaults(defineProps<Props>(), {
  layout: 'public',
});
</script>

<template>
  <a
    href="#main"
    class="rc-skip-link"
  >
    Lewati ke konten utama
  </a>
  <slot />
</template>

<style scoped>
.rc-skip-link {
  position: absolute;
  left: -9999px;
  top: auto;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
.rc-skip-link:focus {
  left: 1rem;
  top: 1rem;
  width: auto;
  height: auto;
  padding: 0.5rem 1rem;
  background: var(--ui-primary, #2563eb);
  color: var(--ui-primary-fg, white);
  border-radius: 0.5rem;
  z-index: 1100;
}
</style>