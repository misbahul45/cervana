import { describe, expect, it } from 'vitest';
import { darkStylesheet, shellBindings, shellRender } from '../shell';
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

describe('shellRender', () => {
  it('always renders the light palette inline, so the server HTML and the first client render agree', () => {
    const render = shellRender({ ...base, chain: [DEFAULT_THEME] });

    expect(render.style).toContain(`--rc-bg: ${DEFAULT_THEME.tokens.light.bg}`);
    expect(render.style).not.toContain(DEFAULT_THEME.tokens.dark.bg);
    expect(render.attrs['data-rc-theme']).toBe(DEFAULT_THEME.slug);
    expect(render.attrs).not.toHaveProperty('data-rc-scheme');
  });

  it('carries the dark palette as a stylesheet that wins over the inline light values only under .dark', () => {
    const { darkCss } = shellRender({ ...base, chain: [DEFAULT_THEME] });

    expect(darkCss.startsWith(`.dark [data-rc-theme="${DEFAULT_THEME.slug}"] {`)).toBe(true);
    expect(darkCss).toContain(`--rc-bg: ${DEFAULT_THEME.tokens.dark.bg} !important`);
    expect(darkCss).toContain(`--rc-primary: ${DEFAULT_THEME.tokens.dark.primary} !important`);
    expect(darkCss).not.toContain(DEFAULT_THEME.tokens.light.bg);
    for (const declaration of darkCss.split('{')[1]!.replace('}', '').split(';').map((d) => d.trim()).filter(Boolean)) {
      expect(declaration.endsWith('!important')).toBe(true);
    }
  });

  it('has nothing to add when no theme is supplied, since the global stylesheet already holds both palettes', () => {
    const render = shellRender({ ...base, chain: [] });

    expect(render.darkCss).toBe('');
    expect(render.style).toBe('');
  });

  it('keeps the reduced motion choice in the attributes', () => {
    expect(shellRender({ ...base, chain: [DEFAULT_THEME], reducedMotion: true }).attrs['data-rc-motion']).toBe('off');
    expect(shellRender({ ...base, chain: [DEFAULT_THEME], reducedMotion: false }).attrs['data-rc-motion']).toBe('on');
  });
});

describe('darkStylesheet', () => {
  it('turns declarations into important overrides under the dark class', () => {
    expect(darkStylesheet('play', '--rc-bg: #131F24; --rc-depth: 4px')).toBe(
      '.dark [data-rc-theme="play"] { --rc-bg: #131F24 !important; --rc-depth: 4px !important; }',
    );
  });

  it('drops a declaration that is not a plain --rc custom property with a plain value', () => {
    const css = darkStylesheet('play', '--rc-bg: #000; color: red; --rc-x: red;} body{display:none; --rc-y: url(x); --rc-z: 1px /* c */');

    expect(css).toBe('.dark [data-rc-theme="play"] { --rc-bg: #000 !important; --rc-x: red !important; }');
  });

  it('refuses a slug that could break out of the selector, and an empty style', () => {
    expect(darkStylesheet('play"] body{display:none}', '--rc-bg: #000')).toBe('');
    expect(darkStylesheet('play', '')).toBe('');
    expect(darkStylesheet('play', 'color: red')).toBe('');
  });
});
