<script setup lang="ts">
import { computed } from 'vue';
import { ringDash } from '~/lib/play';

const props = withDefaults(defineProps<{ level: number; progress: number; size?: number; label?: string }>(), { size: 96, label: 'Level' });

const RADIUS = 42;
const dash = computed(() => ringDash(props.progress, RADIUS));
</script>

<template>
  <div class="rc-ring" :style="{ width: `${size}px`, height: `${size}px` }" role="img" :aria-label="`${label} ${level}, ${Math.round(Math.min(1, Math.max(0, progress)) * 100)} persen menuju level berikutnya`">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle class="rc-ring__track" cx="50" cy="50" :r="RADIUS" fill="none" stroke-width="9" />
      <circle
        class="rc-ring__fill"
        cx="50"
        cy="50"
        :r="RADIUS"
        fill="none"
        stroke-width="9"
        stroke-linecap="round"
        :stroke-dasharray="dash.circumference"
        :stroke-dashoffset="dash.offset"
        transform="rotate(-90 50 50)"
      />
    </svg>
    <div class="rc-ring__center">
      <GameIcon name="level" :size="Math.round(size * 0.3)" decorative />
      <span class="rc-ring__level">{{ level }}</span>
    </div>
  </div>
</template>

<style>
.rc-ring {
  position: relative;
  flex: none;
}

.rc-ring svg {
  width: 100%;
  height: 100%;
}

.rc-ring__track {
  stroke: var(--rc-border);
}

.rc-ring__fill {
  stroke: var(--rc-secondary);
  transition: stroke-dashoffset 400ms ease-out;
}

.rc-ring__center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.125rem;
}

.rc-ring__level {
  color: var(--rc-fg);
  font-size: 1.375rem;
  font-weight: 900;
  line-height: 1;
}

@media (prefers-reduced-motion: reduce) {
  .rc-ring__fill {
    transition: none;
  }
}
</style>
