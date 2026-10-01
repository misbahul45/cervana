import { contrastRatio, validateForPublish, validateThemeTokens } from '../theme-validator';
import type { ThemeTokens } from '../theme.schema';

const OCEAN_LIGHT: ThemeTokens = {
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

const OCEAN_DARK: ThemeTokens = {
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

describe('contrastRatio', () => {
  it('returns 21 for #FFFFFF on #000000', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 2);
  });

  it('returns 1 for the same color against itself', () => {
    expect(contrastRatio('#888888', '#888888')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(contrastRatio('#FFFFFF', '#000000'), 5);
  });

  it('matches documented ocean-token pairs', () => {
    expect(contrastRatio(OCEAN_LIGHT.fg, OCEAN_LIGHT.bg)).toBeCloseTo(14.97, 1);
    expect(contrastRatio(OCEAN_LIGHT.muted, OCEAN_LIGHT.bg)).toBeCloseTo(6.81, 1);
    expect(contrastRatio(OCEAN_DARK.fg, OCEAN_DARK.bg)).toBeCloseTo(15.24, 1);
    expect(contrastRatio(OCEAN_DARK.muted, OCEAN_DARK.bg)).toBeCloseTo(9.69, 1);
  });
});

describe('validateThemeTokens', () => {
  it('returns zero issues for the canonical ocean theme', () => {
    expect(validateThemeTokens(OCEAN_LIGHT)).toEqual([]);
    expect(validateThemeTokens(OCEAN_DARK)).toEqual([]);
  });

  it('flags a low-contrast body pair', () => {
    const bad: ThemeTokens = {
      ...OCEAN_LIGHT,
      fg: '#888888',
      bg: '#888888',
    };
    const issues = validateThemeTokens(bad);
    expect(issues.some((i) => i.pair[0] === 'fg' && i.pair[1] === 'bg')).toBe(true);
  });

  it('throws when atmosphere intensity is out of range', () => {
    expect(() =>
      validateThemeTokens(OCEAN_LIGHT, { atmosphere: { motion: { intensity: 2 } } }),
    ).toThrow(/motion.intensity/);
  });
});

describe('validateForPublish', () => {
  it('passes the canonical ocean theme across both schemes', () => {
    expect(
      validateForPublish({
        tokens: { light: OCEAN_LIGHT, dark: OCEAN_DARK },
      }),
    ).toEqual([]);
  });

  it('catches a challenge override that drops contrast', () => {
    const issues = validateForPublish({
      tokens: { light: OCEAN_LIGHT, dark: OCEAN_DARK },
      variants: {
        CHALLENGE: {
          tokens: {
            light: { muted: '#888888' },
            dark: { muted: '#999999' },
          },
        },
      },
    });
    expect(issues.length).toBeGreaterThan(0);
  });
});
