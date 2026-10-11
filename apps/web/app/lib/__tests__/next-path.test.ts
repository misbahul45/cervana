import { describe, expect, it } from 'vitest';
import { loginHref, safeNext } from '~/lib/next-path';

describe('safeNext', () => {
  it('accepts an internal path with query and hash', () => {
    expect(safeNext('/marketplace/articles/abc?x=1#top')).toBe('/marketplace/articles/abc?x=1#top');
  });

  it('takes the first value when the query repeats the key', () => {
    expect(safeNext(['/marketplace', '/admin'])).toBe('/marketplace');
  });

  it.each([
    ['https://evil.test/phish'],
    ['//evil.test'],
    ['/\\evil.test'],
    ['javascript:alert(1)'],
    ['marketplace'],
    ['/path\nwith-newline'],
    [''],
    [undefined],
    [42],
  ])('rejects %s', (value) => {
    expect(safeNext(value)).toBeNull();
  });

  it('never bounces back to an auth page', () => {
    expect(safeNext('/login')).toBeNull();
    expect(safeNext('/login?next=/x')).toBeNull();
    expect(safeNext('/register')).toBeNull();
    expect(safeNext('/verify-email')).toBeNull();
    expect(safeNext('/loginx')).toBe('/loginx');
  });

  it('rejects an absurdly long value', () => {
    expect(safeNext(`/${'a'.repeat(600)}`)).toBeNull();
  });
});

describe('loginHref', () => {
  it('carries a safe destination', () => {
    expect(loginHref('/marketplace/articles/abc')).toBe('/login?next=%2Fmarketplace%2Farticles%2Fabc');
  });

  it('falls back to a bare login for an unsafe or missing destination', () => {
    expect(loginHref('https://evil.test')).toBe('/login');
    expect(loginHref(undefined)).toBe('/login');
  });
});
