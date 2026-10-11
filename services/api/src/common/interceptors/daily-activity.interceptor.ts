import {
  Injectable,
  Logger,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { DailylogsRepo } from '@/v1/gamify/daily-logs/daily-logs.repo';
import { StreakActivity } from '@prisma/client';

@Injectable()
export class ActivityDetectorInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityDetectorInterceptor.name);

  constructor(private readonly dailyLogRepo: DailylogsRepo) {}

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
    }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const userId = req?.user?.id as string | undefined;

    return next.handle().pipe(
      tap({
        next: () => {
          if (!userId) return;
          this.detect(userId).catch((error: unknown) => {
            this.logger.warn(`Daily activity was not recorded for user ${userId}: ${error instanceof Error ? error.message : String(error)}`);
          });
        },
        error: () => undefined,
      }),
    );
  }
}