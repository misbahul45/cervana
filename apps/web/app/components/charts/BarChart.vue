<script setup lang="ts">
defineProps<{
  data: Array<{ label: string; value: number; color?: string }>;
  height?: number;
  width?: number;
}>();
</script>

<template>
  <div class="bar-chart w-full" :style="{ height: (height || 200) + 'px' }">
    <div v-for="(item, i) in data" :key="i" class="bar-row">
      <div class="bar-label">{{ item.label }}</div>
      <div class="bar-track" :style="{ width: (width || 600) + 'px' }">
        <div
          class="bar-fill"
          :style="{
            width: item.value + '%',
            background: item.color || 'var(--rc-primary, #3b82f6)',
          }"
        />
        <span class="bar-value">{{ item.value }}%</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bar-chart { display: flex; flex-direction: column; justify-content: space-around; gap: 0.5rem; }
.bar-row { display: flex; align-items: center; gap: 0.75rem; }
.bar-label { width: 8rem; font-size: 0.875rem; color: var(--rc-fg, #111); }
.bar-track { flex: 1; height: 1.5rem; background: var(--rc-bg-elevated, #f3f4f6); border-radius: 0.375rem; overflow: hidden; position: relative; }
.bar-fill { height: 100%; border-radius: 0.375rem; transition: width 0.3s ease; min-width: 0.5rem; }
.bar-value { position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); font-size: 0.75rem; font-weight: 600; color: var(--rc-fg, #111); }
</style>