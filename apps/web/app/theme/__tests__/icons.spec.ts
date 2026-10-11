import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ICON_LABELS, THEME_ICON_NAMES, bundledIconUrl, iconAlt, iconUrlFromRecord, resolveIconUrl } from '../icons';

const apiVocabulary = (): string[] => {
  const source = readFileSync(join(__dirname, '../../../../../services/api/src/v1/gamify/themes/theme-icons.ts'), 'utf8');
  const body = source.slice(source.indexOf('THEME_ICON_NAMES = ['), source.indexOf('] as const'));
  return [...body.matchAll(/'([a-z]+)'/g)].map((m) => m[1]!);
};

describe('theme icon vocabulary', () => {
  it('is the same closed list as the api', () => {
    expect([...THEME_ICON_NAMES]).toEqual(apiVocabulary());
  });

  it('has an Indonesian label for every name', () => {
    for (const name of THEME_ICON_NAMES) {
      expect(ICON_LABELS[name], name).toBeTruthy();
    }
    expect(Object.keys(ICON_LABELS).sort()).toEqual([...THEME_ICON_NAMES].sort());
  });

  it('ships a bundled svg for every name', () => {
    for (const name of THEME_ICON_NAMES) {
      const file = join(__dirname, '../../../public', bundledIconUrl(name));
      expect(existsSync(file), file).toBe(true);
      expect(readFileSync(file, 'utf8')).toMatch(/^<svg /);
    }
  });
});

describe('iconUrlFromRecord', () => {
  it('reads a string url and the url of an image object', () => {
    expect(iconUrlFromRecord({ name: 'xp', imageIcon: '/themes/x/xp.svg' })).toBe('/themes/x/xp.svg');
    expect(iconUrlFromRecord({ name: 'xp', imageIcon: { fileId: 'f', url: 'https://cdn.example.com/xp.png' } })).toBe('https://cdn.example.com/xp.png');
  });

  it('accepts only a same origin path or an https url', () => {
    for (const bad of ['javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', '//evil.example.com/x.svg', 'http://cdn.example.com/x.png', 'ftp://x/y.png', '']) {
      expect(iconUrlFromRecord({ name: 'xp', imageIcon: bad }), bad).toBeNull();
    }
  });

  it('has no url when the record has no image', () => {
    expect(iconUrlFromRecord({ name: 'xp' })).toBeNull();
    expect(iconUrlFromRecord({ name: 'xp', imageIcon: null })).toBeNull();
    expect(iconUrlFromRecord({ name: 'xp', imageIcon: { fileId: 'only-file' } })).toBeNull();
  });
});

describe('resolveIconUrl', () => {
  it('takes the first set that has the name, ignoring case and spaces', () => {
    const topic = [{ name: ' Streak ', imageIcon: '/themes/topic/streak.svg' }];
    const fallback = [{ name: 'streak', imageIcon: '/themes/default/streak.svg' }];

    expect(resolveIconUrl('streak', [topic, fallback])).toBe('/themes/topic/streak.svg');
  });

  it('moves on to the next set when the first lacks the name or has an unsafe url', () => {
    const first = [{ name: 'xp', imageIcon: 'javascript:alert(1)' }, { name: 'star', imageIcon: '/s.svg' }];
    const second = [{ name: 'xp', imageIcon: '/themes/default/xp.svg' }];

    expect(resolveIconUrl('xp', [first, second])).toBe('/themes/default/xp.svg');
  });

  it('skips empty and missing sets and falls back to the bundled icon', () => {
    expect(resolveIconUrl('trophy', [null, undefined, []])).toBe('/themes/reducera-play/icons/trophy.svg');
    expect(resolveIconUrl('lock', [[{ name: 'xp', imageIcon: '/x.svg' }]])).toBe(bundledIconUrl('lock'));
    expect(resolveIconUrl('level', [])).toBe(bundledIconUrl('level'));
  });
});

describe('iconAlt', () => {
  it('uses the Indonesian label of the name by default', () => {
    expect(iconAlt('streak')).toBe('Streak');
    expect(iconAlt('star')).toBe('Bintang');
  });

  it('lets the caller give a more specific label', () => {
    expect(iconAlt('xp', { label: 'XP minggu ini' })).toBe('XP minggu ini');
  });

  it('is empty for a decorative icon even when a label is given', () => {
    expect(iconAlt('trophy', { decorative: true })).toBe('');
    expect(iconAlt('trophy', { decorative: true, label: 'x' })).toBe('');
  });

  it('ignores a blank label', () => {
    expect(iconAlt('lock', { label: '   ' })).toBe('Terkunci');
  });
});
