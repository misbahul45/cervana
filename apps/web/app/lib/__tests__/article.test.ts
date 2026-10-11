import { describe, expect, it } from 'vitest';
import { articleSubtitle, bylineParts, estimateMinutes, paywallKind, readingTimeLabel } from '~/lib/article';

describe('paywallKind', () => {
  it('shows no wall when the reader already has the full text', () => {
    expect(paywallKind({ fullAccess: true, signedIn: true, accessType: 'PAID' })).toBe('none');
  });

  it('asks a guest to sign in, free or paid', () => {
    expect(paywallKind({ fullAccess: false, signedIn: false, accessType: 'FREE' })).toBe('login');
    expect(paywallKind({ fullAccess: false, signedIn: false, accessType: 'PAID' })).toBe('login');
  });

  it('offers purchase to a signed-in reader without access to a paid article', () => {
    expect(paywallKind({ fullAccess: false, signedIn: true, accessType: 'PAID' })).toBe('purchase');
  });

  it('shows no wall for a free article read by a signed-in user', () => {
    expect(paywallKind({ fullAccess: false, signedIn: true, accessType: 'FREE' })).toBe('none');
  });
});

describe('readingTimeLabel', () => {
  it('formats whole minutes in Indonesian', () => {
    expect(readingTimeLabel(5)).toBe('5 menit baca');
    expect(readingTimeLabel(1)).toBe('1 menit baca');
  });

  it('rounds up and hides an unknown or nonsensical value', () => {
    expect(readingTimeLabel(2.2)).toBe('3 menit baca');
    expect(readingTimeLabel(0)).toBe('');
    expect(readingTimeLabel(null)).toBe('');
    expect(readingTimeLabel(Number.NaN)).toBe('');
  });
});

describe('bylineParts', () => {
  it('lists author, publisher, date and reading time', () => {
    expect(bylineParts({ author: 'Sari', tenant: 'Studio Akuntansi', publishedLabel: '10 Okt 2026', minutes: 4 })).toEqual([
      'Sari',
      'Studio Akuntansi',
      '10 Okt 2026',
      '4 menit baca',
    ]);
  });

  it('does not repeat the publisher when it equals the author', () => {
    expect(bylineParts({ author: 'Sari', tenant: 'Sari', publishedLabel: '', minutes: null })).toEqual(['Sari']);
  });

  it('skips the placeholder date and missing names', () => {
    expect(bylineParts({ author: null, tenant: 'Studio', publishedLabel: '-', minutes: 1 })).toEqual(['Studio', '1 menit baca']);
  });
});

describe('articleSubtitle', () => {
  it('collapses whitespace and tolerates a missing excerpt', () => {
    expect(articleSubtitle('  Ringkas \n  sekali  ')).toBe('Ringkas sekali');
    expect(articleSubtitle(null)).toBe('');
  });
});

describe('estimateMinutes', () => {
  it('matches the server rule of two hundred words a minute, at least one minute', () => {
    expect(estimateMinutes('')).toBe(1);
    expect(estimateMinutes('kata '.repeat(200))).toBe(1);
    expect(estimateMinutes('kata '.repeat(201))).toBe(2);
  });

  it('ignores markdown punctuation that is not a word', () => {
    expect(estimateMinutes('# Judul\n\n- satu\n- dua\n\n> kutipan ---')).toBe(1);
  });
});
