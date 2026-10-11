import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import playThemeJson from '../reducera-play.theme.json';
import oceanThemeJson from '../reducera-ocean.theme.json';
import { DEFAULT_THEME } from '../default-theme';
import { normalizeTheme } from '../normalize';
import { resolveTheme } from '../resolve';
import { toCssVars } from '../css-vars';
import { contrastRatio } from '../color';
import type { ColorScheme, ThemeTokens } from '../types';

const css = readFileSync(join(__dirname, '..', '..', 'assets', 'css', 'main.css'), 'utf8');

const block = (selector: ':root' | '.dark'): Record<string, string> => {
  const start = css.indexOf(`\n${selector} {`);
  const end = css.indexOf('\n}', start);
  return Object.fromEntries(
    [...css.slice(start, end).matchAll(/(--rc-[a-z-]+):\s*(#[0-9A-Fa-f]{6}|\d+px)/g)].map((m) => [m[1]!, m[2]!.toUpperCase().replace('PX', 'px')]),
  );
};

const REQUIRED_PAIRS: ReadonlyArray<readonly [keyof ThemeTokens, keyof ThemeTokens, number]> = [
  ['fg', 'bg', 4.5],
  ['fg', 'surface', 4.5],
  ['muted', 'bg', 4.5],
  ['muted', 'surface', 4.5],
  ['primaryFg', 'primary', 4.5],
  ['secondaryFg', 'secondary', 4.5],
  ['primary', 'surface', 4.5],
  ['accent', 'surface', 4.5],
  ['focus', 'bg', 3],
  ['borderStrong', 'bg', 3],
  ['borderStrong', 'surface', 3],
];

describe('reducera-play default theme', () => {
  it('is the bundled default and the ocean theme still normalizes', () => {
    expect(DEFAULT_THEME.slug).toBe('reducera-play');
    expect(normalizeTheme(oceanThemeJson)?.slug).toBe('reducera-ocean');
  });

  it('declares every optional token explicitly in both schemes and a shape of radius 16 and depth 4', () => {
    const tokens = (playThemeJson as { tokens: { light: Record<string, string>; dark: Record<string, string>; shape: unknown } }).tokens;
    for (const key of ['success', 'danger', 'warning', 'info', 'gold', 'flame', 'primaryDepth', 'secondaryDepth', 'dangerDepth', 'goldDepth']) {
      expect(tokens.light[key], `light.${key}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(tokens.dark[key], `dark.${key}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
    expect(tokens.shape).toEqual({ radius: 16, depth: 4 });
  });

  for (const scheme of ['light', 'dark'] as const satisfies readonly ColorScheme[]) {
    it(`passes the platform contrast pairs in the ${scheme} scheme`, () => {
      const tokens = DEFAULT_THEME.tokens[scheme];
      for (const [fg, bg, required] of REQUIRED_PAIRS) {
        expect(contrastRatio(tokens[fg], tokens[bg]), `${scheme} ${fg} on ${bg}`).toBeGreaterThanOrEqual(required);
      }
    });

    it(`matches the static css variables of the ${scheme} scheme in main.css`, () => {
      const resolved = resolveTheme({ chain: [DEFAULT_THEME], variant: 'LEARN', scheme, reducedMotion: false, fallback: DEFAULT_THEME });
      const expected = Object.fromEntries(
        Object.entries(toCssVars(resolved)).filter(([name, value]) => name.startsWith('--rc-') && /^#[0-9A-Fa-f]{6}$/.test(value)).map(([name, value]) => [name, value.toUpperCase()]),
      );
      const actual = block(scheme === 'light' ? ':root' : '.dark');

      expect(Object.keys(expected).length).toBeGreaterThanOrEqual(24);
      for (const [name, value] of Object.entries(expected)) {
        expect(actual[name], name).toBe(value);
      }
    });
  }

  it('matches the static shape variables in main.css', () => {
    const actual = block(':root');
    expect(actual['--rc-radius']).toBe('16px');
    expect(actual['--rc-depth']).toBe('4px');
  });

  it('has its practice and exam variants calm: exam removes all atmosphere', () => {
    expect(DEFAULT_THEME.variants?.EXAM?.atmosphere?.motion?.intensity).toBe(0);
    expect(DEFAULT_THEME.atmosphere?.waves).toBe(false);
  });
});
