import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn();

vi.mock('~/lib/api', () => ({
  request: (...args: unknown[]) => request(...args),
  toQueryString: () => '',
}));

import { ordersService } from '~/services/order';

const headersOf = (call: unknown[]) => call[3] as Record<string, string>;

describe('ordersService write calls carry an idempotency key, which the API requires', () => {
  beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue({ success: true });
  });

  it('sends a key of at least eight characters when creating an order', async () => {
    await ordersService.create({ topicId: 'topic-1' });

    const [path, method, body] = request.mock.calls[0];
    expect(path).toBe('/orders');
    expect(method).toBe('POST');
    expect(body).toEqual({ topicId: 'topic-1' });
    expect(headersOf(request.mock.calls[0])['Idempotency-Key']).toMatch(/^.{8,}$/);
  });

  it('uses a new key for each separate attempt', async () => {
    await ordersService.create({ topicId: 'topic-1' });
    await ordersService.create({ topicId: 'topic-1' });

    const keys = request.mock.calls.map((call) => headersOf(call)['Idempotency-Key']);
    expect(new Set(keys).size).toBe(2);
  });

  it('lets a caller pin the key so a deliberate retry is recognised as the same request', async () => {
    await ordersService.create({ topicId: 'topic-1' }, undefined, 'fixed-key-12345');

    expect(headersOf(request.mock.calls[0])['Idempotency-Key']).toBe('fixed-key-12345');
  });

  it('sends a key when cancelling an order too', async () => {
    await ordersService.cancel('order-1');

    expect(request.mock.calls[0][0]).toBe('/orders/order-1/cancel');
    expect(request.mock.calls[0][1]).toBe('POST');
    expect(headersOf(request.mock.calls[0])['Idempotency-Key']).toMatch(/^.{8,}$/);
  });
});
