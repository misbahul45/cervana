import { describe, expect, it, vi } from 'vitest';
import { parseDefaultThemeResponse } from '../default-payload';
import { createDefaultThemeLoader } from '../default-loader';
import { DEFAULT_THEME } from '../default-theme';
import type { DefaultThemePayload } from '../default-payload';

const apiTheme = {
  slug: 'reducera-play',
  title: 'Play',
  primary: '#2F7D00',
  secondary: '#1D6FB8',
  mood: ['playful'],
  version: 3,
  isDefault: true,
  tokens: { light: { bg: '#FFFFFF' }, dark: { bg: '#131F24' }, shape: { radius: 16, depth: 4 } },
  icons: [
    { id: 'i1', themeId: 't', name: 'streak', imageIcon: { fileId: 'bundled:reducera-play:streak', url: '/themes/reducera-play/icons/streak.svg' } },
    { id: 'i2', themeId: 't', name: 'xp', imageIcon: 'https://cdn.example.com/xp.svg' },
    { id: 'i3', themeId: 't', name: 'bad', imageIcon: 'javascript:alert(1)' },
    { id: 'i4', themeId: 't', imageIcon: '/x.svg' },
    { id: 'i5', themeId: 't', name: 'star', imageIcon: null },
    { id: 'i6', themeId: 't', name: '   ', imageIcon: '/blank.svg' },
  ],
};

describe('parseDefaultThemeResponse', () => {
  it('reads the api envelope, normalizes the theme and keeps the icons with a usable name', () => {
    const parsed = parseDefaultThemeResponse({ success: true, message: 'Default theme', data: apiTheme });

    expect(parsed?.theme.slug).toBe('reducera-play');
    expect(parsed?.theme.version).toBe(3);
    expect(parsed?.theme.shape).toEqual({ radius: 16, depth: 4 });
    expect(parsed?.theme.tokens.dark.bg).toBe('#131F24');
    expect(parsed?.icons.map((i) => i.name)).toEqual(['streak', 'xp', 'bad', 'star']);
  });

  it('accepts the bare theme without an envelope', () => {
    expect(parseDefaultThemeResponse(apiTheme)?.theme.slug).toBe('reducera-play');
  });

  it('has no icons when the response carries none', () => {
    expect(parseDefaultThemeResponse({ data: { ...apiTheme, icons: undefined } })?.icons).toEqual([]);
  });

  it('refuses anything that is not a theme', () => {
    for (const bad of [null, undefined, 'x', 42, {}, { data: null }, { data: { slug: 'x' } }, { data: { ...apiTheme, slug: '' } }]) {
      expect(parseDefaultThemeResponse(bad)).toBeNull();
    }
  });
});

const payload = (slug: string): DefaultThemePayload => ({ theme: { ...DEFAULT_THEME, slug }, icons: [] });
const fallback = payload('bundled');

const build = (results: Array<DefaultThemePayload | null | Error>) => {
  let now = 1_000_000;
  const queue = [...results];
  const fetchRemote = vi.fn(async () => {
    const next = queue.shift() ?? null;
    if (next instanceof Error) throw next;
    return next;
  });
  const loader = createDefaultThemeLoader({ fetchRemote, fallback: () => fallback, now: () => now });
  return { loader, fetchRemote, advance: (ms: number) => { now += ms; } };
};

describe('createDefaultThemeLoader', () => {
  it('fetches once and serves the cache for 60 seconds', async () => {
    const { loader, fetchRemote, advance } = build([payload('db')]);

    expect((await loader.get()).theme.slug).toBe('db');
    advance(59_000);
    expect((await loader.get()).theme.slug).toBe('db');

    expect(fetchRemote).toHaveBeenCalledTimes(1);
  });

  it('shares one request between concurrent callers', async () => {
    const { loader, fetchRemote } = build([payload('db')]);

    const [a, b, c] = await Promise.all([loader.get(), loader.get(), loader.get()]);

    expect([a.theme.slug, b.theme.slug, c.theme.slug]).toEqual(['db', 'db', 'db']);
    expect(fetchRemote).toHaveBeenCalledTimes(1);
  });

  it('serves the bundled theme when the api fails, and retries after 5 seconds instead of 60', async () => {
    const { loader, fetchRemote, advance } = build([new Error('down'), payload('db')]);

    expect((await loader.get()).theme.slug).toBe('bundled');
    advance(4_000);
    expect((await loader.get()).theme.slug).toBe('bundled');
    expect(fetchRemote).toHaveBeenCalledTimes(1);

    advance(2_000);
    expect((await loader.get()).theme.slug).toBe('db');
    expect(fetchRemote).toHaveBeenCalledTimes(2);
  });

  it('treats an unparsable response like a failure', async () => {
    const { loader } = build([null]);

    expect((await loader.get()).theme.slug).toBe('bundled');
  });

  it('serves the stale value at once between 60 and 300 seconds and refreshes in the background', async () => {
    const { loader, fetchRemote, advance } = build([payload('v1'), payload('v2')]);
    await loader.get();
    advance(90_000);

    expect((await loader.get()).theme.slug).toBe('v1');
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchRemote).toHaveBeenCalledTimes(2);
    advance(1_000);
    expect((await loader.get()).theme.slug).toBe('v2');
  });

  it('keeps the old value when the background refresh fails', async () => {
    const { loader, advance } = build([payload('v1'), new Error('down')]);
    await loader.get();
    advance(90_000);

    await loader.get();
    await Promise.resolve();
    await Promise.resolve();
    advance(1_000);

    expect((await loader.get()).theme.slug).toBe('v1');
  });

  it('waits for a new fetch once the value is older than 300 seconds', async () => {
    const { loader, advance } = build([payload('v1'), payload('v2')]);
    await loader.get();
    advance(301_000);

    expect((await loader.get()).theme.slug).toBe('v2');
  });

  it('forgets everything on reset', async () => {
    const { loader, fetchRemote } = build([payload('v1'), payload('v2')]);
    await loader.get();
    loader.reset();

    expect((await loader.get()).theme.slug).toBe('v2');
    expect(fetchRemote).toHaveBeenCalledTimes(2);
  });
});
