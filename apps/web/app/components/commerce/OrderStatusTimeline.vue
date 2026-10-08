<script setup lang="ts">
type StepStatus = 'completed' | 'active' | 'pending' | 'rejected';

interface Step {
  label: string;
  status: StepStatus;
  timestamp?: string;
}

interface Props {
  steps: Step[];
}

defineProps<Props>();
</script>

<template>
  <ol class="rc-order-timeline" aria-label="Status pesanan">
    <li
      v-for="(step, i) in steps"
      :key="i"
      :class="['rc-order-timeline__step', `rc-order-timeline__step--${step.status}`]"
    >
      <div class="rc-order-timeline__marker" aria-hidden="true">
        <UIcon
          :name="
            step.status === 'completed' ? 'i-lucide-check' :
            step.status === 'active' ? 'i-lucide-clock' :
            step.status === 'rejected' ? 'i-lucide-x' :
            'i-lucide-circle'
          "
        />
      </div>
      <div class="rc-order-timeline__body">
        <strong>{{ step.label }}</strong>
        <span v-if="step.timestamp" class="rc-order-timeline__time">{{ step.timestamp }}</span>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.rc-order-timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}
.rc-order-timeline__step {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.75rem;
  align-items: center;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  background: var(--ui-bg, white);
  border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.08));
}
.rc-order-timeline__step--completed {
  background: #dcfce7;
  border-color: #16a34a;
  color: #166534;
}
.rc-order-timeline__step--active {
  background: #dbeafe;
  border-color: #2563eb;
  color: #1e40af;
}
.rc-order-timeline__step--rejected {
  background: #fee2e2;
  border-color: #dc2626;
  color: #991b1b;
}
.rc-order-timeline__step--pending {
  opacity: 0.7;
}
.rc-order-timeline__marker { font-size: 1.125rem; }
.rc-order-timeline__body { display: flex; flex-direction: column; }
.rc-order-timeline__time {
  font-size: 0.75rem;
  color: var(--ui-text-muted);
}
</style>