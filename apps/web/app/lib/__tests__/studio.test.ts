import { describe, expect, it } from 'vitest';
import { articlePayload, articleProblem, classProblem, contentCounts, httpsUrlProblem, isEditable, nextStep, priceProblem, sessionProblem, sumCounts, toLocalInput } from '~/lib/studio';

describe('contentCounts', () => {
  it('counts each status the creator cares about and the total', () => {
    const counts = contentCounts([
      { status: 'DRAFT' },
      { status: 'DRAFT' },
      { status: 'PENDING_REVIEW' },
      { status: 'PUBLISHED' },
      { status: 'REJECTED' },
      { status: 'ARCHIVED' },
    ]);

    expect(counts).toEqual({ draft: 2, pending: 1, published: 1, rejected: 1, total: 6 });
  });

  it('is all zero for nothing', () => {
    expect(contentCounts([])).toEqual({ draft: 0, pending: 0, published: 0, rejected: 0, total: 0 });
  });
});

describe('sumCounts', () => {
  it('adds two sets of counts', () => {
    const first = contentCounts([{ status: 'DRAFT' }]);
    const second = contentCounts([{ status: 'PUBLISHED' }, { status: 'REJECTED' }]);

    expect(sumCounts(first, second)).toEqual({ draft: 1, pending: 0, published: 1, rejected: 1, total: 3 });
  });
});

describe('isEditable', () => {
  it('lets the creator change a draft or a rejected piece only', () => {
    expect(isEditable('DRAFT')).toBe(true);
    expect(isEditable('REJECTED')).toBe(true);
    expect(isEditable('PENDING_REVIEW')).toBe(false);
    expect(isEditable('PUBLISHED')).toBe(false);
    expect(isEditable('SUSPENDED')).toBe(false);
    expect(isEditable('ARCHIVED')).toBe(false);
  });
});

describe('nextStep', () => {
  const counts = (overrides: Partial<ReturnType<typeof contentCounts>>) => ({ draft: 0, pending: 0, published: 0, rejected: 0, total: 1, ...overrides });

  it('asks a brand new creator to write the first article', () => {
    expect(nextStep(counts({ total: 0 })).to).toBe('/studio/articles/new');
  });

  it('puts a rejection before anything else', () => {
    expect(nextStep(counts({ rejected: 1, draft: 2, pending: 1 })).message).toContain('ditolak');
  });

  it('asks to finish drafts, then waits for review, then points to earnings', () => {
    expect(nextStep(counts({ draft: 2 })).message).toContain('2 draf');
    expect(nextStep(counts({ pending: 1 })).message).toContain('ditinjau admin');
    expect(nextStep(counts({ published: 1 })).to).toBe('/studio/earnings');
  });
});

describe('toLocalInput', () => {
  it('formats an ISO time for a datetime-local field and tolerates bad input', () => {
    expect(toLocalInput('2026-10-11T03:00:00.000Z')).toMatch(/^2026-10-1[01]T\d{2}:\d{2}$/);
    expect(toLocalInput(null)).toBe('');
    expect(toLocalInput('nonsense')).toBe('');
  });
});

describe('sessionProblem', () => {
  const now = new Date('2026-10-11T00:00:00Z');

  it('accepts a future session that ends after it starts', () => {
    expect(sessionProblem('2026-10-12T10:00', '2026-10-12T11:00', now)).toBeNull();
  });

  it('rejects missing, reversed, equal and past sessions', () => {
    expect(sessionProblem('', '2026-10-12T11:00', now)).not.toBeNull();
    expect(sessionProblem('2026-10-12T11:00', '2026-10-12T10:00', now)).toContain('setelah');
    expect(sessionProblem('2026-10-12T10:00', '2026-10-12T10:00', now)).toContain('setelah');
    expect(sessionProblem('2026-10-01T10:00', '2026-10-01T11:00', now)).toContain('lewat');
    expect(sessionProblem('bad', 'worse', now)).toContain('tidak valid');
  });
});

describe('priceProblem', () => {
  it('only asks for a price on paid work', () => {
    expect(priceProblem('FREE', null)).toBeNull();
    expect(priceProblem('PAID', 25000)).toBeNull();
    expect(priceProblem('PAID', null)).not.toBeNull();
    expect(priceProblem('PAID', 0)).not.toBeNull();
    expect(priceProblem('PAID', -5)).not.toBeNull();
    expect(priceProblem('PAID', 10.5)).toContain('bulat');
    expect(priceProblem('PAID', Number.NaN)).not.toBeNull();
  });
});

describe('articlePayload', () => {
  const form = { title: '  Jurnal  ', subtitle: ' ringkas ', body: 'isi', accessType: 'PAID' as const, price: 25000 };

  it('trims text and keeps the price for a paid article', () => {
    expect(articlePayload(form)).toEqual({ title: 'Jurnal', content: 'isi', excerpt: 'ringkas', accessType: 'PAID', price: 25000 });
  });

  it('never sends a price for a free article', () => {
    expect(articlePayload({ ...form, accessType: 'FREE' })).not.toHaveProperty('price');
  });
});

describe('articleProblem', () => {
  const form = { title: 'Jurnal penyesuaian', subtitle: '', body: 'isi', accessType: 'FREE' as const, price: null };

  it('passes a complete free article', () => {
    expect(articleProblem(form)).toBeNull();
  });

  it('names what is missing', () => {
    expect(articleProblem({ ...form, title: 'ab' })).toContain('Judul');
    expect(articleProblem({ ...form, body: '   ' })).toContain('Isi');
    expect(articleProblem({ ...form, accessType: 'PAID', price: null })).toContain('harga');
  });
});

describe('classProblem', () => {
  const form = { title: 'Kelas laporan', accessType: 'FREE' as const, price: null, durationMinutes: 60, capacity: 20 };

  it('passes a complete free class and tolerates empty optional numbers', () => {
    expect(classProblem(form)).toBeNull();
    expect(classProblem({ ...form, durationMinutes: null, capacity: null })).toBeNull();
  });

  it('flags each invalid field', () => {
    expect(classProblem({ ...form, title: 'x' })).toContain('Judul');
    expect(classProblem({ ...form, accessType: 'PAID' })).toContain('harga');
    expect(classProblem({ ...form, durationMinutes: 2 })).toContain('Durasi');
    expect(classProblem({ ...form, durationMinutes: 9999 })).toContain('Durasi');
    expect(classProblem({ ...form, capacity: 0 })).toContain('Kapasitas');
    expect(classProblem({ ...form, capacity: 2.5 })).toContain('Kapasitas');
  });
});

describe('httpsUrlProblem', () => {
  it('allows an empty value and an https link', () => {
    expect(httpsUrlProblem('')).toBeNull();
    expect(httpsUrlProblem('  ')).toBeNull();
    expect(httpsUrlProblem('https://meet.example/abc')).toBeNull();
  });

  it('rejects http, other schemes, spaces and absurd length', () => {
    expect(httpsUrlProblem('http://meet.example')).not.toBeNull();
    expect(httpsUrlProblem('javascript:alert(1)')).not.toBeNull();
    expect(httpsUrlProblem('https://meet.example/a b')).not.toBeNull();
    expect(httpsUrlProblem(`https://x.test/${'a'.repeat(700)}`)).not.toBeNull();
  });
});
