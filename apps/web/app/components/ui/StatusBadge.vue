<script setup lang="ts">
type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'info';

interface Props {
  tone?: Tone;
  label: string;
}

const props = withDefaults(defineProps<Props>(), {
  tone: 'neutral',
});
</script>

<template>
  <span
    :class="['rc-status-badge', `rc-status-badge--${tone}`]"
    :aria-label="label"
  >
    <slot>{{ label }}</slot>
  </span>
</template>

<style scoped>
.rc-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.1875rem 0.75rem;
  border: 2px solid var(--rc-border);
  border-radius: 999px;
  background-color: var(--rc-surface);
  color: var(--rc-fg);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 1.2;
  text-transform: uppercase;
}
.rc-status-badge--neutral { background-color: var(--rc-foam); color: var(--rc-muted); }
.rc-status-badge--success { border-color: var(--rc-success); color: var(--rc-primary); }
.rc-status-badge--warning { border-color: var(--rc-warning); color: var(--rc-accent); }
.rc-status-badge--error { border-color: var(--rc-danger); color: var(--rc-danger); }
.rc-status-badge--info { border-color: var(--rc-info); color: var(--rc-secondary); }
</style>
