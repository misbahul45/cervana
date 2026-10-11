import type { ComputedRef } from 'vue';
import type { Paginated } from '~/interfaces/admin';
import type { FilterValues } from '~/lib/query-filters';

export function useAdminList<T>(key: string, fetcher: (filters: FilterValues) => Promise<Paginated<T>>, filters: ComputedRef<FilterValues>) {
  const { data, status, error, refresh } = useAsyncData(key, () => fetcher(filters.value), {
    lazy: true,
    watch: [filters],
  });

  const rows = computed(() => data.value?.data ?? []);
  const pagination = computed(() => data.value?.pagination ?? null);
  const state = computed(() => (data.value ? 'success' : status.value));

  return { rows, pagination, state, error, refresh };
}
