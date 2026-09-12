import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { DailylogsRepo } from '@/v1/gamify/daily-logs/daily-logs.repo';
import { StreaksRepo } from '@/v1/gamify/streaks/streaks.repo';
import { StreakActivity } from '@prisma/client';

@Injectable()
export class ActivityDetectorInterceptor implements NestInterceptor {
  constructor(
    private readonly dailyLogRepo: DailylogsRepo,
    private readonly streaksRepo: StreaksRepo,
  ) {}

  private getDayRange(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  async detect(userId: string) {
    const today = new Date();
    const { start, end } = this.getDayRange(today);
    const existingLog = await this.dailyLogRepo.findToday(userId, start, end);

    if (!existingLog) {
      await this.dailyLogRepo.create({
        userId,
        date: today,
        activityType: StreakActivity.DAILY_LOGIN,
      });

      await this.streaksRepo.incrementOrReset(userId, StreakActivity.DAILY_LOGIN);
      console.log(`🔥 Streak updated for user ${userId}`);
    }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (user) this.detect(user.id).catch(console.error);
    return next.handle();
  }
}
