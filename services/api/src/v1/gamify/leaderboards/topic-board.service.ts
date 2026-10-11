import { Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { MembershipInput, weekWindow } from './board-rules';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export interface BoardEntry {
  rank: number;
  handle: string;
  score: number;
  you: boolean;
}

export interface TopicBoard {
  topicId: string;
  window: { startDate: string; kind: 'week' };
  entries: BoardEntry[];
  me: { optedIn: boolean; rank: number | null; score: number };
}

interface RankedRow {
  userId: string;
  handle: string;
  score: number;
  rank: number;
}

@Injectable()
export class TopicBoardService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly clock?: () => Date,
  ) {}

  async board(userId: string, topicId: string, options: { limit?: number } = {}): Promise<TopicBoard> {
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(options.limit ?? DEFAULT_LIMIT)));
    const window = weekWindow((this.clock ?? (() => new Date()))());

    const [ranked, me, own] = await Promise.all([
      this.ranked(topicId, window.start, window.end),
      this.prisma.user.findUnique({ where: { id: userId }, select: { leaderboardOptIn: true, leaderboardHandle: true } }),
      this.ownScore(userId, topicId, window.start, window.end),
    ]);

    const optedIn = Boolean(me?.leaderboardOptIn && me.leaderboardHandle);
    const mine = ranked.find((row) => row.userId === userId);
    return {
      topicId,
      window: { startDate: window.startDate, kind: 'week' },
      entries: ranked.slice(0, limit).map((row) => ({ rank: row.rank, handle: row.handle, score: row.score, you: row.userId === userId })),
      me: { optedIn, rank: mine?.rank ?? null, score: own },
    };
  }

  async updateMembership(userId: string, input: MembershipInput): Promise<{ optedIn: boolean; handle: string | null }> {
    const current = await this.prisma.user.findUnique({ where: { id: userId }, select: { leaderboardHandle: true, leaderboardOptIn: true } });
    if (!current) throw new AppError('Learner not found', 404, AppErrorCode.NOT_FOUND);

    const handle = input.handle ?? current.leaderboardHandle;
    const optIn = input.optIn ?? current.leaderboardOptIn;
    if (optIn && !handle) throw new AppError('Choose a handle before joining a board', 400, AppErrorCode.VALIDATION_ERROR);

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: { leaderboardHandle: handle, leaderboardOptIn: optIn },
        select: { leaderboardHandle: true, leaderboardOptIn: true },
      });
      return { optedIn: updated.leaderboardOptIn, handle: updated.leaderboardHandle };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError('That handle is taken', 409, AppErrorCode.UNIQUE_CONSTRAINT_FAILED);
      }
      throw error;
    }
  }

  private async ranked(topicId: string, start: Date, end: Date): Promise<RankedRow[]> {
    const rows = await this.prisma.$queryRaw<Array<{ userId: string; handle: string; score: number; rank: number }>>`
      SELECT p."userId", u."leaderboardHandle" AS handle, p.score,
             (row_number() OVER (ORDER BY p.score DESC, p.last_at ASC, p."userId" ASC))::int AS rank
      FROM (
        SELECT g."userId", count(*)::int AS score, max(g."createdAt") AS last_at
        FROM "GamificationLedger" g
        WHERE g."ruleId" = 'CONCEPT_PASSED' AND g."reversalOf" IS NULL AND g."topicId" = ${topicId}
          AND g."createdAt" >= ${start} AND g."createdAt" < ${end}
          AND NOT EXISTS (SELECT 1 FROM "GamificationLedger" r WHERE r."reversalOf" = g.id)
        GROUP BY g."userId"
      ) p
      JOIN "User" u ON u.id = p."userId"
      WHERE u."leaderboardOptIn" AND u."leaderboardHandle" IS NOT NULL
      ORDER BY rank ASC`;
    return rows;
  }

  private async ownScore(userId: string, topicId: string, start: Date, end: Date): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM "GamificationLedger" g
      WHERE g."userId" = ${userId} AND g."ruleId" = 'CONCEPT_PASSED' AND g."reversalOf" IS NULL AND g."topicId" = ${topicId}
        AND g."createdAt" >= ${start} AND g."createdAt" < ${end}
        AND NOT EXISTS (SELECT 1 FROM "GamificationLedger" r WHERE r."reversalOf" = g.id)`;
    return rows[0]?.n ?? 0;
  }
}
