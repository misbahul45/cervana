import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, '..', '..', 'assets', 'css', 'main.css'), 'utf8');

function tokens(selector: ':root' | '.dark'): Record<string, string> {
  const start = css.indexOf(`\n${selector} {`);
  const end = css.indexOf('\n}', start);
  const block = css.slice(start, end);
  return Object.fromEntries([...block.matchAll(/--rc-([a-z-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1]!, m[2]!.toUpperCase()]));
}

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function ratio(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high! + 0.05) / (low! + 0.05);
}

const DOCUMENTED_PAIRS: ReadonlyArray<readonly [string, string, number]> = [
  ['fg', 'bg', 4.5],
  ['fg', 'surface', 4.5],
  ['muted', 'bg', 4.5],
  ['muted', 'surface', 4.5],
  ['primary-fg', 'primary', 4.5],
  ['secondary-fg', 'secondary', 4.5],
  ['primary', 'surface', 4.5],
  ['accent', 'surface', 4.5],
  ['focus', 'bg', 3],
  ['border-strong', 'bg', 3],
  ['border-strong', 'surface', 3],
];

describe.each([
  [':root', 'light'],
  ['.dark', 'dark'],
] as const)('documented palette (%s, %s scheme)', (selector) => {
  const palette = tokens(selector);

  it.each(DOCUMENTED_PAIRS)('%s on %s keeps at least %s:1', (fg, bg, required) => {
    expect(palette[fg], `--rc-${fg}`).toBeDefined();
    expect(palette[bg], `--rc-${bg}`).toBeDefined();
    expect(ratio(palette[fg]!, palette[bg]!)).toBeGreaterThanOrEqual(required);
  });
});

describe('documented token values', () => {
  it('matches the Play palette of the design document', () => {
    expect(tokens(':root')).toMatchObject({
      bg: '#FFFFFF',
      surface: '#FFFFFF',
      fg: '#3C3C3C',
      muted: '#6B6B6B',
      primary: '#2F7D00',
      'primary-fg': '#FFFFFF',
      secondary: '#1D6FB8',
      accent: '#B85C00',
      focus: '#1D6FB8',
    });
    expect(tokens('.dark')).toMatchObject({
      bg: '#131F24',
      surface: '#1F2C33',
      fg: '#F1F7FA',
      muted: '#9FB0B8',
      primary: '#58CC02',
      'primary-fg': '#0B2B00',
      secondary: '#49C0F8',
      accent: '#FFB020',
      focus: '#49C0F8',
    });
  });

  it('defines the Nuxt UI primary foreground so solid buttons stay readable', () => {
    expect(css).toMatch(/--ui-primary-fg:\s*var\(--rc-primary-fg\)/);
  });
});

describe('custom property usage', () => {
  it('never reads a --rc token that the stylesheet does not define', async () => {
    const { readdirSync, statSync } = await import('node:fs');
    const appRoot = join(__dirname, '..', '..');
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return ['__tests__', 'node_modules'].includes(entry) ? [] : files(full);
        return /\.(vue|css)$/.test(full) ? [full] : [];
      });

    const stylesheets = ['main.css', 'play.css', 'landing.css', 'admin.css', 'market.css', 'article.css'].map((name) => readFileSync(join(appRoot, 'assets', 'css', name), 'utf8')).join('\n');
    const defined = new Set([...stylesheets.matchAll(/--(rc-[a-z0-9-]+)\s*:/g)].map((match) => match[1]!));
    const runtimeThemed = /^rc-page-/;
    const undefinedUses = new Set<string>();

    for (const file of files(appRoot)) {
      for (const match of readFileSync(file, 'utf8').matchAll(/var\(--(rc-[a-z0-9-]+)/g)) {
        const token = match[1]!;
        if (!defined.has(token) && !runtimeThemed.test(token)) undefinedUses.add(token);
      }
    }

    expect([...undefinedUses]).toEqual([]);
  });
});
