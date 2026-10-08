import { describe, expect, it } from 'vitest';
import { shellBindings } from '../shell';
import { DEFAULT_THEME } from '../default-theme';

const base = { variant: 'LEARN' as const, reducedMotion: false };

describe('shellBindings', () => {
  it('leaves the palette to the global stylesheet but still names the default theme in the first HTML', () => {
    const expected = {
      style: '',
      attrs: { 'data-rc-theme': DEFAULT_THEME.slug, 'data-rc-variant': 'LEARN', 'data-rc-motion': 'on' },
    };
    expect(shellBindings({ ...base, chain: [], scheme: 'dark' })).toEqual(expected);
    expect(shellBindings({ ...base, chain: [null, undefined], scheme: 'light' })).toEqual(expected);
  });

  it('does not depend on the color scheme when no theme is supplied, so SSR and hydration agree', () => {
    expect(shellBindings({ ...base, chain: [], scheme: 'dark' })).toEqual(shellBindings({ ...base, chain: [], scheme: 'light' }));
  });

  it('never pins the light palette while the page is dark', () => {
    const light = shellBindings({ ...base, chain: [DEFAULT_THEME], scheme: 'light' });
    const dark = shellBindings({ ...base, chain: [DEFAULT_THEME], scheme: 'dark' });

    expect(light.style).toContain(`--rc-bg: ${DEFAULT_THEME.tokens.light.bg}`);
    expect(dark.style).toContain(`--rc-bg: ${DEFAULT_THEME.tokens.dark.bg}`);
    expect(dark.style).not.toContain(DEFAULT_THEME.tokens.light.bg);
    expect(dark.attrs['data-rc-scheme']).toBe('dark');
  });

  it('keeps text readable against the background in both schemes', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const { fg, bg, muted } = DEFAULT_THEME.tokens[scheme];
      const luminance = (hex: string) => {
        const channel = (offset: number) => {
          const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
          return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
      };
      const ratio = (a: string, b: string) => {
        const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (high! + 0.05) / (low! + 0.05);
      };
      expect(ratio(fg, bg)).toBeGreaterThanOrEqual(7);
      expect(ratio(muted, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
