import { ExecutionContext, CallHandler } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { ActivityDetectorInterceptor } from '../daily-activity.interceptor';
import { StreakActivity } from '@prisma/client';

const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

describe('ActivityDetectorInterceptor', () => {
  let interceptor: ActivityDetectorInterceptor;
  let dailyLogRepo: { findToday: jest.Mock; create: jest.Mock };
  let streaksRepo: { incrementOrReset: jest.Mock };

  beforeEach(() => {
    dailyLogRepo = { findToday: jest.fn(), create: jest.fn() };
    streaksRepo = { incrementOrReset: jest.fn() };
    interceptor = new ActivityDetectorInterceptor(
      dailyLogRepo as any,
      streaksRepo as any,
    );
  });

  it('mints a daily activity on first request of the day via intercept', async () => {
    dailyLogRepo.findToday.mockResolvedValue(null);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 'u-1' } }),
      }),
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of('ok') };

    await firstValueFrom(interceptor.intercept(ctx, next));
    await flushMicrotasks();
    await flushMicrotasks();

    expect(dailyLogRepo.findToday).toHaveBeenCalledWith(
      'u-1',
      expect.any(Date),
      expect.any(Date),
    );
    expect(dailyLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u-1',
        activityType: StreakActivity.DAILY_LOGIN,
      }),
    );
    expect(streaksRepo.incrementOrReset).toHaveBeenCalledWith(
      'u-1',
      StreakActivity.DAILY_LOGIN,
    );
  });

  it('does not double-mint when daily log already exists', async () => {
    dailyLogRepo.findToday.mockResolvedValue({ id: 'log-1' });
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 'u-1' } }),
      }),
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of('ok') };

    await firstValueFrom(interceptor.intercept(ctx, next));

    expect(dailyLogRepo.create).not.toHaveBeenCalled();
    expect(streaksRepo.incrementOrReset).not.toHaveBeenCalled();
  });

  it('skips detect when request has no authenticated user', async () => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of('ok') };

    await firstValueFrom(interceptor.intercept(ctx, next));

    expect(dailyLogRepo.findToday).not.toHaveBeenCalled();
    expect(dailyLogRepo.create).not.toHaveBeenCalled();
    expect(streaksRepo.incrementOrReset).not.toHaveBeenCalled();
  });

  it('does not throw when the response stream errors', async () => {
    dailyLogRepo.findToday.mockResolvedValue(null);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 'u-1' } }),
      }),
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => throwError(() => new Error('boom')) };

    await expect(
      firstValueFrom(interceptor.intercept(ctx, next)),
    ).rejects.toThrow('boom');
    expect(dailyLogRepo.create).not.toHaveBeenCalled();
  });
});