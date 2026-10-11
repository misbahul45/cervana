<script setup lang="ts">
import { computed } from 'vue';
import { buttonClasses, type ButtonSize, type ButtonVariant } from '~/lib/play';

const props = withDefaults(
  defineProps<{
    to?: string;
    href?: string;
    variant?: ButtonVariant;
    size?: ButtonSize;
    block?: boolean;
    loading?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
  }>(),
  { to: undefined, href: undefined, variant: 'primary', size: 'md', block: false, loading: false, disabled: false, type: 'button' },
);

const classes = computed(() => buttonClasses(props));
const inactive = computed(() => props.disabled || props.loading);
const tag = computed(() => (props.to ? resolveComponent('NuxtLink') : props.href ? 'a' : 'button'));
</script>

<template>
  <component
    :is="tag"
    :class="classes"
    :to="to"
    :href="href"
    :type="to || href ? undefined : type"
    :disabled="!to && !href ? inactive : undefined"
    :aria-disabled="(to || href) && inactive ? 'true' : undefined"
    :aria-busy="loading ? 'true' : undefined"
    :tabindex="(to || href) && inactive ? -1 : undefined"
  >
    <UIcon v-if="loading" name="i-lucide-loader-circle" class="rc-spin" aria-hidden="true" />
    <slot />
  </component>
</template>

<style>
.rc-spin {
  animation: rc-spin 800ms linear infinite;
}

@keyframes rc-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .rc-spin {
    animation-duration: 2400ms;
  }
}
</style>
