import { HEX_REGEX, OPTIONAL_TOKEN_KEYS, themeSchemePairSchema, themeShapeSchema } from '../theme.schema';

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

  describe('contract v2 optional tokens and shape', () => {
    const base = {
      bg: '#FFFFFF',
      surface: '#FFFFFF',
      fg: '#3C3C3C',
      muted: '#6B6B6B',
      border: '#E5E5E5',
      borderStrong: '#8A8A8A',
      primary: '#2F7D00',
      primaryFg: '#FFFFFF',
      secondary: '#1D6FB8',
      secondaryFg: '#FFFFFF',
      accent: '#B85C00',
      focus: '#1D6FB8',
      foam: '#F7F7F7',
      sand: '#FFF4D6',
    };
    const optional = {
      success: '#58CC02',
      danger: '#D92D2D',
      warning: '#FF9600',
      info: '#1CB0F6',
      gold: '#FFC800',
      flame: '#FF9600',
      primaryDepth: '#1F5A00',
      secondaryDepth: '#124F86',
      dangerDepth: '#A31F1F',
      goldDepth: '#C79A00',
    };

    it('lists the ten optional keys', () => {
      expect([...OPTIONAL_TOKEN_KEYS].sort()).toEqual(Object.keys(optional).sort());
    });

    it('keeps optional tokens in the parsed output instead of stripping them', () => {
      const result = themeSchemePairSchema.parse({ light: { ...base, ...optional }, dark: { ...base, ...optional } });
      expect(result.light).toMatchObject(optional);
      expect(result.dark.gold).toBe('#FFC800');
    });

    it('still accepts a theme that has none of the optional tokens', () => {
      const result = themeSchemePairSchema.safeParse({ light: base, dark: base });
      expect(result.success).toBe(true);
    });

    it('rejects an optional token that is not 6-digit hex', () => {
      const result = themeSchemePairSchema.safeParse({ light: { ...base, success: 'green' }, dark: base });
      expect(result.success).toBe(false);
    });

    it('accepts a shape within bounds and keeps it', () => {
      const result = themeSchemePairSchema.parse({ light: base, dark: base, shape: { radius: 16, depth: 4 } });
      expect(result.shape).toEqual({ radius: 16, depth: 4 });
    });

    it('bounds the shape: radius 6 to 24, depth 0 to 6, whole numbers', () => {
      expect(themeShapeSchema.safeParse({ radius: 6, depth: 0 }).success).toBe(true);
      expect(themeShapeSchema.safeParse({ radius: 24, depth: 6 }).success).toBe(true);
      expect(themeShapeSchema.safeParse({ radius: 5, depth: 2 }).success).toBe(false);
      expect(themeShapeSchema.safeParse({ radius: 25, depth: 2 }).success).toBe(false);
      expect(themeShapeSchema.safeParse({ radius: 12, depth: 7 }).success).toBe(false);
      expect(themeShapeSchema.safeParse({ radius: 12, depth: -1 }).success).toBe(false);
      expect(themeShapeSchema.safeParse({ radius: 12.5, depth: 2 }).success).toBe(false);
    });
  });
});
