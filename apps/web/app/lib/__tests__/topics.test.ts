import { describe, expect, it, vi } from 'vitest';
import {
  claimOutcome,
  collectEnrolledTopicIds,
  coverInitial,
  coverTone,
  filterByCategory,
  listFromResponse,
  plainText,
  priceLabel,
  unlockAction,
  visibleCategories,
} from '~/lib/topics';

describe('plainText', () => {
  it('strips tags and decodes the common entities', () => {
    expect(plainText('<p>Dasar <strong>akuntansi</strong> &amp; jurnal&nbsp;umum</p>')).toBe('Dasar akuntansi & jurnal umum');
  });

  it('removes script and style content, not only the tags', () => {
    expect(plainText('<style>p{color:red}</style><p>Aman</p><script>alert(1)</script>')).toBe('Aman');
  });

  it('collapses whitespace and returns an empty string for nothing', () => {
    expect(plainText('  a \n\n  b  ')).toBe('a b');
    expect(plainText(null)).toBe('');
    expect(plainText(undefined)).toBe('');
  });

  it('cuts at the limit on a word boundary and marks the cut', () => {
    expect(plainText('satu dua tiga empat lima', 14)).toBe('satu dua tiga…');
    expect(plainText('pendek', 14)).toBe('pendek');
  });
});

describe('priceLabel', () => {
  it('says Gratis only for a price of exactly zero', () => {
    expect(priceLabel(0)).toBe('Gratis');
  });

  it('shows a dash for a missing or invalid price instead of pretending it is free', () => {
    expect(priceLabel(null)).toBe('-');
    expect(priceLabel(undefined)).toBe('-');
    expect(priceLabel(Number.NaN)).toBe('-');
  });

  it('formats a paid price in rupiah', () => {
    expect(priceLabel(50000).replace(/\s/g, ' ')).toBe('Rp 50.000');
  });
});

describe('visibleCategories', () => {
  const cats = [
    { id: '1', name: 'A' },
    { id: '2', name: 'B' },
    { id: '3', name: 'C' },
    { id: '4', name: 'D' },
  ];

  it('shows the first entries and counts the hidden rest', () => {
    expect(visibleCategories(cats, 2)).toEqual({ shown: cats.slice(0, 2), hidden: 2 });
  });

  it('hides nothing when everything fits and tolerates a missing list', () => {
    expect(visibleCategories(cats.slice(0, 2), 2)).toEqual({ shown: cats.slice(0, 2), hidden: 0 });
    expect(visibleCategories(null, 2)).toEqual({ shown: [], hidden: 0 });
    expect(visibleCategories(undefined, 2)).toEqual({ shown: [], hidden: 0 });
  });
});

describe('filterByCategory', () => {
  const topics = [
    { id: 't1', categories: [{ id: '1', name: 'Akuntansi' }] },
    { id: 't2', categories: [{ id: '2', name: 'Pajak' }, { id: '1', name: 'Akuntansi' }] },
    { id: 't3', categories: [] },
    { id: 't4', categories: null },
  ];

  it('returns everything when no category is chosen', () => {
    expect(filterByCategory(topics, null)).toHaveLength(4);
    expect(filterByCategory(topics, '')).toHaveLength(4);
  });

  it('keeps the topics that carry the category, ignoring case and surrounding space', () => {
    expect(filterByCategory(topics, ' akuntansi ').map((t) => t.id)).toEqual(['t1', 't2']);
    expect(filterByCategory(topics, 'Pajak').map((t) => t.id)).toEqual(['t2']);
  });

  it('returns nothing for a category no topic has', () => {
    expect(filterByCategory(topics, 'Audit')).toEqual([]);
  });
});

describe('cover helpers', () => {
  it('picks the same tone for the same title and stays inside the six tones', () => {
    expect(coverTone('Topic 0abfe4')).toBe(coverTone('Topic 0abfe4'));
    for (const title of ['', 'A', 'Akuntansi Dasar', 'Pajak Penghasilan', '日本語']) {
      const tone = coverTone(title);
      expect(Number.isInteger(tone)).toBe(true);
      expect(tone).toBeGreaterThanOrEqual(0);
      expect(tone).toBeLessThan(6);
    }
  });

  it('uses the first letter, uppercased, with a fallback for an empty title', () => {
    expect(coverInitial('akuntansi')).toBe('A');
    expect(coverInitial('  pajak')).toBe('P');
    expect(coverInitial('')).toBe('R');
  });
});

describe('unlockAction', () => {
  const base = { id: '5b0a8c1e-1111-4222-8333-444455556666', slug: 'dasar-akuntansi', price: 0, signedIn: true, hasAccess: false };

  it('sends a guest to the login page', () => {
    expect(unlockAction({ ...base, signedIn: false })).toEqual({ kind: 'login', to: '/login' });
  });

  it('opens the lessons when the learner already has access, even for a paid topic', () => {
    expect(unlockAction({ ...base, hasAccess: true, price: 90000 })).toEqual({ kind: 'learn', to: '/my-learning/topics/dasar-akuntansi' });
  });

  it('claims a free topic directly', () => {
    expect(unlockAction(base)).toEqual({ kind: 'claim' });
  });

  it('sends a paid topic to its order page by id, the key that page reads, instead of creating an order from the card', () => {
    expect(unlockAction({ ...base, price: 90000 })).toEqual({ kind: 'order', to: `/learn/topics/${base.id}/order` });
  });

  it('never offers a free claim for a price that is missing or invalid', () => {
    expect(unlockAction({ ...base, price: Number.NaN })).toEqual({ kind: 'order', to: `/learn/topics/${base.id}/order` });
    expect(unlockAction({ ...base, price: null })).toEqual({ kind: 'order', to: `/learn/topics/${base.id}/order` });
  });
});

describe('collectEnrolledTopicIds', () => {
  it('walks every page and returns the distinct topic ids', async () => {
    const pages: Record<number, { items: { topicId: string }[]; totalPages: number }> = {
      1: { items: [{ topicId: 'a' }, { topicId: 'b' }], totalPages: 3 },
      2: { items: [{ topicId: 'b' }, { topicId: 'c' }], totalPages: 3 },
      3: { items: [{ topicId: 'd' }], totalPages: 3 },
    };
    const fetchPage = vi.fn(async (page: number) => pages[page]);

    expect(await collectEnrolledTopicIds(fetchPage)).toEqual(['a', 'b', 'c', 'd']);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('stops after one request when there is a single page', async () => {
    const fetchPage = vi.fn(async () => ({ items: [{ topicId: 'a' }], totalPages: 1 }));

    expect(await collectEnrolledTopicIds(fetchPage)).toEqual(['a']);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('never asks for more pages than the cap, even if the server claims more', async () => {
    const fetchPage = vi.fn(async (page: number) => ({ items: [{ topicId: `t${page}` }], totalPages: 999 }));

    const ids = await collectEnrolledTopicIds(fetchPage, 4);

    expect(fetchPage).toHaveBeenCalledTimes(4);
    expect(ids).toEqual(['t1', 't2', 't3', 't4']);
  });

  it('treats a missing page body as empty and ends', async () => {
    const fetchPage = vi.fn(async () => undefined);

    expect(await collectEnrolledTopicIds(fetchPage)).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});

describe('listFromResponse', () => {
  it('reads a list that is nested one level, the usual list envelope', () => {
    expect(listFromResponse({ data: [{ id: 1 }, { id: 2 }], pagination: {} })).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('reads a bare array', () => {
    expect(listFromResponse([{ id: 1 }])).toEqual([{ id: 1 }]);
  });

  it('returns an empty list for anything else', () => {
    expect(listFromResponse(undefined)).toEqual([]);
    expect(listFromResponse(null)).toEqual([]);
    expect(listFromResponse({ data: 'nope' })).toEqual([]);
    expect(listFromResponse('text')).toEqual([]);
  });
});


describe('claimOutcome', () => {
  it('opens the topic once the free claim order is paid or fulfilled', () => {
    expect(claimOutcome({ success: true, data: { status: 'FULFILLED' } })).toBe('opened');
    expect(claimOutcome({ success: true, data: { status: 'PAID' } })).toBe('opened');
  });

  it('keeps an unpaid order pending instead of opening the topic', () => {
    expect(claimOutcome({ success: true, data: { status: 'PENDING' } })).toBe('pending');
    expect(claimOutcome({ success: true, data: {} })).toBe('pending');
  });

  it('reports a failed envelope as failed, even though the request did not throw', () => {
    expect(claimOutcome({ success: false, data: null })).toBe('failed');
    expect(claimOutcome(undefined)).toBe('failed');
    expect(claimOutcome(null)).toBe('failed');
  });
});
