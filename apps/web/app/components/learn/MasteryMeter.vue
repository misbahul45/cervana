<script setup lang="ts">
interface Props {
  level?: number;
  targetLevel?: number;
  maxLevel?: number;
  label?: string;
}

const props = withDefaults(defineProps<Props>(), {
  level: 0,
  targetLevel: 100,
  maxLevel: 100,
  label: 'Penguasaan',
});

const percent = computed(() => {
  if (props.maxLevel <= 0) return 0;
  return Math.max(0, Math.min(100, (props.level / props.maxLevel) * 100));
});
</script>

<template>
  <div class="rc-mastery-meter" role="group" :aria-label="label">
    <div class="rc-mastery-meter__label">
      <span>{{ label }}</span>
      <span class="rc-mastery-meter__value">{{ level }} / {{ maxLevel }}</span>
    </div>
    <div
      class="rc-mastery-meter__bar"
      role="progressbar"
      :aria-valuemin="0"
      :aria-valuemax="maxLevel"
      :aria-valuenow="level"
      :aria-label="`${label}: ${level} dari ${maxLevel}`"
    >
      <div class="rc-mastery-meter__fill" :style="{ width: `${percent}%` }" />
      <div
        v-if="targetLevel > level && targetLevel <= maxLevel"
        class="rc-mastery-meter__target"
        :style="{ left: `${(targetLevel / maxLevel) * 100}%` }"
        aria-hidden="true"
      />
    </div>
  </div>
</template>

<style scoped>
.rc-mastery-meter {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.rc-mastery-meter__label {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  color: var(--ui-text-muted);
}
.rc-mastery-meter__bar {
  position: relative;
  height: 0.625rem;
  background: var(--ui-bg-muted, #e5e7eb);
  border-radius: 9999px;
  overflow: hidden;
}
.rc-mastery-meter__fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: linear-gradient(90deg, #2563eb, #7c3aed);
  transition: width 0.5s ease;
}
.rc-mastery-meter__target {
  position: absolute;
  top: -0.25rem;
  bottom: -0.25rem;
  width: 0.125rem;
  background: var(--ui-text, #1f2937);
}
@media (prefers-reduced-motion: reduce) {
  .rc-mastery-meter__fill { transition: none; }
}
</style>