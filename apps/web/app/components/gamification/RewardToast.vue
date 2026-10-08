<script setup lang="ts">
const props = defineProps<{
  title: string;
  message?: string;
  rewardKind?: string;
  rewardAmount?: number;
  visible?: boolean;
}>();

const emit = defineEmits<{ dismiss: [] }>();

const isVisible = computed(() => props.visible !== false);
</script>

<template>
  <Transition name="rc-reward-toast">
    <Toast
      v-if="isVisible"
      :title="title"
      :message="message"
      tone="success"
      @dismiss="emit('dismiss')"
    >
      <span v-if="rewardKind && rewardAmount" class="rc-reward-toast__amount">
        +{{ rewardAmount }} {{ rewardKind }}
      </span>
    </Toast>
  </Transition>
</template>

<style scoped>
.rc-reward-toast__amount {
  font-weight: 700;
  font-size: 1rem;
}
.rc-reward-toast-enter-active,
.rc-reward-toast-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.rc-reward-toast-enter-from,
.rc-reward-toast-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}
@media (prefers-reduced-motion: reduce) {
  .rc-reward-toast-enter-active,
  .rc-reward-toast-leave-active { transition: none; }
}
</style>