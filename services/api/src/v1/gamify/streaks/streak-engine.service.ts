import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RewardLedgerService } from '../rewards/reward-ledger.service';
import { streakBonus } from '../rewards/reward-rules';
import { RewardRulesService } from '../rewards/reward-rules.service';
import { DEFAULT_STREAK_CONFIG, EMPTY_STREAK, StreakState, foldQualifiedDay, localDateOf } from './streak-fold';

export interface StreakOutcome extends StreakState {
  extended: boolean;
  freezeEarned: boolean;
  freezesUsed: number;
  bonusPoints: number;
}

interface LearnerStreakRow {
  timezone: string;
  currentStreak: number;
  longestStreak: number;
  streakFreezes: number;
  lastStreakDate: Date | null;
}

const asDate = (isoDay: string): Date => new Date(`${isoDay}T00:00:00Z`);

@Injectable()
export class StreakEngineService {
  constructor(
    private readonly ledger: RewardLedgerService,
    private readonly rules: RewardRulesService,
  ) {}

  async onQualified(input: { userId: string; at: Date }, tx: Prisma.TransactionClient): Promise<StreakOutcome> {
    const rows = await tx.$queryRaw<LearnerStreakRow[]>`
      SELECT "timezone", "currentStreak", "longestStreak", "streakFreezes", "lastStreakDate"
      FROM "User" WHERE id = ${input.userId} FOR UPDATE`;
    const learner = rows[0];
    if (!learner) return { ...EMPTY_STREAK, extended: false, freezeEarned: false, freezesUsed: 0, bonusPoints: 0 };

    const before: StreakState = {
      current: learner.currentStreak,
      longest: learner.longestStreak,
      freezes: learner.streakFreezes,
      lastDate: learner.lastStreakDate ? learner.lastStreakDate.toISOString().slice(0, 10) : null,
    };
    const date = localDateOf(input.at, learner.timezone);
    const step = foldQualifiedDay(before, date, DEFAULT_STREAK_CONFIG);
    if (!step.extended) return { ...before, extended: false, freezeEarned: false, freezesUsed: 0, bonusPoints: 0 };

    await tx.streakHistory.createMany({
      data: [{ userId: input.userId, date: asDate(date), activityType: 'QUIZ', streakCount: step.state.current }],
      skipDuplicates: true,
    });
    await tx.user.update({
      where: { id: input.userId },
      data: {
        currentStreak: step.state.current,
        longestStreak: step.state.longest,
        streakFreezes: step.state.freezes,
        lastStreakDate: asDate(date),
      },
    });

    const bonus = streakBonus(input.userId, step.state.current, asDate(date), await this.rules.current(tx));
    let bonusPoints = 0;
    if (bonus) {
      const result = await this.ledger.grant({ userId: input.userId, ...bonus }, tx);
      if (!result.duplicate) bonusPoints = result.entry.points;
    }

    return { ...step.state, extended: true, freezeEarned: step.freezeEarned, freezesUsed: step.freezesUsed, bonusPoints };
  }
}
