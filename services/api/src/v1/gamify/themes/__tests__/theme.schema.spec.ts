import { HEX_REGEX, themeSchemePairSchema } from '../theme.schema';

describe('theme Zod schemas', () => {
  describe('HEX_REGEX', () => {
    it('accepts canonical 6-digit hex', () => {
      expect(HEX_REGEX.test('#0B7285')).toBe(true);
      expect(HEX_REGEX.test('#FFFFFF')).toBe(true);
      expect(HEX_REGEX.test('#000000')).toBe(true);
    });

    it('rejects short, long, and non-hex strings', () => {
      expect(HEX_REGEX.test('#FFF')).toBe(false);
      expect(HEX_REGEX.test('#FFFFFFF')).toBe(false);
      expect(HEX_REGEX.test('0B7285')).toBe(false);
      expect(HEX_REGEX.test('#ZZZZZZ')).toBe(false);
      expect(HEX_REGEX.test('rgb(11,114,133)')).toBe(false);
    });
  });

  describe('themeSchemePairSchema', () => {
    const validLight = {
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

    it('accepts the canonical ocean scheme', () => {
      const result = themeSchemePairSchema.safeParse({
        light: validLight,
        dark: { ...validLight, bg: '#04202D' },
      });
      expect(result.success).toBe(true);
    });

    it('rejects when a key is missing', () => {
      const incomplete = { ...validLight } as Record<string, string>;
      delete incomplete.bg;
      const result = themeSchemePairSchema.safeParse({
        light: incomplete,
        dark: validLight,
      });
      expect(result.success).toBe(false);
    });

    it('rejects when a value is not 6-digit hex', () => {
      const result = themeSchemePairSchema.safeParse({
        light: { ...validLight, primary: 'cyan' },
        dark: validLight,
      });
      expect(result.success).toBe(false);
    });

    it('rejects 8-digit hex (alpha not allowed in v1)', () => {
      const result = themeSchemePairSchema.safeParse({
        light: { ...validLight, primary: '#0B728580' },
        dark: validLight,
      });
      expect(result.success).toBe(false);
    });
  });
});
