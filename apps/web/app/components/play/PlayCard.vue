<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'default' | 'soft' | 'success' | 'gold' | 'info' | 'danger';
    interactive?: boolean;
    flat?: boolean;
    as?: string;
  }>(),
  { tone: 'default', interactive: false, flat: false, as: 'div' },
);
</script>

<template>
  <component
    :is="as"
    class="rc-card"
    :class="[tone !== 'default' && `rc-card--${tone}`, interactive && 'rc-card--interactive', flat && 'rc-card--flat']"
    :tabindex="interactive ? 0 : undefined"
  >
    <slot />
  </component>
</template>
