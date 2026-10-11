import { dehydrate } from '@tanstack/vue-query';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '~/lib/query-client';

describe('createQueryClient', () => {
  it('never dehydrates a query, so the first client render matches the server render that showed the loading state', async () => {
    const client = createQueryClient();
    await client.prefetchQuery({ queryKey: ['gamify', 'me'], queryFn: async () => ({ level: 3 }) });

    expect(client.getQueryData(['gamify', 'me'])).toEqual({ level: 3 });
    expect(dehydrate(client).queries).toEqual([]);
  });

  it('reports a failed query to the callback it was given', async () => {
    const onError = vi.fn();
    const client = createQueryClient(onError);

    await client.prefetchQuery({ queryKey: ['bad'], queryFn: async () => { throw new Error('boom'); }, retry: false });

    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0]?.[0] as Error).message).toBe('boom');
  });
});
