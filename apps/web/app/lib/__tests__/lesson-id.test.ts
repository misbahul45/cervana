import { describe, expect, it } from 'vitest';
import { lessonIdFrom } from '~/lib/lesson-id';

describe('lessonIdFrom', () => {
  it('trusts the address over whatever the store remembers', () => {
    expect(lessonIdFrom('from-url', 'from-store')).toBe('from-url');
  });

  it('falls back to the stored lesson when the address has none', () => {
    expect(lessonIdFrom(undefined, 'from-store')).toBe('from-store');
    expect(lessonIdFrom('', 'from-store')).toBe('from-store');
  });

  it('ignores a repeated query key instead of using an array as an id', () => {
    expect(lessonIdFrom(['a', 'b'], 'from-store')).toBe('from-store');
  });

  it('is empty when nothing is known, so callers can skip the request', () => {
    expect(lessonIdFrom(undefined, '')).toBe('');
  });
});
