import type { NormalizedTheme } from '~/theme/types';

const CACHE_KEY = 'default-theme';
const STALE_MS = 60_000;
const MAX_STALE_MS = 300_000;
const FETCH_TIMEOUT_MS = 800;

let inflight: Promise<NormalizedTheme | null> | null = null;
let cached: { value: NormalizedTheme | null; at: number } | null = null;

interface RawThemeApiResponse {
  data?: NormalizedTheme & {
    bg_image?: unknown;
    planet_image?: unknown;
  };
}

function normalizePayload(payload: unknown): NormalizedTheme | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = (payload as { data?: unknown }).data ?? payload;
  if (!root || typeof root !== 'object') return null;
  const raw = root as Record<string, unknown>;
  const slug = typeof raw.slug === 'string' ? raw.slug : null;
  const title = typeof raw.title === 'string' ? raw.title : null;
  const primary = typeof raw.primary === 'string' ? raw.primary : null;
  const secondary = typeof raw.secondary === 'string' ? raw.secondary : null;
  const tokens = raw.tokens as { light?: Record<string, string>; dark?: Record<string, string> } | undefined;
  if (!slug || !title || !primary || !secondary || !tokens?.light || !tokens.dark) return null;

  return {
    slug,
    title,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    primary,
    secondary,
    tertiary: typeof raw.tertiary === 'string' ? raw.tertiary : undefined,
    quaternary: typeof raw.quaternary === 'string' ? raw.quaternary : undefined,
    mood: Array.isArray(raw.mood) ? (raw.mood.filter((m): m is string => typeof m === 'string')) : [],
    tokens: {
      light: tokens.light as NormalizedTheme['tokens']['light'],
      dark: tokens.dark as NormalizedTheme['tokens']['dark'],
    },
    atmosphere: raw.atmosphere as NormalizedTheme['atmosphere'],
    variants: raw.variants as NormalizedTheme['variants'],
    isDefault: raw.isDefault === true,
    version: typeof raw.version === 'number' ? raw.version : 1,
  };
}

async function fetchFromApi(): Promise<NormalizedTheme | null> {
  const config = useRuntimeConfig();
  const baseUrl = config.apiInternalUrl || config.public.API_URL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await $fetch<RawThemeApiResponse>(`${baseUrl}/gamify/themes/default`, {
      signal: controller.signal,
    });
    return normalizePayload(res);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function loadFallback(): Promise<NormalizedTheme | null> {
  try {
    const mod = await import('~/theme/default-theme');
    return mod.DEFAULT_THEME;
  } catch {
    return null;
  }
}

export async function getDefaultTheme(): Promise<NormalizedTheme | null> {
  const now = Date.now();

  if (cached && now - cached.at < STALE_MS) {
    return cached.value;
  }

  if (cached && now - cached.at < MAX_STALE_MS) {
    if (!inflight) {
      inflight = fetchFromApi()
        .then((fresh) => fresh ?? cached!.value)
        .finally(() => {
          inflight = null;
        });
    }
    return cached.value;
  }

  if (inflight) {
    return inflight;
  }

  inflight = (async () => {
    try {
      const apiValue = await fetchFromApi();
      const value = apiValue ?? (await loadFallback());
      cached = { value, at: Date.now() };
      return value;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function _resetDefaultThemeCacheForTests() {
  cached = null;
  inflight = null;
}
