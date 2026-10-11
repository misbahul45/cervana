import * as fs from 'fs';
import * as path from 'path';
import { normalizedThemeSchema } from '../theme.schema';
import { validateForPublish } from '../theme-validator';

const seedDir = path.resolve(__dirname, '../../../../../prisma/seed-data');
const load = (slug: string) => JSON.parse(fs.readFileSync(path.join(seedDir, `${slug}.theme.json`), 'utf8'));

describe.each(['reducera-ocean', 'reducera-play'])('seed theme %s', (slug) => {
  it('parses with the api theme schema', () => {
    const parsed = normalizedThemeSchema.safeParse(load(slug));
    expect(parsed.success).toBe(true);
  });

  it('has no contrast issue in either scheme or in its variants, so it can be published', () => {
    const parsed = normalizedThemeSchema.parse(load(slug));
    expect(validateForPublish({ tokens: parsed.tokens, variants: parsed.variants, atmosphere: parsed.atmosphere })).toEqual([]);
  });
});

describe('seed theme reducera-play', () => {
  const parsed = normalizedThemeSchema.parse(load('reducera-play'));

  it('keeps every optional token and the shape after the schema parse', () => {
    expect(parsed.tokens.light.primaryDepth).toBe('#1F5A00');
    expect(parsed.tokens.dark.gold).toBe('#FFC800');
    expect(parsed.tokens.shape).toEqual({ radius: 16, depth: 4 });
  });

  it('is the light first brand theme with a calm exam variant', () => {
    expect(parsed.slug).toBe('reducera-play');
    expect(parsed.variants?.EXAM?.atmosphere?.motion?.intensity).toBe(0);
  });
});
