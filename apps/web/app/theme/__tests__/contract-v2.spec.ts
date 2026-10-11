import { describe, expect, it } from 'vitest';
import { normalizeTheme } from '../normalize';
import { resolveTheme } from '../resolve';
import { toCssVars } from '../css-vars';
import { DEFAULT_THEME } from '../default-theme';

const minimal = { slug: 's', title: 'T', primary: '#2F7D00', secondary: '#1D6FB8' };

const OPTIONAL = ['success', 'danger', 'warning', 'info', 'gold', 'flame', 'primaryDepth', 'secondaryDepth', 'dangerDepth', 'goldDepth'] as const;

describe('theme contract v2', () => {
  it('fills every optional token for both schemes when the theme has none', () => {
    const theme = normalizeTheme(minimal)!;

    for (const scheme of ['light', 'dark'] as const) {
      for (const key of OPTIONAL) {
        expect(theme.tokens[scheme][key]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it('keeps optional tokens that the theme provides and defaults the rest', () => {
    const theme = normalizeTheme({ ...minimal, tokens: { light: { success: '#00AA00' }, dark: {} } })!;

    expect(theme.tokens.light.success).toBe('#00AA00');
    expect(theme.tokens.light.danger).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(theme.tokens.dark.success).not.toBe('#00AA00');
  });

  it('ignores an optional token that is not 6-digit hex', () => {
    const theme = normalizeTheme({ ...minimal, tokens: { light: { gold: 'yellow', flame: '#FFF' } } })!;

    expect(theme.tokens.light.gold).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(theme.tokens.light.gold).not.toBe('yellow');
    expect(theme.tokens.light.flame).not.toBe('#FFF');
  });

  it('reads the shape and falls back to radius 8 and depth 0', () => {
    expect(normalizeTheme({ ...minimal, tokens: { shape: { radius: 16, depth: 4 } } })!.shape).toEqual({ radius: 16, depth: 4 });
    expect(normalizeTheme(minimal)!.shape).toEqual({ radius: 8, depth: 0 });
  });

  it('rejects a shape outside 6 to 24 and 0 to 6 or with fractions', () => {
    for (const shape of [{ radius: 5, depth: 2 }, { radius: 25, depth: 2 }, { radius: 12, depth: 7 }, { radius: 12, depth: -1 }, { radius: 12.5, depth: 2 }, { radius: '12', depth: 2 }]) {
      expect(normalizeTheme({ ...minimal, tokens: { shape } })!.shape).toEqual({ radius: 8, depth: 0 });
    }
  });

  it('carries the shape through the resolver and into css variables', () => {
    const theme = normalizeTheme({ ...minimal, tokens: { shape: { radius: 16, depth: 4 } } })!;
    const resolved = resolveTheme({ chain: [theme], variant: 'LEARN', scheme: 'light', reducedMotion: false, fallback: DEFAULT_THEME });

    expect(resolved.shape).toEqual({ radius: 16, depth: 4 });
    const vars = toCssVars(resolved);
    expect(vars['--rc-radius']).toBe('16px');
    expect(vars['--rc-depth']).toBe('4px');
  });

  it('exposes the optional tokens as css variables', () => {
    const theme = normalizeTheme({ ...minimal, tokens: { light: { success: '#00AA00', primaryDepth: '#112233' } } })!;
    const resolved = resolveTheme({ chain: [theme], variant: 'LEARN', scheme: 'light', reducedMotion: false, fallback: DEFAULT_THEME });
    const vars = toCssVars(resolved);

    expect(vars['--rc-success']).toBe('#00AA00');
    expect(vars['--rc-primary-depth']).toBe('#112233');
    for (const name of ['--rc-danger', '--rc-warning', '--rc-info', '--rc-gold', '--rc-flame', '--rc-secondary-depth', '--rc-danger-depth', '--rc-gold-depth']) {
      expect(vars[name]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
