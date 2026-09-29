import { Injectable } from '@nestjs/common';
import { DailylogsRepo } from '@/v1/gamify/daily-logs/daily-logs.repo';
import { StreaksRepo } from '@/v1/gamify/streaks/streaks.repo';
import { StreakActivity } from '@prisma/client';

export interface StreakEvent {
  userId: string;
  activity: StreakActivity;
}

@Injectable()
export class StreakService {
  constructor(
    private readonly dailyLogRepo: DailylogsRepo,
    private readonly streaksRepo: StreaksRepo,
  ) {}

  async recordLearningEvent(event: StreakEvent): Promise<void> {
    const today = this.startOfDay(new Date());
    const existing = await this.dailyLogRepo.findToday(
      event.userId,
      today,
      this.endOfDay(today),
    );

    if (!existing) {
      await this.dailyLogRepo.create({
        userId: event.userId,
        date: today,
        activityType: event.activity,
      });
      await this.streaksRepo.incrementOrReset(event.userId, event.activity);
    }
  }

  private startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  private endOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  }
}