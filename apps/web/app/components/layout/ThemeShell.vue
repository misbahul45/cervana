<script setup lang="ts">
interface Props {
  density?: 'compact' | 'regular' | 'expanded';
  showThemeTokens?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  density: 'regular',
  showThemeTokens: true,
});

const shellClasses = computed(() => [
  'rc-theme-shell',
  `rc-theme-shell--${props.density}`,
  props.showThemeTokens ? 'rc-theme-shell--tokens' : '',
]);
</script>

<template>
  <div :class="shellClasses" data-test="theme-shell">
    <slot />
  </div>
</template>

<style scoped>
.rc-theme-shell {
  width: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  --rc-shell-padding: 1rem;
  --rc-shell-radius: 0.75rem;
}
.rc-theme-shell--compact  { --rc-shell-padding: 0.5rem; --rc-shell-radius: 0.5rem; }
.rc-theme-shell--expanded { --rc-shell-padding: 1.5rem; --rc-shell-radius: 1rem; }
@media (prefers-reduced-motion: reduce) {
  .rc-theme-shell { transition: none; }
}
</style>