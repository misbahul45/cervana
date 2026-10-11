import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STUDIO_NAV, studioNavActive } from '~/lib/studio-nav';

const PAGES = join(__dirname, '..', '..', 'pages');

const pageFileFor = (to: string) => {
  const base = join(PAGES, to.replace(/^\//, ''));
  return [`${base}.vue`, join(base, 'index.vue')].find(existsSync);
};

const item = (id: string) => STUDIO_NAV.find((entry) => entry.id === id)!;

describe('STUDIO_NAV', () => {
  it('has unique ids and targets', () => {
    expect(new Set(STUDIO_NAV.map((entry) => entry.id)).size).toBe(STUDIO_NAV.length);
    expect(new Set(STUDIO_NAV.map((entry) => entry.to)).size).toBe(STUDIO_NAV.length);
  });

  it('only links to pages that exist', () => {
    expect(STUDIO_NAV.filter((entry) => !pageFileFor(entry.to)).map((entry) => entry.to)).toEqual([]);
  });

  it('stays under the studio area with lucide icons', () => {
    for (const entry of STUDIO_NAV) {
      expect(entry.to === '/studio' || entry.to.startsWith('/studio/')).toBe(true);
      expect(entry.icon.startsWith('i-lucide-')).toBe(true);
    }
  });
});

describe('studioNavActive', () => {
  it('keeps the home entry active on the studio home only', () => {
    expect(studioNavActive(item('home'), '/studio')).toBe(true);
    expect(studioNavActive(item('home'), '/studio/')).toBe(true);
    expect(studioNavActive(item('home'), '/studio/articles')).toBe(false);
  });

  it('activates a section on its nested pages', () => {
    expect(studioNavActive(item('articles'), '/studio/articles/new')).toBe(true);
    expect(studioNavActive(item('articles'), '/studio/articles/abc?x=1')).toBe(true);
    expect(studioNavActive(item('articles'), '/studio/classes')).toBe(false);
  });
});
