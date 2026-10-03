import { HttpException } from '@nestjs/common';
import { RateLimitService } from '../rate-limit.service';

describe('RateLimitService.consume (per-user per-minute)', () => {
  function makeService(limitPerMinute: number) {
    const records: Record<string, { count: number }> = {};
    let lastK: string | null = null;
    const keyOf = (where: any) => {
      const inner = where?.userId_scope_windowStart ?? where ?? {};
      return `${inner.userId ?? 'u'}:${inner.scope ?? 's'}`;
    };
    const prisma = {
      rateLimit: {
        findUnique: jest.fn().mockImplementation(async (args: any) => {
          const k = keyOf(args?.where ?? {});
          lastK = k;
          return records[k] ?? null;
        }),
        create: jest.fn().mockImplementation(async (args: any) => {
          const k = keyOf(args?.data ?? {});
          records[k] = { count: 1 };
          lastK = k;
          return { id: `rl-${k}`, count: 1 };
        }),
        update: jest.fn().mockImplementation(async (args: any) => {
          const k = lastK ?? '';
          if (k && records[k]) records[k].count = args.data.count;
          return { id: `rl-${k}`, count: records[k]?.count ?? 0 };
        }),
      },
    };
    return new RateLimitService(prisma as any, { limitPerMinute });
  }

  it('first call returns remaining = limit - 1', async () => {
    const svc = makeService(5);
    const out = await svc.consume({ userId: 'u1', scope: 'chat' });
    expect(out.allowed).toBe(true);
    expect(out.remaining).toBe(4);
  });

  it('returns 429 on the 6th call within the same minute', async () => {
    const svc = makeService(5);
    for (let i = 0; i < 5; i += 1) {
      await svc.consume({ userId: 'u1', scope: 'chat' });
    }
    await expect(svc.consume({ userId: 'u1', scope: 'chat' })).rejects.toBeInstanceOf(HttpException);
  });

  it('different scopes have independent counters', async () => {
    const svc = makeService(5);
    for (let i = 0; i < 5; i += 1) {
      await svc.consume({ userId: 'u1', scope: 'chat' });
    }
    const out = await svc.consume({ userId: 'u1', scope: 'tutor' });
    expect(out.allowed).toBe(true);
    expect(out.remaining).toBe(4);
  });
});