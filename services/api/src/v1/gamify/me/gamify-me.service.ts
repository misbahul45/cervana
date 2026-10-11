import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { localDateOf } from '../streaks/streak-fold';
import { DEFAULT_LEVELS, LevelProgress, levelProgress } from './level-progress';
import { CalendarDay, StreakStatus, shiftDate, streakCalendar, streakStatus } from './streak-calendar';

const HISTORY_DAYS = 60;

export interface GamifyMe {
  xp: number;
  level: LevelProgress;
  stars: number;
  streak: {
    current: number;
    longest: number;
    freezes: number;
    lastDate: string | null;
    today: string;
    status: StreakStatus;
    week: CalendarDay[];
  };
  board: { optedIn: boolean; handle: string | null };
}

@Injectable()
export class GamifyMeService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly clock?: () => Date,
  ) {}

  async get(userId: string): Promise<GamifyMe> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        totalPoints: true,
        stars: true,
        currentStreak: true,
        longestStreak: true,
        streakFreezes: true,
        lastStreakDate: true,
        timezone: true,
        leaderboardOptIn: true,
        leaderboardHandle: true,
      },
    });
    if (!user) throw new AppError('Learner not found', 404, AppErrorCode.NOT_FOUND);

    const today = localDateOf((this.clock ?? (() => new Date()))(), user.timezone);
    const [thresholds, history] = await Promise.all([
      this.prisma.levelThreshold.findMany({ orderBy: { level: 'asc' } }),
      this.prisma.streakHistory.findMany({
        where: { userId, date: { gte: new Date(`${shiftDate(today, -HISTORY_DAYS)}T00:00:00Z`) } },
        select: { date: true },
        orderBy: { date: 'asc' },
      }),
    ]);

    const lastDate = user.lastStreakDate ? user.lastStreakDate.toISOString().slice(0, 10) : null;
    const state = { current: user.currentStreak, freezes: user.streakFreezes, lastDate };

    return {
      xp: user.totalPoints,
      level: levelProgress(user.totalPoints, thresholds.length > 0 ? thresholds : DEFAULT_LEVELS),
      stars: user.stars,
      streak: {
        current: user.currentStreak,
        longest: user.longestStreak,
        freezes: user.streakFreezes,
        lastDate,
        today,
        status: streakStatus(state, today),
        week: streakCalendar(history.map((row) => row.date.toISOString().slice(0, 10)), today),
      },
      board: { optedIn: user.leaderboardOptIn, handle: user.leaderboardHandle },
    };
  }
}
