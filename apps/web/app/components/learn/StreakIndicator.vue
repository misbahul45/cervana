<script setup lang="ts">
interface Props {
  count: number;
  label?: string;
  visibleToday?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Hari berturut-turut',
  visibleToday: true,
});

const last = computed(() => props.count > 0);
</script>

<template>
  <div class="rc-streak-indicator" :aria-label="label">
    <UIcon
      :name="last ? 'i-lucide-flame' : 'i-lucide-flame'"
      :class="last ? 'rc-streak-indicator__icon rc-streak-indicator__icon--active' : 'rc-streak-indicator__icon'"
      aria-hidden="true"
    />
    <div class="rc-streak-indicator__body">
      <span class="rc-streak-indicator__count">{{ count }}</span>
      <span class="rc-streak-indicator__label">{{ label }}</span>
    </div>
    <p v-if="visibleToday" class="rc-streak-indicator__note">
      Kualitas streak meningkat hanya lewat aktivitas belajar yang tervalidasi.
    </p>
  </div>
</template>

<style scoped>
.rc-streak-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  background: var(--ui-bg-elevated, transparent);
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
}
.rc-streak-indicator__icon {
  font-size: 1.75rem;
  color: var(--ui-text-muted);
}
.rc-streak-indicator__icon--active {
  color: #f97316;
}
.rc-streak-indicator__body {
  display: flex;
  flex-direction: column;
  flex: 1;
}
.rc-streak-indicator__count {
  font-size: 1.25rem;
  font-weight: 700;
}
.rc-streak-indicator__label {
  font-size: 0.75rem;
  color: var(--ui-text-muted);
}
.rc-streak-indicator__note {
  font-size: 0.75rem;
  color: var(--ui-text-muted);
  max-width: 16rem;
}
</style>