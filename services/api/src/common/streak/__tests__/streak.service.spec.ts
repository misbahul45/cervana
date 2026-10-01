import { StreakService } from '../streak.service';
import { StreakActivity } from '@prisma/client';

describe('StreakService', () => {
  let service: StreakService;
  let dailyLogRepo: {
    findToday: jest.Mock;
    create: jest.Mock;
  };
  let streaksRepo: {
    incrementOrReset: jest.Mock;
  };

  beforeEach(() => {
    dailyLogRepo = {
      findToday: jest.fn(),
      create: jest.fn(),
    };
    streaksRepo = {
      incrementOrReset: jest.fn(),
    };
    service = new StreakService(
      dailyLogRepo as any,
      streaksRepo as any,
    );
  });

  describe('recordLearningEvent', () => {
    it('creates a daily log entry if none exists today', async () => {
      dailyLogRepo.findToday.mockResolvedValue(null);

      await service.recordLearningEvent({
        userId: 'u-1',
        activity: StreakActivity.LESSON,
      });

      expect(dailyLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u-1',
          activityType: StreakActivity.LESSON,
        }),
      );
      expect(streaksRepo.incrementOrReset).toHaveBeenCalledWith(
        'u-1',
        StreakActivity.LESSON,
      );
    });

    it('does nothing if a log entry already exists today', async () => {
      dailyLogRepo.findToday.mockResolvedValue({
        id: 'dl-1',
        userId: 'u-1',
      });

      await service.recordLearningEvent({
        userId: 'u-1',
        activity: StreakActivity.QUIZ,
      });

      expect(dailyLogRepo.create).not.toHaveBeenCalled();
      expect(streaksRepo.incrementOrReset).not.toHaveBeenCalled();
    });

    it('queries daily log with correct day range', async () => {
      dailyLogRepo.findToday.mockResolvedValue(null);

      await service.recordLearningEvent({
        userId: 'u-1',
        activity: StreakActivity.LESSON,
      });

      expect(dailyLogRepo.findToday).toHaveBeenCalledWith(
        'u-1',
        expect.any(Date),
        expect.any(Date),
      );

      const [, start, end] = dailyLogRepo.findToday.mock.calls[0];
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
    });

    it('passes activity type through to log entry', async () => {
      dailyLogRepo.findToday.mockResolvedValue(null);

      await service.recordLearningEvent({
        userId: 'u-2',
        activity: StreakActivity.TOPIC_COMPLETE,
      });

      expect(dailyLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ activityType: StreakActivity.TOPIC_COMPLETE }),
      );
      expect(streaksRepo.incrementOrReset).toHaveBeenCalledWith(
        'u-2',
        StreakActivity.TOPIC_COMPLETE,
      );
    });
  });
});