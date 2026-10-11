import { ExecutionContext, CallHandler } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { ActivityDetectorInterceptor } from '@/common/interceptors/daily-activity.interceptor';
import { DailylogsRepo } from '@/v1/gamify/daily-logs/daily-logs.repo';
import { StreakActivity } from '@prisma/client';

const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

describe('ActivityDetectorInterceptor (Phase 0 wiring)', () => {
  let interceptor: ActivityDetectorInterceptor;
  let dailyLogRepo: { findToday: jest.Mock; create: jest.Mock };

  beforeEach(() => {
    dailyLogRepo = {
      findToday: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    };
    interceptor = new ActivityDetectorInterceptor(dailyLogRepo as any);
  });

  function buildCtx(userId?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => (userId ? { user: { id: userId } } : {}),
      }),
    } as unknown as ExecutionContext;
  }

  it('mints a daily activity on first request of the day', async () => {
    const next: CallHandler = { handle: () => of('ok') };

    await firstValueFrom(interceptor.intercept(buildCtx('u-1'), next));
    await flushMicrotasks();
    await flushMicrotasks();

    expect(dailyLogRepo.findToday).toHaveBeenCalled();
    expect(dailyLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u-1',
        activityType: StreakActivity.DAILY_LOGIN,
      }),
    );
  });

  it('does not double-mint when daily log already exists', async () => {
    dailyLogRepo.findToday.mockResolvedValue({ id: 'log-1' });
    const next: CallHandler = { handle: () => of('ok') };

    await firstValueFrom(interceptor.intercept(buildCtx('u-1'), next));
    await flushMicrotasks();

    expect(dailyLogRepo.create).not.toHaveBeenCalled();
  });

  it('does nothing when no authenticated user is on the request', async () => {
    const next: CallHandler = { handle: () => of('ok') };

    await firstValueFrom(interceptor.intercept(buildCtx(), next));
    await flushMicrotasks();

    expect(dailyLogRepo.findToday).not.toHaveBeenCalled();
    expect(dailyLogRepo.create).not.toHaveBeenCalled();
  });
});