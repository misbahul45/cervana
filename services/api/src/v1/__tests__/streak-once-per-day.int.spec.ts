import { StreakActivity } from '@prisma/client';
import { ActivityDetectorInterceptor } from '@/common/interceptors/daily-activity.interceptor';
import { firstValueFrom, of } from 'rxjs';

const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

describe('streak-once-per-day (Phase 0)', () => {
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

  function buildCtx(userId: string) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: userId } }),
      }),
    } as any;
  }

  it('does not double-mint streak on two requests same day', async () => {
    dailyLogRepo.findToday.mockResolvedValue({ id: 'log-1' });
    const ctx = buildCtx('u-1');
    const next = { handle: () => of('ok') } as any;

    await firstValueFrom(interceptor.intercept(ctx, next));
    await firstValueFrom(interceptor.intercept(ctx, next));
    await flushMicrotasks();

    expect(dailyLogRepo.create).not.toHaveBeenCalled();
    expect(streaksRepo.incrementOrReset).not.toHaveBeenCalled();
  });

  it('mints streak exactly once per day across multiple users', async () => {
    dailyLogRepo.findToday.mockResolvedValue(null);

    await firstValueFrom(
      interceptor.intercept(buildCtx('u-1'), { handle: () => of('ok') } as any),
    );
    await firstValueFrom(
      interceptor.intercept(buildCtx('u-2'), { handle: () => of('ok') } as any),
    );
    await flushMicrotasks();

    expect(dailyLogRepo.create).toHaveBeenCalledTimes(2);
    expect(streaksRepo.incrementOrReset).toHaveBeenCalledTimes(2);
    expect(streaksRepo.incrementOrReset).toHaveBeenNthCalledWith(
      1,
      'u-1',
      StreakActivity.DAILY_LOGIN,
    );
    expect(streaksRepo.incrementOrReset).toHaveBeenNthCalledWith(
      2,
      'u-2',
      StreakActivity.DAILY_LOGIN,
    );
  });
});