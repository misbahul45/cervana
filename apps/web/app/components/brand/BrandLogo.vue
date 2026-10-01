<template>
  <NuxtLink to="/" :class="containerClass" aria-label="ReduCera – Ekosistem Belajar Akuntansi">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :class="markClass"
      viewBox="0 0 32 32"
      role="img"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="brand-pearl" cx="0.4" cy="0.4" r="0.6">
          <stop offset="0" stop-color="var(--rc-surface)" />
          <stop offset="0.6" stop-color="var(--rc-primary)" stop-opacity="0.8" />
          <stop offset="1" stop-color="var(--rc-secondary)" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#brand-pearl)" stroke="currentColor" stroke-width="1" />
      <circle cx="11" cy="11" r="4" fill="var(--rc-fg)" fill-opacity="0.3" />
    </svg>
    <div :class="textClass">
      <p class="font-bold leading-none">ReduCera</p>
      <p :class="taglineClass">Ekosistem Belajar Akuntansi</p>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import { NuxtLink } from '#components';

const props = withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg' }>(), {
  size: 'md',
});

const containerClass = computed(() => ({
  sm: 'flex items-center gap-2',
  md: 'flex items-center gap-3',
  lg: 'flex items-center gap-4',
}[props.size]));

const markClass = computed(() => ({
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
}[props.size]));

const textClass = computed(() => ({
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
}[props.size]));

const taglineClass = computed(() => ({
  sm: 'text-[10px] font-medium opacity-70',
  md: 'text-xs font-medium opacity-70',
  lg: 'text-sm font-medium opacity-70',
}[props.size]));
</script>