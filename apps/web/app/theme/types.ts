export type ThemeVariantKey = 'LEARN' | 'PRACTICE' | 'CHALLENGE' | 'EXAM';

export type ColorScheme = 'light' | 'dark';

export type ThemeTokenKey =
  | 'bg'
  | 'surface'
  | 'fg'
  | 'muted'
  | 'border'
  | 'borderStrong'
  | 'primary'
  | 'primaryFg'
  | 'secondary'
  | 'secondaryFg'
  | 'accent'
  | 'focus'
  | 'foam'
  | 'sand';

export type ThemeTokens = Readonly<Record<ThemeTokenKey, string>>;

export interface ThemeAtmosphere {
  particles?: { enabled?: boolean; density?: number };
  motion?: { intensity?: number };
  lighting?: { intensity?: number };
  waves?: boolean;
  caustics?: boolean;
}

export interface ThemeVariant {
  atmosphere?: ThemeAtmosphere;
  tokens?: { light?: Partial<ThemeTokens>; dark?: Partial<ThemeTokens> };
}

export interface NormalizedTheme {
  slug: string;
  title: string;
  description?: string;
  primary: string;
  secondary: string;
  tertiary?: string;
  quaternary?: string;
  mood: ReadonlyArray<string>;
  tokens: { light: ThemeTokens; dark: ThemeTokens };
  atmosphere?: ThemeAtmosphere;
  variants?: {
    PRACTICE?: ThemeVariant;
    CHALLENGE?: ThemeVariant;
    EXAM?: ThemeVariant;
  };
  isDefault?: boolean;
  version: number;
  status?: string;
  scope?: string;
  bgImage?: { fileId?: string; url?: string };
  planetImage?: { fileId?: string; url?: string };
}

export type RawTheme = NormalizedTheme;
