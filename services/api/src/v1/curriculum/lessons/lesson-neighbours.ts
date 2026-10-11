export function neighboursOf<T extends { id: string }>(
  ordered: readonly T[],
  id: string,
): { previous: T | null; next: T | null } | null {
  const index = ordered.findIndex((lesson) => lesson.id === id);
  if (index === -1) return null;
  return { previous: ordered[index - 1] ?? null, next: ordered[index + 1] ?? null };
}
