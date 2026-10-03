<script setup lang="ts">
defineProps<{
  value: number;
  max?: number;
  label?: string;
  color?: string;
  height?: string;
}>();
</script>

<template>
  <div class="bar-wrapper">
    <div v-if="label" class="bar-label">
      <span>{{ label }}</span>
      <span class="bar-value">{{ Math.round((value / (max || 100)) * 100) }}%</span>
    </div>
    <div class="bar-track" :style="{ height: height || '8px' }">
      <div
        class="bar-fill"
        :style="{
          width: Math.min(100, (value / (max || 100)) * 100) + '%',
          background: color || 'linear-gradient(90deg, var(--rc-primary), var(--rc-accent, #6366f1))',
        }"
      />
    </div>
  </div>
</template>

<style scoped>
.bar-wrapper { width: 100%; }
.bar-label { display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 0.25rem; }
.bar-value { font-weight: 600; color: var(--rc-primary, #3b82f6); }
.bar-track { width: 100%; background: var(--rc-bg-elevated, #f3f4f6); border-radius: 9999px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 9999px; transition: width 0.3s ease; }
</style>