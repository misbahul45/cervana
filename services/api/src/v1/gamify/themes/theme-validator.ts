import type { ThemeTokens } from './theme.schema';

export type ContrastPair = readonly [string, string];

export interface ContrastIssue {
  level: 'body' | 'large' | 'ui';
  pair: ContrastPair;
  ratio: number;
  required: number;
}

const MIN_BODY = 4.5;
const MIN_LARGE = 3;
const MIN_UI = 3;

const REQUIRED_PAIRS: ReadonlyArray<{
  pair: ContrastPair;
  required: number;
  level: ContrastIssue['level'];
}> = [
  { pair: ['fg', 'bg'], required: MIN_BODY, level: 'body' },
  { pair: ['fg', 'surface'], required: MIN_BODY, level: 'body' },
  { pair: ['muted', 'bg'], required: MIN_BODY, level: 'body' },
  { pair: ['muted', 'surface'], required: MIN_BODY, level: 'body' },
  { pair: ['primaryFg', 'primary'], required: MIN_BODY, level: 'body' },
  { pair: ['secondaryFg', 'secondary'], required: MIN_BODY, level: 'body' },
  { pair: ['primary', 'surface'], required: MIN_BODY, level: 'body' },
  { pair: ['accent', 'surface'], required: MIN_BODY, level: 'body' },
  { pair: ['focus', 'bg'], required: MIN_UI, level: 'ui' },
  { pair: ['borderStrong', 'bg'], required: MIN_UI, level: 'ui' },
  { pair: ['borderStrong', 'surface'], required: MIN_UI, level: 'ui' },
];

function expandShortHex(value: string): string {
  const match = /^#([0-9a-fA-F]{3})$/.exec(value);
  if (!match) return value;
  const [r, g, b] = match[1].split('');
  return `#${r}${r}${g}${g}${b}${b}`;
}

function parseHex(value: string): [number, number, number] {
  const hex = expandShortHex(value).replace('#', '');
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function relativeLuminance(rgb: [number, number, number]): number {
  const channels = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(parseHex(foreground));
  const l2 = relativeLuminance(parseHex(background));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function pickTokens(
  base: ThemeTokens,
  overrides: Partial<ThemeTokens> | undefined,
): ThemeTokens {
  if (!overrides) return base;
  return { ...base, ...overrides };
}

export interface ValidateOptions {
  atmosphere?: { particles?: { density?: number }; motion?: { intensity?: number }; lighting?: { intensity?: number } };
}

export function validateThemeTokens(
  tokens: ThemeTokens,
  options?: ValidateOptions,
): ContrastIssue[] {
  const issues: ContrastIssue[] = [];

  for (const { pair, required, level } of REQUIRED_PAIRS) {
    const ratio = contrastRatio(tokens[pair[0]], tokens[pair[1]]);
    if (ratio + 1e-9 < required) {
      issues.push({ level, pair, ratio, required });
    }
  }

  const atmosphere = options?.atmosphere;
  if (atmosphere) {
    const density = atmosphere.particles?.density;
    if (density !== undefined && (density < 0 || density > 0.6)) {
      throw new Error(`atmosphere.particles.density out of range: ${density}`);
    }
    for (const key of ['motion', 'lighting'] as const) {
      const intensity = atmosphere[key]?.intensity;
      if (intensity !== undefined && (intensity < 0 || intensity > 1)) {
        throw new Error(`atmosphere.${key}.intensity out of range: ${intensity}`);
      }
    }
  }

  return issues;
}

export interface PublishThemeInput {
  tokens: { light: ThemeTokens; dark: ThemeTokens };
  variants?: {
    PRACTICE?: { tokens?: { light?: Partial<ThemeTokens>; dark?: Partial<ThemeTokens> } };
    CHALLENGE?: { tokens?: { light?: Partial<ThemeTokens>; dark?: Partial<ThemeTokens> } };
    EXAM?: { tokens?: { light?: Partial<ThemeTokens>; dark?: Partial<ThemeTokens> } };
  };
  atmosphere?: ValidateOptions['atmosphere'];
}

export function validateForPublish(theme: PublishThemeInput): ContrastIssue[] {
  const issues: ContrastIssue[] = [];

  for (const scheme of ['light', 'dark'] as const) {
    const base = theme.tokens[scheme];
    issues.push(
      ...validateThemeTokens(base, { atmosphere: theme.atmosphere }).map((issue) => ({
        ...issue,
        pair: [issue.pair[0], issue.pair[1]] as ContrastPair,
      })),
    );

    if (theme.variants?.CHALLENGE) {
      const override = theme.variants.CHALLENGE.tokens?.[scheme];
      if (override) {
        const merged = pickTokens(base, override);
        issues.push(
          ...validateThemeTokens(merged, { atmosphere: theme.atmosphere }).map((issue) => ({
            ...issue,
            pair: [issue.pair[0], issue.pair[1]] as ContrastPair,
          })),
        );
      }
    }
  }

  return issues;
}
