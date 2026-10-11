import type { DefaultThemePayload } from './default-payload';

const FRESH_MS = 60_000;
const MAX_STALE_MS = 300_000;
const FAILURE_RETRY_MS = 5_000;

export interface DefaultThemeLoaderDeps {
  fetchRemote: () => Promise<DefaultThemePayload | null>;
  fallback: () => DefaultThemePayload;
  now?: () => number;
}

interface CacheEntry {
  value: DefaultThemePayload;
  at: number;
  fresh: number;
  bundled: boolean;
}

export const createDefaultThemeLoader = (deps: DefaultThemeLoaderDeps) => {
  const now = deps.now ?? Date.now;
  let cached: CacheEntry | null = null;
  let inflight: Promise<DefaultThemePayload> | null = null;

  const remote = async (): Promise<DefaultThemePayload | null> => {
    try {
      return await deps.fetchRemote();
    } catch {
      return null;
    }
  };

  const store = (value: DefaultThemePayload | null): DefaultThemePayload => {
    if (value) {
      cached = { value, at: now(), fresh: FRESH_MS, bundled: false };
      return value;
    }
    const fallback = deps.fallback();
    cached = { value: fallback, at: now(), fresh: FAILURE_RETRY_MS, bundled: true };
    return fallback;
  };

  const refresh = (keepOnFailure: boolean): Promise<DefaultThemePayload> => {
    if (!inflight) {
      inflight = remote()
        .then((value) => {
          if (value || !keepOnFailure || !cached) return store(value);
          cached = { ...cached, at: now(), fresh: FAILURE_RETRY_MS };
          return cached.value;
        })
        .finally(() => {
          inflight = null;
        });
    }
    return inflight;
  };

  return {
    async get(): Promise<DefaultThemePayload> {
      if (cached) {
        const age = now() - cached.at;
        if (age < cached.fresh) return cached.value;
        if (!cached.bundled && age < MAX_STALE_MS) {
          void refresh(true);
          return cached.value;
        }
      }
      return refresh(false);
    },
    reset(): void {
      cached = null;
      inflight = null;
    },
  };
};
