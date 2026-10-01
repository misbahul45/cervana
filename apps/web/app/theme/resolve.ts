import type {
  ColorScheme,
  NormalizedTheme,
  RawTheme,
  ThemeAtmosphere,
  ThemeTokens,
  ThemeVariant,
  ThemeVariantKey,
} from './types';
import { mergeTokens } from './normalize';

export interface ResolveThemeInput {
  chain: ReadonlyArray<RawTheme | null | undefined>;
  variant: ThemeVariantKey;
  scheme: ColorScheme;
  reducedMotion: boolean;
  fallback: NormalizedTheme;
}

export interface ResolvedTheme {
  tokens: ThemeTokens;
  atmosphere: ThemeAtmosphere;
  meta: {
    slug: string;
    title: string;
    version: number;
    variant: ThemeVariantKey;
    scheme: ColorScheme;
    reducedMotion: boolean;
  };
}

function applyVariant(
  base: ThemeAtmosphere,
  variant?: ThemeVariant,
): ThemeAtmosphere {
  if (!variant?.atmosphere) return base;
  return {
    particles: { ...base.particles, ...variant.atmosphere.particles },
    motion: { ...base.motion, ...variant.atmosphere.motion },
    lighting: { ...base.lighting, ...variant.atmosphere.lighting },
    waves: variant.atmosphere.waves ?? base.waves,
    caustics: variant.atmosphere.caustics ?? base.caustics,
  };
}

function enforceMotionBudget(atmosphere: ThemeAtmosphere, reducedMotion: boolean): ThemeAtmosphere {
  if (!reducedMotion) return atmosphere;
  return {
    particles: { ...atmosphere.particles, enabled: false, density: 0 },
    motion: { intensity: 0 },
    lighting: { ...atmosphere.lighting },
    waves: false,
    caustics: false,
  };
}

export function resolveTheme(input: ResolveThemeInput): ResolvedTheme {
  for (const entry of input.chain) {
    if (!entry) continue;
    const candidate = entry as NormalizedTheme | RawTheme;
    if (!candidate.slug) continue;

    const variant = candidate.variants?.[input.variant];
    const baseAtmosphere: ThemeAtmosphere = candidate.atmosphere ?? input.fallback.atmosphere ?? {};
    const atmosphere = enforceMotionBudget(
      applyVariant(baseAtmosphere, variant),
      input.reducedMotion,
    );

    const baseTokens = candidate.tokens[input.scheme];
    const mergedTokens = mergeTokens(baseTokens, variant?.tokens?.[input.scheme]);

    return {
      tokens: mergedTokens,
      atmosphere,
      meta: {
        slug: candidate.slug,
        title: candidate.title,
        version: candidate.version,
        variant: input.variant,
        scheme: input.scheme,
        reducedMotion: input.reducedMotion,
      },
    };
  }

  const fallbackVariant = input.fallback.variants?.[input.variant];
  const fallbackAtmosphere = enforceMotionBudget(
    applyVariant(input.fallback.atmosphere ?? {}, fallbackVariant),
    input.reducedMotion,
  );
  const fallbackTokens = mergeTokens(
    input.fallback.tokens[input.scheme],
    fallbackVariant?.tokens?.[input.scheme],
  );

  return {
    tokens: fallbackTokens,
    atmosphere: fallbackAtmosphere,
    meta: {
      slug: input.fallback.slug,
      title: input.fallback.title,
      version: input.fallback.version,
      variant: input.variant,
      scheme: input.scheme,
      reducedMotion: input.reducedMotion,
    },
  };
}
