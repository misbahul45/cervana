import { describe, expect, it } from 'vitest';
import { createIdempotencyKey } from '~/composables/useIdempotencyKey';

describe('createIdempotencyKey', () => {
  it('keeps the same key across repeated submits of one intent', () => {
    const key = createIdempotencyKey();

    expect(key.current()).toBe(key.current());
  });

  it('issues a fresh key only after the intent finished', () => {
    const key = createIdempotencyKey();
    const first = key.current();

    key.reset();

    expect(key.current()).not.toBe(first);
  });

  it('produces keys long enough for the API and AI services', () => {
    expect(createIdempotencyKey().current().length).toBeGreaterThanOrEqual(16);
  });

  it('does not share state between instances', () => {
    expect(createIdempotencyKey().current()).not.toBe(createIdempotencyKey().current());
  });
});
