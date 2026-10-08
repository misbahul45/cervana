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
  padding: 0.125rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.2;
}
.rc-status-badge--neutral { background: var(--ui-bg-muted, #f3f4f6); color: var(--ui-text, #1f2937); }
.rc-status-badge--success { background: #dcfce7; color: #166534; }
.rc-status-badge--warning { background: #fef3c7; color: #92400e; }
.rc-status-badge--error   { background: #fee2e2; color: #991b1b; }
.rc-status-badge--info    { background: #dbeafe; color: #1e40af; }
</style>