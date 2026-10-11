<script setup lang="ts">
import { computed } from 'vue';
import { progressWidth } from '~/lib/play';

const props = withDefaults(
  defineProps<{ value: number; label: string; tone?: 'success' | 'gold' | 'info'; showValue?: boolean }>(),
  { tone: 'success', showValue: false },
);

const width = computed(() => progressWidth(props.value));
const rounded = computed(() => Math.round(Number.parseFloat(width.value)));
</script>

<template>
  <div class="rc-progress-wrap">
    <div
      class="rc-progress"
      :class="tone !== 'success' && `rc-progress--${tone}`"
      role="progressbar"
      :aria-label="label"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="rounded"
    >
      <div class="rc-progress__fill" :style="{ width }" />
    </div>
    <span v-if="showValue" class="rc-progress-wrap__value">{{ rounded }}%</span>
  </div>
</template>

<style>
.rc-progress-wrap {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.rc-progress-wrap .rc-progress {
  flex: 1;
}

.rc-progress-wrap__value {
  min-width: 2.75rem;
  color: var(--rc-muted);
  font-size: 0.8125rem;
  font-weight: 800;
  text-align: right;
}
</style>
