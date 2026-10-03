<script setup lang="ts">
defineProps<{
  title: string;
  value: number | string;
  change?: number;
  suffix?: string;
  prefix?: string;
  color?: string;
}>();
</script>

<template>
  <div class="stat-card">
    <div class="stat-title">{{ title }}</div>
    <div class="stat-value" :style="{ color: color || 'var(--rc-primary, #3b82f6)' }">
      <span v-if="prefix">{{ prefix }}</span>{{ value }}<span v-if="suffix">{{ suffix }}</span>
    </div>
    <div v-if="change !== undefined" :class="['stat-change', change >= 0 ? 'pos' : 'neg']">
      {{ change >= 0 ? '↑' : '↓' }} {{ Math.abs(change) }}%
    </div>
  </div>
</template>

<style scoped>
.stat-card {
  padding: 1rem 1.25rem;
  border-radius: 0.5rem;
  background: var(--rc-bg-elevated, #f3f4f6);
  border: 1px solid var(--rc-border, #d1d5db);
}
.stat-title { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--rc-fg-muted, #6b7280); }
.stat-value { font-size: 1.5rem; font-weight: 700; margin-top: 0.25rem; }
.stat-change { font-size: 0.75rem; margin-top: 0.25rem; }
.stat-change.pos { color: var(--rc-success, #16a34a); }
.stat-change.neg { color: var(--rc-danger, #dc2626); }
</style>