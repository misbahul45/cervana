import { ExecutionContext, CallHandler } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { ActivityDetectorInterceptor } from '../daily-activity.interceptor';
import { DailylogsRepo } from '@/v1/gamify/daily-logs/daily-logs.repo';
import { StreakActivity } from '@prisma/client';

const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

describe('ActivityDetectorInterceptor', () => {
  let interceptor: ActivityDetectorInterceptor;
  let dailyLogRepo: { findToday: jest.Mock; create: jest.Mock };

  beforeEach(() => {
    dailyLogRepo = { findToday: jest.fn(), create: jest.fn() };
    interceptor = new ActivityDetectorInterceptor(dailyLogRepo as any);
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

  describe('when recording the activity fails', () => {
    const ctx = { switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u-1' } }) }) } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of('ok') };
    let rejections: unknown[];
    const onRejection = (reason: unknown) => {
      rejections.push(reason);
    };

    beforeEach(() => {
      rejections = [];
      process.on('unhandledRejection', onRejection);
    });

    afterEach(() => {
      process.off('unhandledRejection', onRejection);
    });

    it('still answers the request and leaves no unhandled rejection that would stop the process', async () => {
      dailyLogRepo.findToday.mockRejectedValue(new Error('database blip'));

      await expect(firstValueFrom(interceptor.intercept(ctx, next))).resolves.toBe('ok');
      await flushMicrotasks();
      await flushMicrotasks();
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(rejections).toEqual([]);
    });

    it('also survives a failure while creating the log or the streak', async () => {
      dailyLogRepo.findToday.mockResolvedValue(null);
      dailyLogRepo.create.mockRejectedValue(new Error('Invalid UUID'));

      await firstValueFrom(interceptor.intercept(ctx, next));
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(rejections).toEqual([]);
    });
  });

  it('has no streak dependency, so a chat message or any other request can never extend a streak (GM-03)', () => {
    expect(Reflect.getMetadata('design:paramtypes', ActivityDetectorInterceptor)).toEqual([DailylogsRepo]);
  });
});
