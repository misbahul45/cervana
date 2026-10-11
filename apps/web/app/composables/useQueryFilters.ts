import { patchFilters, readFilters, writeQuery, type FilterDefs } from '~/lib/query-filters';

export function useQueryFilters(defs: FilterDefs) {
  const route = useRoute();
  const filters = computed(() => readFilters(route.query, defs));

  async function set(patch: Record<string, unknown>) {
    const next = patchFilters(filters.value, patch, defs);
    await navigateTo({ path: route.path, query: writeQuery(next, defs) });
  }

  return { filters, set };
}
