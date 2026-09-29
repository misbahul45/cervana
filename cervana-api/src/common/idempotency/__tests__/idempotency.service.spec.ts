import { BadRequestException } from '@nestjs/common';
import { IdempotencyService, IDEMPOTENCY_WINDOW_MS } from '../idempotency.service';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let prisma: {
    idempotencyKey: {
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
  };

  const makeCtx = (overrides: Partial<{
    key: string | undefined;
    user: any;
    body: any;
    params: any;
    method: string;
    url: string;
  }> = {}) => {
    const req: any = {
      headers: overrides.key === undefined ? {} : { 'idempotency-key': overrides.key },
      user: overrides.user === undefined ? { id: 'u-1' } : overrides.user,
      body: overrides.body ?? { foo: 'bar' },
      params: overrides.params ?? {},
      method: overrides.method ?? 'POST',
      url: overrides.url ?? '/test',
      route: { path: overrides.url ?? '/test' },
    };
    return { switchToHttp: () => ({ getRequest: () => req }) } as any;
  };

  beforeEach(() => {
    prisma = {
      idempotencyKey: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    service = new IdempotencyService(prisma as any);
  });

  describe('no idempotency-key header', () => {
    it('executes work and is not replayed', async () => {
      const work = jest.fn().mockResolvedValue({ statusCode: 200, body: { ok: true } });

      const r = await service.execute(makeCtx({ key: undefined }), work);

      expect(work).toHaveBeenCalledOnce();
      expect(r.replayed).toBe(false);
      expect(r.body).toEqual({ ok: true });
      expect(prisma.idempotencyKey.create).not.toHaveBeenCalled();
    });
  });

  describe('with idempotency-key header', () => {
    it('rejects when user is not authenticated', async () => {
      const work = jest.fn();

      await expect(
        service.execute(makeCtx({ user: null }), work),
      ).rejects.toThrow(BadRequestException);

      expect(work).not.toHaveBeenCalled();
    });

    it('executes and persists on first call', async () => {
      const work = jest.fn().mockResolvedValue({ statusCode: 201, body: { id: 'r-1' } });

      const r = await service.execute(
        makeCtx({ key: 'k-1', body: { foo: 'bar' } }),
        work,
      );

      expect(work).toHaveBeenCalledOnce();
      expect(r.replayed).toBe(false);
      expect(prisma.idempotencyKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            key: 'k-1',
            userId: 'u-1',
            method: 'POST',
            statusCode: 201,
            expiresAt: expect.any(Date),
          }),
        }),
      );

      const expiresAt = prisma.idempotencyKey.create.mock.calls[0][0].data.expiresAt;
      const expected = new Date(Date.now() + IDEMPOTENCY_WINDOW_MS);
      expect(Math.abs(expiresAt.getTime() - expected.getTime())).toBeLessThan(1000);
    });

    it('replays the previous response when key matches', async () => {
      const cachedBody = { id: 'r-cached' };
      prisma.idempotencyKey.findUnique.mockResolvedValue({
        key: 'k-1',
        userId: 'u-1',
        path: '/test',
        method: 'POST',
        requestHash: expect.any(String),
        responseJson: JSON.stringify(cachedBody),
        statusCode: 201,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });

      const work = jest.fn();
      const r = await service.execute(
        makeCtx({ key: 'k-1', body: { foo: 'bar' } }),
        work,
      );

      expect(work).not.toHaveBeenCalled();
      expect(r.replayed).toBe(true);
      expect(r.statusCode).toBe(201);
      expect(r.body).toEqual(cachedBody);
    });

    it('rejects when key is reused with different body', async () => {
      prisma.idempotencyKey.findUnique.mockResolvedValue({
        key: 'k-1',
        userId: 'u-1',
        path: '/test',
        method: 'POST',
        requestHash: 'old-hash',
        responseJson: '{}',
        statusCode: 201,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });

      const work = jest.fn();
      await expect(
        service.execute(makeCtx({ key: 'k-1', body: { different: true } }), work),
      ).rejects.toThrow(/different request body/);
    });

    it('deletes expired key and re-executes', async () => {
      prisma.idempotencyKey.findUnique.mockResolvedValue({
        key: 'k-1',
        userId: 'u-1',
        path: '/test',
        method: 'POST',
        requestHash: 'whatever',
        responseJson: '{}',
        statusCode: 200,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() - 1000),
      });

      const work = jest.fn().mockResolvedValue({ statusCode: 200, body: { fresh: true } });

      const r = await service.execute(makeCtx({ key: 'k-1' }), work);

      expect(prisma.idempotencyKey.delete).toHaveBeenCalled();
      expect(work).toHaveBeenCalledOnce();
      expect(r.replayed).toBe(false);
    });
  });
});