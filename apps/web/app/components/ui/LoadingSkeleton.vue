<script setup lang="ts">
interface Props {
  variant?: 'card' | 'row' | 'panel' | 'inline';
  count?: number;
  ariaLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'card',
  count: 1,
  ariaLabel: 'Memuat',
});

const items = Array.from({ length: props.count }, (_, i) => i);
</script>

<template>
  <div
    role="status"
    :aria-label="ariaLabel"
    :aria-busy="true"
    class="rc-skeleton"
    :class="`rc-skeleton--${variant}`"
  >
    <template v-if="variant === 'card'">
      <div v-for="i in items" :key="i" class="rc-skeleton-card">
        <div class="rc-skeleton-card__header rc-shimmer" />
        <div class="rc-skeleton-card__body rc-shimmer" />
        <div class="rc-skeleton-card__footer rc-shimmer" />
      </div>
    </template>
    <template v-else-if="variant === 'row'">
      <div v-for="i in items" :key="i" class="rc-skeleton-row">
        <div class="rc-skeleton-row__avatar rc-shimmer" />
        <div class="rc-skeleton-row__lines">
          <div class="rc-skeleton-row__line rc-shimmer" />
          <div class="rc-skeleton-row__line rc-shimmer rc-skeleton-row__line--short" />
        </div>
      </div>
    </template>
    <template v-else-if="variant === 'panel'">
      <div class="rc-skeleton-panel">
        <div class="rc-skeleton-panel__header rc-shimmer" />
        <div v-for="i in items" :key="i" class="rc-skeleton-panel__row rc-shimmer" />
      </div>
    </template>
    <template v-else>
      <div class="rc-skeleton-inline rc-shimmer" />
    </template>
  </div>
</template>

<style scoped>
.rc-skeleton {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.rc-skeleton-card {
  display: grid;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  border-radius: 0.75rem;
}
.rc-skeleton-card__header,
.rc-skeleton-card__body,
.rc-skeleton-card__footer {
  height: 1rem;
  border-radius: 0.375rem;
  background: var(--ui-bg-muted, rgba(0, 0, 0, 0.05));
}
.rc-skeleton-card__body { height: 3rem; }
.rc-skeleton-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.rc-skeleton-row__avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: var(--ui-bg-muted, rgba(0, 0, 0, 0.05));
}
.rc-skeleton-row__lines {
  display: grid;
  gap: 0.375rem;
  flex: 1;
}
.rc-skeleton-row__line {
  height: 0.75rem;
  border-radius: 0.25rem;
  background: var(--ui-bg-muted, rgba(0, 0, 0, 0.05));
}
.rc-skeleton-row__line--short { width: 60%; }
.rc-skeleton-panel {
  display: grid;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
  border-radius: 0.75rem;
}
.rc-skeleton-panel__header,
.rc-skeleton-panel__row {
  height: 1.25rem;
  border-radius: 0.375rem;
  background: var(--ui-bg-muted, rgba(0, 0, 0, 0.05));
}
.rc-skeleton-inline {
  height: 1rem;
  width: 100%;
  border-radius: 0.25rem;
  background: var(--ui-bg-muted, rgba(0, 0, 0, 0.05));
}
.rc-shimmer {
  position: relative;
  overflow: hidden;
}
.rc-shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  transform: translateX(-100%);
  animation: rc-shimmer 1.4s ease-in-out infinite;
}
@keyframes rc-shimmer {
  100% { transform: translateX(100%); }
}
@media (prefers-reduced-motion: reduce) {
  .rc-shimmer::after { animation: none; }
}
</style>