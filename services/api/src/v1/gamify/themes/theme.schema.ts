import z from 'zod';

export const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

export const TOKEN_KEYS = [
  'bg',
  'surface',
  'fg',
  'muted',
  'border',
  'borderStrong',
  'primary',
  'primaryFg',
  'secondary',
  'secondaryFg',
  'accent',
  'focus',
  'foam',
  'sand',
] as const;

export type ThemeTokenKey = (typeof TOKEN_KEYS)[number];

export const hexColor = z
  .string()
  .regex(HEX_REGEX, { message: 'expected #RRGGBB' });

export const themeTokensSchema = z.object({
  bg: hexColor,
  surface: hexColor,
  fg: hexColor,
  muted: hexColor,
  border: hexColor,
  borderStrong: hexColor,
  primary: hexColor,
  primaryFg: hexColor,
  secondary: hexColor,
  secondaryFg: hexColor,
  accent: hexColor,
  focus: hexColor,
  foam: hexColor,
  sand: hexColor,
});

export const themeSchemePairSchema = z.object({
  light: themeTokensSchema,
  dark: themeTokensSchema,
});

export const atmosphereOptionsSchema = z.object({
  enabled: z.boolean().optional(),
  density: z.number().min(0).max(0.6).optional(),
  intensity: z.number().min(0).max(1).optional(),
});

export const atmosphereSchema = z.object({
  particles: atmosphereOptionsSchema.optional(),
  motion: z.object({ intensity: z.number().min(0).max(1).optional() }).optional(),
  lighting: z.object({ intensity: z.number().min(0).max(1).optional() }).optional(),
  waves: z.boolean().optional(),
  caustics: z.boolean().optional(),
});

export const themeVariantKeySchema = z.enum(['LEARN', 'PRACTICE', 'CHALLENGE', 'EXAM']);

export const themeVariantSchema = z.object({
  atmosphere: atmosphereSchema.optional(),
  tokens: z
    .object({
      light: themeTokensSchema.partial().optional(),
      dark: themeTokensSchema.partial().optional(),
    })
    .optional(),
});

export const themeVariantsSchema = z.object({
  PRACTICE: themeVariantSchema.optional(),
  CHALLENGE: themeVariantSchema.optional(),
  EXAM: themeVariantSchema.optional(),
});

export const normalizedThemeSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  primary: hexColor,
  secondary: hexColor,
  tertiary: hexColor.optional(),
  quaternary: hexColor.optional(),
  mood: z.array(z.string()).default([]),
  tokens: themeSchemePairSchema,
  atmosphere: atmosphereSchema.optional(),
  variants: themeVariantsSchema.optional(),
  isDefault: z.boolean().default(false),
  version: z.number().int().min(1).default(1),
});

export const createThemeSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  primary: hexColor,
  secondary: hexColor,
  tertiary: hexColor.optional(),
  quaternary: hexColor.optional(),
  slug: z.string().min(1).optional(),
  mood: z.array(z.string()).optional(),
  tokens: themeSchemePairSchema.optional(),
  atmosphere: atmosphereSchema.optional(),
  variants: themeVariantsSchema.optional(),
  isDefault: z.boolean().optional(),
});

export type ThemeTokens = z.infer<typeof themeTokensSchema>;
export type NormalizedTheme = z.infer<typeof normalizedThemeSchema>;
export type ThemeAtmosphere = z.infer<typeof atmosphereSchema>;
export type ThemeVariantKey = z.infer<typeof themeVariantKeySchema>;
