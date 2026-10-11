const randomKey = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

export function createIdempotencyKey() {
  let key: string | null = null;
  return {
    current(): string {
      key ??= randomKey();
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
