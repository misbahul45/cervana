import { ref } from 'vue';
import { describeApiError } from '~/lib/api-error';
import { createIdempotencyKey } from '~/composables/useIdempotencyKey';

export function useQueueActions(afterSuccess: () => Promise<unknown>) {
  const busy = ref(false);
  const error = ref<string | null>(null);
  const notice = ref<string | null>(null);
  const keys = new Map<string, ReturnType<typeof createIdempotencyKey>>();

  const keyFor = (action: string, id: string) => {
    const slot = `${action}:${id}`;
    let key = keys.get(slot);
    if (!key) {
      key = createIdempotencyKey();
      keys.set(slot, key);
    }
    return key;
  };

  function clear() {
    error.value = null;
    notice.value = null;
  }

  async function run(action: string, id: string, call: (key: string) => Promise<unknown>, success: string): Promise<boolean> {
    if (busy.value) return false;
    busy.value = true;
    clear();
    const key = keyFor(action, id);
    try {
      await call(key.current());
      key.reset();
      notice.value = success;
      await afterSuccess();
      return true;
    } catch (err) {
      error.value = describeApiError(err, 'Tindakan gagal. Coba lagi.');
      return false;
    } finally {
      busy.value = false;
    }
  }

  return { busy, error, notice, run, clear };
}
