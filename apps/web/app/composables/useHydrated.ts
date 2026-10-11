import { onMounted, ref } from 'vue';

export function useHydrated() {
  const hydrated = ref(false);
  onMounted(() => {
    hydrated.value = true;
  });
  return hydrated;
}
