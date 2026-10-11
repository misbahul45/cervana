const KEY_HOLDERS = new Set(['ADMIN', 'TEACHER']);

export const canSeeAnswerKey = (role: string | undefined): boolean => role !== undefined && KEY_HOLDERS.has(role);

const strip = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(strip);
  if (value === null || typeof value !== 'object' || value instanceof Date) return value;
  const clean: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'correctAnswer') continue;
    clean[key] = strip(inner);
  }
  return clean;
};

export const withoutAnswerKey = <T>(value: T): T => strip(value) as T;

export const forViewer = <T>(role: string | undefined, value: T): T => (canSeeAnswerKey(role) ? value : withoutAnswerKey(value));

const LEARNER_INCLUDES = new Set(['questions']);

export const viewerQuery = <Q extends { include?: string | string[] }>(role: string | undefined, query: Q): Q => {
  if (canSeeAnswerKey(role)) return query;
  const { include, ...rest } = query;
  const names = (Array.isArray(include) ? include : typeof include === 'string' ? include.split(',') : [])
    .map((name) => name.trim())
    .filter((name) => LEARNER_INCLUDES.has(name));
  return (names.length ? { ...rest, include: names.join(',') } : rest) as Q;
};
