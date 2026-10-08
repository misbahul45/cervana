export function createIdempotencyKey() {
  let key: string | null = null;
  return {
    current(): string {
      key ??= crypto.randomUUID();
      return key;
    },
    reset(): void {
      key = null;
    },
  };
}

export function useIdempotencyKey() {
  return createIdempotencyKey();
}
