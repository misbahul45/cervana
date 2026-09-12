import { writable } from "svelte/store";
import type { ApiResponse } from "$lib/types/api.type";

export function useApi<T = any, P extends any[] = any[]>(
  serviceFn: (...args: P) => Promise<ApiResponse<T>>
) {
  const respon = writable<ApiResponse<T> | null>(null);
  const loading = writable(false);

  const call = async (...args: P) => {
    loading.set(true);
    respon.set(null);

    try {
      const result = await serviceFn(...args);
      respon.set(result);
    } catch (err: any) {
      respon.set({
        success: false,
        message: err?.message || "Request failed",
        error: err,
      } as ApiResponse<T>);
    } finally {
      loading.set(false);
    }
  };

  return { respon, loading, call };
}
