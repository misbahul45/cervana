export function lessonIdFrom(queryValue: unknown, storedValue: string): string {
  return typeof queryValue === 'string' && queryValue ? queryValue : storedValue;
}
