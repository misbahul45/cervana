import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PASS_EVIDENCE, PASS_SCORE } from '@/v1/learner-model/policy/learner-policy.service';
import { DEFAULT_LEVELS, levelProgress } from '../me/level-progress';
import { AchievementMetric } from './achievement-rule';
import { MetricSource } from './achievement-evaluator';

@Injectable()
export class PrismaMetricSource implements MetricSource {
  async values(userId: string, metrics: ReadonlySet<AchievementMetric>, tx: Prisma.TransactionClient): Promise<Partial<Record<AchievementMetric, number>>> {
    const out: Partial<Record<AchievementMetric, number>> = {};

    if (metrics.has('ASSESSMENTS_COMPLETED')) {
      const rows = await tx.$queryRaw<Array<{ n: bigint }>>`
        SELECT count(DISTINCT payload->>'attemptId') AS n FROM "LearningEvent"
        WHERE "userId" = ${userId} AND "eventType" = 'ASSESSMENT_COMPLETED'`;
      out.ASSESSMENTS_COMPLETED = Number(rows[0]?.n ?? 0);
    }

    if (metrics.has('CONCEPTS_PASSED')) {
      out.CONCEPTS_PASSED = await tx.conceptMastery.count({
        where: { userId, score: { gte: PASS_SCORE }, evidenceCount: { gte: PASS_EVIDENCE }, concept: { status: 'ACTIVE' } },
      });
    }

    if (metrics.has('NODES_MASTERED')) {
      const rows = await tx.$queryRaw<Array<{ n: bigint }>>`
        SELECT count(*) AS n FROM "GamificationLedger" g
        WHERE g."userId" = ${userId} AND g."ruleId" = 'PATH_NODE_MASTERED' AND g."reversalOf" IS NULL
          AND NOT EXISTS (SELECT 1 FROM "GamificationLedger" r WHERE r."reversalOf" = g.id)`;
      out.NODES_MASTERED = Number(rows[0]?.n ?? 0);
    }

    if (metrics.has('STREAK_DAYS') || metrics.has('XP_TOTAL') || metrics.has('LEVEL')) {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { longestStreak: true, totalPoints: true } });
      const xp = user?.totalPoints ?? 0;
      if (metrics.has('STREAK_DAYS')) out.STREAK_DAYS = user?.longestStreak ?? 0;
      if (metrics.has('XP_TOTAL')) out.XP_TOTAL = xp;
      if (metrics.has('LEVEL')) {
        const stored = await tx.levelThreshold.findMany({ orderBy: { level: 'asc' } });
        out.LEVEL = levelProgress(xp, stored.length > 0 ? stored : DEFAULT_LEVELS).level;
      }
    }

    return out;
  }
}
