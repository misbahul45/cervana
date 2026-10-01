import type { NormalizedTheme, RawTheme, ThemeAtmosphere, ThemeTokens, ThemeVariant } from './types';

const DEFAULT_ATMOSPHERE: ThemeAtmosphere = {
  particles: { enabled: true, density: 0.3 },
  motion: { intensity: 0.25 },
  lighting: { intensity: 0.55 },
  waves: true,
  caustics: true,
};

const DEFAULT_TOKENS: ThemeTokens = {
  bg: '#F2FAFB',
  surface: '#FFFFFF',
  fg: '#0A2533',
  muted: '#3F5B69',
  border: '#B7D9E1',
  borderStrong: '#5B8896',
  primary: '#0B7285',
  primaryFg: '#FFFFFF',
  secondary: '#1C5D99',
  secondaryFg: '#FFFFFF',
  accent: '#C2410C',
  focus: '#0B5FA8',
  foam: '#DDF3F4',
  sand: '#E9DDB8',
};

const FALLBACK_DARK_TOKENS: ThemeTokens = {
  bg: '#04202D',
  surface: '#0A3145',
  fg: '#E6F7FA',
  muted: '#A5CBD6',
  border: '#2A6178',
  borderStrong: '#4C8BA3',
  primary: '#3CC8DA',
  primaryFg: '#03202B',
  secondary: '#6FA8F0',
  secondaryFg: '#04182B',
  accent: '#FF9A76',
  focus: '#7DD3FC',
  foam: '#0F4A61',
  sand: '#3A4A52',
};

export function mergeTokens(
  base: ThemeTokens,
  overrides: Partial<ThemeTokens> | undefined,
): ThemeTokens {
  if (!overrides) return base;
  return { ...base, ...overrides };
}

export function normalizeTheme(input: unknown): NormalizedTheme | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;

  const slug = typeof raw.slug === 'string' && raw.slug ? raw.slug : null;
  const title = typeof raw.title === 'string' && raw.title ? raw.title : null;
  const primary = typeof raw.primary === 'string' ? raw.primary : null;
  const secondary = typeof raw.secondary === 'string' ? raw.secondary : null;

  if (!slug || !title || !primary || !secondary) return null;

  const tokensInput = raw.tokens as
    | { light?: Partial<ThemeTokens>; dark?: Partial<ThemeTokens> }
    | undefined;
  const light = mergeTokens(DEFAULT_TOKENS, tokensInput?.light ?? {});
  const dark = mergeTokens(FALLBACK_DARK_TOKENS, tokensInput?.dark ?? tokensInput?.light ?? {});

  const mood = Array.isArray(raw.mood)
    ? raw.mood.filter((m): m is string => typeof m === 'string')
    : [];

  return {
    slug,
    title,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    primary,
    secondary,
    tertiary: typeof raw.tertiary === 'string' ? raw.tertiary : undefined,
    quaternary: typeof raw.quaternary === 'string' ? raw.quaternary : undefined,
    mood,
    tokens: { light, dark },
    atmosphere: normalizeAtmosphere(raw.atmosphere) ?? DEFAULT_ATMOSPHERE,
    variants: normalizeVariants(raw.variants),
    isDefault: raw.isDefault === true,
    version: typeof raw.version === 'number' ? raw.version : 1,
  };
}

function normalizeAtmosphere(input: unknown): ThemeAtmosphere | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const out: ThemeAtmosphere = {};
  if (raw.particles && typeof raw.particles === 'object') {
    const p = raw.particles as Record<string, unknown>;
    out.particles = {
      enabled: typeof p.enabled === 'boolean' ? p.enabled : undefined,
      density: typeof p.density === 'number' ? p.density : undefined,
    };
  }
  if (raw.motion && typeof raw.motion === 'object') {
    const m = raw.motion as Record<string, unknown>;
    out.motion = {
      intensity: typeof m.intensity === 'number' ? m.intensity : undefined,
    };
  }
  if (raw.lighting && typeof raw.lighting === 'object') {
    const l = raw.lighting as Record<string, unknown>;
    out.lighting = {
      intensity: typeof l.intensity === 'number' ? l.intensity : undefined,
    };
  }
  if (typeof raw.waves === 'boolean') out.waves = raw.waves;
  if (typeof raw.caustics === 'boolean') out.caustics = raw.caustics;
  return out;
}

function normalizeVariants(input: unknown): NormalizedTheme['variants'] {
  if (!input || typeof input !== 'object') return undefined;
  const raw = input as Record<string, unknown>;
  const result: { PRACTICE?: ThemeVariant; CHALLENGE?: ThemeVariant; EXAM?: ThemeVariant } = {};
  for (const key of ['PRACTICE', 'CHALLENGE', 'EXAM'] as const) {
    const value = raw[key];
    if (!value || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>;
    const variant: ThemeVariant = {};
    if (v.atmosphere) {
      const a = normalizeAtmosphere(v.atmosphere);
      if (a) variant.atmosphere = a;
    }
    if (v.tokens && typeof v.tokens === 'object') {
      const t = v.tokens as Record<string, unknown>;
      variant.tokens = {
        light: typeof t.light === 'object' ? (t.light as Partial<ThemeTokens>) : undefined,
        dark: typeof t.dark === 'object' ? (t.dark as Partial<ThemeTokens>) : undefined,
      };
    }
    result[key] = variant;
  }
  return result;
}

export function isRawTheme(input: unknown): input is RawTheme {
  return normalizeTheme(input) !== null;
}
