<script setup lang="ts">
const props = defineProps<{ level: number; xp: number }>();
const capped = Math.min(props.level, 12);
</script>

<template>
  <div :class="`level-badge level-${capped}`">
    <span class="level-number">{{ level }}</span>
    <span class="xp">{{ xp }} XP</span>
  </div>
</template>

<style scoped>
.level-badge {
  display: inline-flex;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  background: var(--rc-bg-elevated, #f5f5f5);
}
.level-1 { background: var(--theme-level-1, #fef3c7); }
.level-2 { background: var(--theme-level-2, #fde68a); }
.level-3 { background: var(--theme-level-3, #fcd34d); }
.level-4 { background: var(--theme-level-4, #fbbf24); }
.level-5 { background: var(--theme-level-5, #f59e0b); }
.level-6 { background: var(--theme-level-6, #d97706); }
.level-7 { background: var(--theme-level-7, #92400e); }
.level-8 { background: var(--theme-level-8, #ea580c); }
.level-9 { background: var(--theme-level-9, #dc2626); }
.level-10 { background: var(--theme-level-10, #b91c1c); }
.level-11 { background: var(--theme-level-11, #7f1d1d); }
.level-12 { background: var(--theme-level-12, #450a0a); color: #fff; }
</style>