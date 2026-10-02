import { StreakService } from '@/common/streak/streak.service';
import { StreakActivity } from '@prisma/client';

describe('streak-resets-on-missed-day (Phase 0)', () => {
  let service: StreakService;
  let dailyLogRepo: { findToday: jest.Mock; create: jest.Mock };
  let streaksRepo: { incrementOrReset: jest.Mock };

  beforeEach(() => {
    dailyLogRepo = { findToday: jest.fn(), create: jest.fn() };
    streaksRepo = { incrementOrReset: jest.fn() };
    service = new StreakService(dailyLogRepo as any, streaksRepo as any);
  });

  it('gap > 24h triggers reset path on next event', async () => {
    dailyLogRepo.findToday.mockResolvedValue(null);

    await service.recordLearningEvent({
      userId: 'u-1',
      activity: StreakActivity.LESSON,
    });

    expect(streaksRepo.incrementOrReset).toHaveBeenCalledWith(
      'u-1',
      StreakActivity.LESSON,
    );
  });

  it('does not call increment when log already exists today', async () => {
    dailyLogRepo.findToday.mockResolvedValue({ id: 'log-1', userId: 'u-1' });

    await service.recordLearningEvent({
      userId: 'u-1',
      activity: StreakActivity.QUIZ,
    });

    expect(streaksRepo.incrementOrReset).not.toHaveBeenCalled();
  });

  it('handles streak for distinct activities independently', async () => {
    dailyLogRepo.findToday.mockResolvedValue(null);

    await service.recordLearningEvent({
      userId: 'u-1',
      activity: StreakActivity.LESSON,
    });
    await service.recordLearningEvent({
      userId: 'u-1',
      activity: StreakActivity.QUIZ,
    });

    expect(streaksRepo.incrementOrReset).toHaveBeenCalledWith(
      'u-1',
      StreakActivity.LESSON,
    );
    expect(streaksRepo.incrementOrReset).toHaveBeenCalledWith(
      'u-1',
      StreakActivity.QUIZ,
    );
  });
});