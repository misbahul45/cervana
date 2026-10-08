<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg';
    to?: string;
    tagline?: boolean;
    suffix?: string;
    label?: string;
  }>(),
  { size: 'md', to: '/', tagline: false, suffix: '', label: 'ReduCera' },
);

const gradientId = `brand-pearl-${useId()}`;

const markSize = computed(() => ({ sm: 'size-7', md: 'size-9', lg: 'size-12' })[props.size]);
const wordSize = computed(() => ({ sm: 'text-base', md: 'text-xl', lg: 'text-2xl' })[props.size]);
</script>

<template>
  <NuxtLink :to="to" class="rc-brand-logo" :aria-label="label">
    <svg :class="markSize" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient :id="gradientId" cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" :style="{ stopColor: 'var(--rc-surface)' }" />
          <stop offset="0.55" :style="{ stopColor: 'var(--rc-primary)' }" />
          <stop offset="1" :style="{ stopColor: 'var(--rc-secondary)' }" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="15" r="11" :fill="`url(#${gradientId})`" />
      <ellipse cx="16.5" cy="11.5" rx="3.2" ry="2" :style="{ fill: 'var(--rc-surface)', opacity: 0.75 }" />
      <path d="M3 28 Q11.5 22 20 28 T37 28" fill="none" :style="{ stroke: 'var(--rc-primary)' }" stroke-width="3" stroke-linecap="round" />
      <path d="M3 35 Q11.5 29 20 35 T37 35" fill="none" :style="{ stroke: 'var(--rc-secondary)' }" stroke-width="3" stroke-linecap="round" />
    </svg>
    <span class="rc-brand-logo__text">
      <span :class="['rc-brand-logo__word', wordSize]">ReduCera<span v-if="suffix" class="rc-brand-logo__suffix">{{ suffix }}</span></span>
      <span v-if="tagline" class="rc-brand-logo__tagline">Ekosistem Belajar Akuntansi</span>
    </span>
  </NuxtLink>
</template>

<style scoped>
.rc-brand-logo {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  color: var(--rc-fg);
  text-decoration: none;
}

.rc-brand-logo__text {
  display: flex;
  flex-direction: column;
  line-height: 1.05;
}

.rc-brand-logo__word {
  display: inline-flex;
  align-items: baseline;
  gap: 0.375rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.rc-brand-logo__suffix {
  padding: 0.0625rem 0.5rem;
  border-radius: 999px;
  background-color: var(--rc-foam);
  color: var(--rc-primary);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.rc-brand-logo__tagline {
  margin-top: 0.125rem;
  color: var(--rc-muted);
  font-size: 0.6875rem;
  font-weight: 500;
}
</style>
