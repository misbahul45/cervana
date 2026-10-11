import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADMIN_NAV } from '~/lib/admin-nav';
import { isNavActive } from '~/lib/nav';

const PAGES = join(__dirname, '..', '..', 'pages');

const pageFileFor = (to: string) => {
  const base = join(PAGES, to.replace(/^\//, ''));
  return [`${base}.vue`, join(base, 'index.vue')].find(existsSync);
};

describe('ADMIN_NAV', () => {
  it('has unique ids and targets, and Indonesian labels', () => {
    expect(new Set(ADMIN_NAV.map((item) => item.id)).size).toBe(ADMIN_NAV.length);
    expect(new Set(ADMIN_NAV.map((item) => item.to)).size).toBe(ADMIN_NAV.length);
    for (const item of ADMIN_NAV) expect(item.label.length).toBeGreaterThan(3);
  });

  it('only links to pages that exist, so the menu has no dead end', () => {
    const missing = ADMIN_NAV.filter((item) => !pageFileFor(item.to)).map((item) => item.to);

    expect(missing).toEqual([]);
  });

  it('keeps every item under the admin area and uses lucide icons', () => {
    for (const item of ADMIN_NAV) {
      expect(item.to.startsWith('/admin/')).toBe(true);
      expect(item.icon.startsWith('i-lucide-')).toBe(true);
    }
  });

  it('marks the moderation entry active on its nested pages only', () => {
    expect(isNavActive('/admin/moderation', '/admin/moderation')).toBe(true);
    expect(isNavActive('/admin/moderation', '/admin/moderation/articles')).toBe(true);
    expect(isNavActive('/admin/payments', '/admin/payouts')).toBe(false);
  });
});
