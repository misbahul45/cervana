import { ExecutionContext } from '@nestjs/common';
import { ActivityDetectorInterceptor } from '../daily-activity.interceptor';

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

  it('does NOT trigger on every authenticated request', () => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 'u-1' } }),
      }),
    } as unknown as ExecutionContext;

    const mockHandler = { handle: jest.fn().mockReturnValue('next') };
    const result = interceptor.intercept(ctx, mockHandler as any);

    expect(result).toBe('next');
    expect(dailyLogRepo.findToday).not.toHaveBeenCalled();
    expect(dailyLogRepo.create).not.toHaveBeenCalled();
    expect(streaksRepo.incrementOrReset).not.toHaveBeenCalled();
  });

  it('still exposes detect() for explicit callers', async () => {
    dailyLogRepo.findToday.mockResolvedValue(null);

    await interceptor.detect('u-1');

    expect(dailyLogRepo.create).toHaveBeenCalled();
    expect(streaksRepo.incrementOrReset).toHaveBeenCalledWith(
      'u-1',
      expect.any(String),
    );
  });
});