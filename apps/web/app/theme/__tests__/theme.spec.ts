import { describe, expect, it } from 'vitest';
import { normalizeTheme, mergeTokens, isRawTheme } from '../normalize';
import { resolveTheme } from '../resolve';
import { toCssVars } from '../css-vars';
import { contrastRatio, withAlpha, parseHex } from '../color';
import { DEFAULT_THEME } from '../default-theme';
import oceanThemeJson from '../reducera-ocean.theme.json';

describe('web theme library', () => {
  describe('normalize', () => {
    it('returns null for non-objects', () => {
      expect(normalizeTheme(null)).toBeNull();
      expect(normalizeTheme('x')).toBeNull();
      expect(normalizeTheme(42)).toBeNull();
    });

    it('returns null when required fields are missing', () => {
      expect(normalizeTheme({ slug: 'x' })).toBeNull();
      expect(normalizeTheme({ slug: 'x', title: 'X' })).toBeNull();
    });

    it('fills missing tokens with the default ocean palette', () => {
      const minimal = { slug: 's', title: 'T', primary: '#000', secondary: '#fff' };
      const normalized = normalizeTheme(minimal);
      expect(normalized).not.toBeNull();
      expect(normalized!.tokens.light.bg).toBe('#F2FAFB');
      expect(normalized!.tokens.dark.bg).toBe('#04202D');
    });

    it('isRawTheme agrees with normalizeTheme', () => {
      expect(isRawTheme({ slug: 's', title: 'T', primary: '#000', secondary: '#fff' })).toBe(true);
      expect(isRawTheme(null)).toBe(false);
    });

    it('mergeTokens overrides only specified keys', () => {
      const merged = mergeTokens(
        DEFAULT_THEME.tokens.light,
        { primary: '#123456', bg: '#ABCDEF' },
      );
      expect(merged.primary).toBe('#123456');
      expect(merged.bg).toBe('#ABCDEF');
      expect(merged.fg).toBe(DEFAULT_THEME.tokens.light.fg);
    });
  });

  describe('resolveTheme (golden tests)', () => {
    it('1) Topic overrides Step when present', () => {
      const topic = normalizeTheme({
        ...oceanThemeJson,
        slug: 'custom-topic',
        title: 'Custom',
        tokens: {
          light: { primary: '#111111', dark: { primary: '#222222' } },
        },
      });
      const result = resolveTheme({
        chain: [topic, DEFAULT_THEME],
        variant: 'LEARN',
        scheme: 'light',
        reducedMotion: false,
        fallback: DEFAULT_THEME,
      });
      expect(result.meta.slug).toBe('custom-topic');
      expect(result.tokens.primary).toBe('#111111');
    });

    it('2) null chain entries are skipped, fallback used', () => {
      const result = resolveTheme({
        chain: [null, undefined, DEFAULT_THEME],
        variant: 'LEARN',
        scheme: 'light',
        reducedMotion: false,
        fallback: DEFAULT_THEME,
      });
      expect(result.meta.slug).toBe(DEFAULT_THEME.slug);
    });

    it('3) invalid (non-normalizable) entries are skipped silently', () => {
      const result = resolveTheme({
        chain: [null, { foo: 'bar' } as never, DEFAULT_THEME],
        variant: 'LEARN',
        scheme: 'light',
        reducedMotion: false,
        fallback: DEFAULT_THEME,
      });
      expect(result.meta.slug).toBe(DEFAULT_THEME.slug);
    });

    it('4) PRACTICE variant reduces density and disables waves', () => {
      const result = resolveTheme({
        chain: [DEFAULT_THEME],
        variant: 'PRACTICE',
        scheme: 'light',
        reducedMotion: false,
        fallback: DEFAULT_THEME,
      });
      expect(result.atmosphere.particles?.density).toBe(0.2);
      expect(result.atmosphere.waves).toBe(false);
    });

    it('5) EXAM zeroes atmosphere', () => {
      const result = resolveTheme({
        chain: [DEFAULT_THEME],
        variant: 'EXAM',
        scheme: 'light',
        reducedMotion: false,
        fallback: DEFAULT_THEME,
      });
      expect(result.atmosphere.particles?.enabled).toBe(false);
      expect(result.atmosphere.motion?.intensity).toBe(0);
      expect(result.atmosphere.waves).toBe(false);
      expect(result.atmosphere.caustics).toBe(false);
    });

    it('6) reducedMotion disables motion regardless of theme', () => {
      const result = resolveTheme({
        chain: [DEFAULT_THEME],
        variant: 'LEARN',
        scheme: 'dark',
        reducedMotion: true,
        fallback: DEFAULT_THEME,
      });
      expect(result.atmosphere.particles?.enabled).toBe(false);
      expect(result.atmosphere.motion?.intensity).toBe(0);
      expect(result.atmosphere.waves).toBe(false);
    });
  });

  describe('toCssVars', () => {
    it('produces 14 RC tokens + atmosphere vars', () => {
      const result = resolveTheme({
        chain: [DEFAULT_THEME],
        variant: 'LEARN',
        scheme: 'light',
        reducedMotion: false,
        fallback: DEFAULT_THEME,
      });
      const vars = toCssVars(result);
      expect(vars['--rc-bg']).toBe(DEFAULT_THEME.tokens.light.bg);
      expect(vars['--rc-primary']).toBe(DEFAULT_THEME.tokens.light.primary);
      expect(vars['--rc-motion-intensity']).toBe('0.25');
    });
  });

  describe('color utilities', () => {
    it('parseHex returns RGB on canonical hex', () => {
      expect(parseHex('#0B7285')).toEqual([11, 114, 133]);
    });

    it('parseHex expands 3-digit shorthand', () => {
      expect(parseHex('#FFF')).toEqual([255, 255, 255]);
    });

    it('parseHex returns null for invalid input', () => {
      expect(parseHex('cyan')).toBeNull();
      expect(parseHex('#ZZZZZZ')).toBeNull();
      expect(parseHex('#FFFFFFF')).toBeNull();
    });

    it('contrastRatio returns 21 for white-on-black', () => {
      expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    });

    it('withAlpha appends a two-digit alpha suffix', () => {
      expect(withAlpha('#0B7285', 50)).toBe('#0B728580');
    });

    it('withAlpha expands 3-digit shorthand first', () => {
      expect(withAlpha('#FFF', 50)).toBe('#FFFFFF80');
    });
  });

  describe('default theme sanity', () => {
    it('parses the bundled ocean JSON', () => {
      expect(DEFAULT_THEME.slug).toBe('reducera-ocean');
      expect(DEFAULT_THEME.tokens.light.bg).toBe('#F2FAFB');
      expect(DEFAULT_THEME.variants?.EXAM?.atmosphere?.motion?.intensity).toBe(0);
    });
  });
});
