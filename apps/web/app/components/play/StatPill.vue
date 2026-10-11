<script setup lang="ts">
import { computed } from 'vue';
import { formatCount } from '~/lib/gamify';
import type { ThemeIconName } from '~/theme/icons';

const props = withDefaults(
  defineProps<{ icon: ThemeIconName; value: number | string; label: string; tone?: 'flame' | 'gold' | 'info' | 'success' | 'muted'; showLabel?: boolean }>(),
  { tone: 'muted', showLabel: false },
);

const text = computed(() => (typeof props.value === 'number' ? formatCount(props.value) : props.value));
</script>

<template>
  <div class="rc-stat" :class="`rc-stat--${tone}`" :title="`${label}: ${text}`">
    <GameIcon :name="icon" :size="26" decorative />
    <span class="rc-stat__value">{{ text }}</span>
    <span v-if="showLabel" class="rc-stat__label">{{ label }}</span>
    <span v-else class="sr-only">{{ label }}</span>
  </div>
</template>

<style>
.rc-stat {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-weight: 900;
  line-height: 1;
}

.rc-stat__value {
  font-size: 1.0625rem;
  font-variant-numeric: tabular-nums;
}

.rc-stat__label {
  color: var(--rc-muted);
  font-size: 0.8125rem;
  font-weight: 800;
}

.rc-stat--flame .rc-stat__value {
  color: var(--rc-accent);
}

.rc-stat--gold .rc-stat__value {
  color: var(--rc-accent);
}

.rc-stat--info .rc-stat__value {
  color: var(--rc-secondary);
}

.rc-stat--success .rc-stat__value {
  color: var(--rc-primary);
}

.rc-stat--muted .rc-stat__value {
  color: var(--rc-fg);
}
</style>
