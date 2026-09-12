import { ref } from 'vue'
import type { Ref } from 'vue'
import type { ApiResponse } from '~/interfaces/api'

export function useApi<T = any, P extends any[] = any[]>(
  serviceFn: (...args: P) => Promise<ApiResponse<T>>
) {
  const respon: Ref<ApiResponse<T> | null> = ref(null)
  const loading: Ref<boolean> = ref(false)

  const call = async (...args: P) => {
    loading.value = true
    respon.value = null
    respon.value = await serviceFn(...args)
    loading.value=false
  }

  return { respon, loading, call }
}