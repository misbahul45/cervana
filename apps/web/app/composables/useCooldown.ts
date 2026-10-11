import { computed, onBeforeUnmount, ref } from 'vue';

export function useCooldown(seconds = 60) {
  const remaining = ref(0);
  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const start = () => {
    stop();
    remaining.value = seconds;
    timer = setInterval(() => {
      remaining.value -= 1;
      if (remaining.value <= 0) stop();
    }, 1000);
  };

  onBeforeUnmount(stop);

  return { remaining, active: computed(() => remaining.value > 0), start };
}
