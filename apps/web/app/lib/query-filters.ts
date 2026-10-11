export type FilterDef =
  | { kind: 'page' }
  | { kind: 'text'; max?: number }
  | { kind: 'enum'; values: readonly string[] };

export type FilterDefs = Record<string, FilterDef>;
export type FilterValues = Record<string, string | number>;

const MAX_PAGE = 100_000;

const first = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value);

const sanitize = (def: FilterDef, raw: unknown): string | number => {
  const value = first(raw);
  if (def.kind === 'page') {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
    return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= MAX_PAGE ? parsed : 1;
  }
  const text = typeof value === 'string' ? value.trim() : '';
  if (def.kind === 'text') return text.slice(0, def.max ?? 100);
  return def.values.includes(text) ? text : '';
};

export function readFilters(query: Record<string, unknown>, defs: FilterDefs): FilterValues {
  return Object.fromEntries(Object.entries(defs).map(([key, def]) => [key, sanitize(def, query[key])]));
}

export function writeQuery(values: FilterValues, defs: FilterDefs): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [key, def] of Object.entries(defs)) {
    const value = values[key];
    const isDefault = def.kind === 'page' ? value === 1 : value === '';
    if (value !== undefined && !isDefault) query[key] = String(value);
  }
  return query;
}

export function patchFilters(current: FilterValues, patch: Record<string, unknown>, defs: FilterDefs): FilterValues {
  const next: FilterValues = { ...current };
  let filterChanged = false;
  for (const [key, raw] of Object.entries(patch)) {
    const def = defs[key];
    if (!def) continue;
    const value = sanitize(def, raw);
    if (next[key] !== value && key !== 'page') filterChanged = true;
    next[key] = value;
  }
  if (filterChanged && !('page' in patch)) next.page = 1;
  return next;
}
