import { describe, expect, it } from 'vitest';
import type { CreatorProfileView, MarketplaceArticleView, MarketplaceClassView } from '~/interfaces/commerce';
import { articleCard, catalogPages, classAction, classCard, classMeta, creatorCards, externalUrl, interleave, priceText } from '~/lib/marketplace';

const article = (overrides: Partial<MarketplaceArticleView> = {}): MarketplaceArticleView => ({
  id: 'a1',
  title: 'Jurnal penyesuaian',
  slug: 'jurnal-penyesuaian',
  excerpt: '<p>Cara <b>mencatat</b> jurnal.</p>',
  coverImage: null,
  accessType: 'PAID',
  price: '25000',
  currency: 'IDR',
  publishedAt: '2026-10-11T03:00:00.000Z',
  category: null,
  author: { id: 'u1', name: 'Maya', image: null },
  tenant: { id: 't1', name: 'Studio Maya', slug: 'maya', logo: null },
  ...overrides,
});

const cls = (overrides: Partial<MarketplaceClassView> = {}): MarketplaceClassView => ({
  id: 'c1',
  title: 'Kelas laporan keuangan',
  slug: 'laporan-keuangan',
  description: 'Belajar menyusun laporan.',
  coverImage: null,
  accessType: 'FREE',
  price: null,
  currency: 'IDR',
  format: 'LIVE',
  difficulty: 'BEGINNER',
  durationMinutes: 90,
  capacity: 20,
  seatsLeft: 5,
  publishedAt: '2026-10-10T03:00:00.000Z',
  instructor: { id: 'u2', name: 'Andi', image: null },
  tenant: { id: 't2', name: 'Studio Andi', slug: 'andi', logo: null },
  ...overrides,
});

describe('priceText', () => {
  it('says Gratis for free products and formats paid ones in rupiah', () => {
    expect(priceText('FREE', null, 'IDR')).toBe('Gratis');
    expect(priceText('PAID', '25000', 'IDR').replace(/\s/g, ' ')).toBe('Rp 25.000');
  });

  it('never shows a paid product as free when the price is missing', () => {
    expect(priceText('PAID', null, 'IDR')).toBe('Harga belum diatur');
    expect(priceText('PAID', 'abc', 'IDR')).toBe('Harga belum diatur');
    expect(priceText('PAID', 0, 'IDR')).toBe('Harga belum diatur');
  });
});

describe('articleCard', () => {
  it('describes an article for the catalog and links to its reading page', () => {
    const card = articleCard(article());

    expect(card).toMatchObject({
      kind: 'article',
      id: 'a1',
      title: 'Jurnal penyesuaian',
      summary: 'Cara mencatat jurnal.',
      creator: 'Maya',
      free: false,
      to: '/marketplace/articles/a1',
      coverUrl: null,
      initial: 'J',
    });
    expect(card.meta).toBe('Artikel · 11 Okt 2026');
    expect(card.priceLabel.replace(/\s/g, ' ')).toBe('Rp 25.000');
  });

  it('falls back to the tenant name when there is no author, and uses the cover image when there is one', () => {
    const card = articleCard(article({ author: null, coverImage: { url: 'https://img.example/c.jpg' }, accessType: 'FREE', price: null }));

    expect(card.creator).toBe('Studio Maya');
    expect(card.coverUrl).toBe('https://img.example/c.jpg');
    expect(card.free).toBe(true);
    expect(card.priceLabel).toBe('Gratis');
  });

  it('copes with a missing excerpt and publication date', () => {
    const card = articleCard(article({ excerpt: null, publishedAt: null }));

    expect(card.summary).toBe('');
    expect(card.meta).toBe('Artikel');
  });
});

describe('classCard', () => {
  it('translates difficulty and format and shows the duration', () => {
    const card = classCard(cls());

    expect(card).toMatchObject({ kind: 'class', to: '/marketplace/classes/c1', creator: 'Andi', free: true, summary: 'Belajar menyusun laporan.' });
    expect(card.meta).toBe('Kelas · Pemula · Live · 90 menit');
  });

  it('keeps unknown values readable and leaves out a missing duration', () => {
    expect(classCard(cls({ difficulty: 'ADVANCED', format: 'RECORDED', durationMinutes: null })).meta).toBe('Kelas · Mahir · Rekaman');
    expect(classCard(cls({ difficulty: 'EXPERT', format: 'HYBRID' })).meta).toBe('Kelas · EXPERT · Hibrida · 90 menit');
  });
});

describe('interleave', () => {
  it('alternates two lists so neither kind floods the grid, keeping the longer tail', () => {
    expect(interleave(['a1', 'a2', 'a3'], ['c1'])).toEqual(['a1', 'c1', 'a2', 'a3']);
    expect(interleave([], ['c1', 'c2'])).toEqual(['c1', 'c2']);
    expect(interleave([], [])).toEqual([]);
  });
});

describe('catalogPages', () => {
  it('uses the longer of the two lists so no page of either kind is unreachable', () => {
    expect(catalogPages({ totalPages: 3 }, { totalPages: 5 })).toBe(5);
    expect(catalogPages({ totalPages: 2 }, undefined)).toBe(2);
  });

  it('is at least one page', () => {
    expect(catalogPages({ totalPages: 0 }, { totalPages: 0 })).toBe(1);
    expect(catalogPages(undefined, undefined)).toBe(1);
  });
});

describe('classAction', () => {
  const base = { accessType: 'PAID' as const, signedIn: true, accessible: false, seatsLeft: 5 as number | null };

  it('shows the enrolled state once the reader holds the class', () => {
    expect(classAction({ ...base, accessible: true })).toEqual({ kind: 'enrolled', label: 'Kamu sudah terdaftar' });
  });

  it('reports a full class before asking anyone to pay', () => {
    expect(classAction({ ...base, seatsLeft: 0 })).toEqual({ kind: 'full', label: 'Kelas penuh' });
  });

  it('still shows enrolled for a holder when the class is full', () => {
    expect(classAction({ ...base, accessible: true, seatsLeft: 0 }).kind).toBe('enrolled');
  });

  it('asks a guest to sign in, with a label that matches the price', () => {
    expect(classAction({ ...base, signedIn: false })).toEqual({ kind: 'login', label: 'Masuk untuk membeli' });
    expect(classAction({ ...base, signedIn: false, accessType: 'FREE' })).toEqual({ kind: 'login', label: 'Masuk untuk mendaftar' });
  });

  it('lets a signed-in reader join a free class or buy a paid one', () => {
    expect(classAction({ ...base, accessType: 'FREE' })).toEqual({ kind: 'enroll', label: 'Daftar gratis' });
    expect(classAction(base)).toEqual({ kind: 'buy', label: 'Beli kelas' });
  });

  it('treats an unlimited class as having seats', () => {
    expect(classAction({ ...base, seatsLeft: null }).kind).toBe('buy');
  });
});

describe('externalUrl', () => {
  it('keeps http and https links only', () => {
    expect(externalUrl('https://meet.example/abc')).toBe('https://meet.example/abc');
    expect(externalUrl('http://meet.example/abc')).toBe('http://meet.example/abc');
  });

  it.each([['javascript:alert(1)'], ['data:text/html,x'], ['//meet.example'], ['/relative'], [''], [null], [undefined]])('drops %s', (value) => {
    expect(externalUrl(value as string | null | undefined)).toBeNull();
  });
});

describe('classMeta', () => {
  it('translates level and format and adds the duration only when known', () => {
    expect(classMeta({ difficulty: 'BEGINNER', format: 'LIVE', durationMinutes: 90 })).toEqual(['Pemula', 'Live', '90 menit']);
    expect(classMeta({ difficulty: 'ADVANCED', format: 'RECORDED', durationMinutes: null })).toEqual(['Mahir', 'Rekaman']);
  });
});

describe('creatorCards', () => {
  it('turns a creator profile into catalog cards credited to the creator', () => {
    const { category, author, tenant, ...articleFields } = article();
    const { capacity, seatsLeft, instructor, tenant: classTenant, ...classFields } = cls();
    const profile: CreatorProfileView = {
      id: 'u9',
      fullName: 'Rina Kreator',
      bio: null,
      portfolioUrl: null,
      articles: [articleFields],
      classes: [classFields],
      badges: [],
    };

    const cards = creatorCards(profile);

    expect(cards.map((card) => card.kind)).toEqual(['article', 'class']);
    expect(cards.every((card) => card.creator === 'Rina Kreator')).toBe(true);
  });

  it('is empty when the creator has published nothing', () => {
    expect(creatorCards({ id: 'u9', fullName: 'Rina', bio: null, portfolioUrl: null, articles: [], classes: [], badges: [] })).toEqual([]);
  });
});
