import { Injectable } from '@nestjs/common';
import { GamificationLedger, LeaderboardScope, Prisma, RewardKind, Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditService } from '@/common/authz/audit.service';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { AppError, AppErrorCode } from '@/common/lib/error';

const MAX_HISTORY = 100;
const MIN_REASON = 3;
const MAX_REASON = 500;

export interface GrantInput {
  userId: string;
  kind?: RewardKind;
  ruleId: string;
  ruleVersion: number;
  points: number;
  idempotencyKey: string;
  sourceType: string;
  sourceId?: string;
  conceptId?: string;
  topicId?: string;
  subTopicId?: string;
}

export interface ReverseInput {
  entryId: string;
  reason: string;
  actorId: string;
  actorRole: Role;
}

export interface LedgerResult {
  entry: GamificationLedger;
  duplicate: boolean;
}

export interface LedgerHistory {
  balance: number;
  starBalance: number;
  entries: GamificationLedger[];
}

interface ProjectionTarget {
  id: string;
  scope: LeaderboardScope;
  topicId: string | null;
  subTopicId: string | null;
}

const invalid = (message: string) => new AppError(message, 400, AppErrorCode.VALIDATION_ERROR);

const targetsOf = (entry: Pick<GamificationLedger, 'userId' | 'topicId' | 'subTopicId'>): ProjectionTarget[] => [
  { id: `g-${entry.userId}`, scope: 'GLOBAL', topicId: null, subTopicId: null },
  ...(entry.topicId ? [{ id: `t-${entry.userId}-${entry.topicId}`, scope: 'TOPIC' as const, topicId: entry.topicId, subTopicId: null }] : []),
  ...(entry.subTopicId ? [{ id: `st-${entry.userId}-${entry.subTopicId}`, scope: 'SUBTOPIC' as const, topicId: null, subTopicId: entry.subTopicId }] : []),
];

@Injectable()
export class RewardLedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async grant(input: GrantInput, tx?: Prisma.TransactionClient): Promise<LedgerResult> {
    if (!Number.isInteger(input.points) || input.points <= 0) throw invalid('A grant must be a positive whole number of points');
    if (!input.idempotencyKey) throw invalid('A grant needs an idempotency key');
    const work = (client: Prisma.TransactionClient) => this.grantWithin(client, input);
    return tx ? work(tx) : this.prisma.$transaction(work);
  }

  async reverse(input: ReverseInput, tx?: Prisma.TransactionClient): Promise<LedgerResult> {
    const reason = input.reason.trim();
    if (reason.length < MIN_REASON || reason.length > MAX_REASON) throw invalid(`A reversal needs a reason of ${MIN_REASON} to ${MAX_REASON} characters`);
    const work = (client: Prisma.TransactionClient) => this.reverseWithin(client, { ...input, reason });
    return tx ? work(tx) : this.prisma.$transaction(work);
  }

  async history(userId: string, options: { limit?: number } = {}): Promise<LedgerHistory> {
    const limit = Math.min(MAX_HISTORY, Math.max(1, Math.trunc(options.limit ?? 20)));
    const [entries, totals] = await Promise.all([
      this.prisma.gamificationLedger.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit }),
      this.prisma.gamificationLedger.groupBy({ by: ['kind'], where: { userId }, _sum: { points: true } }),
    ]);
    const sumOf = (kind: RewardKind) => totals.find((t) => t.kind === kind)?._sum.points ?? 0;
    return { balance: sumOf('XP'), starBalance: sumOf('STAR'), entries };
  }

  private async grantWithin(tx: Prisma.TransactionClient, input: GrantInput): Promise<LedgerResult> {
    const inserted = await tx.gamificationLedger.createMany({
      data: [
        {
          id: randomUUID(),
          userId: input.userId,
          kind: input.kind ?? 'XP',
          ruleId: input.ruleId,
          ruleVersion: input.ruleVersion,
          points: input.points,
          idempotencyKey: input.idempotencyKey,
          sourceType: input.sourceType,
          sourceId: input.sourceId ?? null,
          conceptId: input.conceptId ?? null,
          topicId: input.topicId ?? null,
          subTopicId: input.subTopicId ?? null,
        },
      ],
      skipDuplicates: true,
    });

    const entry = await tx.gamificationLedger.findUniqueOrThrow({ where: { idempotencyKey: input.idempotencyKey } });
    if (inserted.count === 0) return { entry, duplicate: true };

    await this.project(tx, entry, entry.points);
    return { entry, duplicate: false };
  }

  private async reverseWithin(tx: Prisma.TransactionClient, input: ReverseInput): Promise<LedgerResult> {
    const original = await tx.gamificationLedger.findUnique({ where: { id: input.entryId } });
    if (!original) throw new AppError('Ledger entry not found', 404, AppErrorCode.NOT_FOUND);
    if (original.reversalOf !== null) {
      throw new AppError('A reversal cannot be reversed', 409, AppErrorCode.INVALID_STATE_TRANSITION);
    }

    const inserted = await tx.gamificationLedger.createMany({
      data: [
        {
          id: randomUUID(),
          userId: original.userId,
          kind: original.kind,
          ruleId: original.ruleId,
          ruleVersion: original.ruleVersion,
          points: -original.points,
          idempotencyKey: `reward:REVERSAL:${original.id}`,
          sourceType: 'REVERSAL',
          sourceId: original.id,
          conceptId: original.conceptId,
          topicId: original.topicId,
          subTopicId: original.subTopicId,
          reversalOf: original.id,
          reason: input.reason,
          actorId: input.actorId,
        },
      ],
      skipDuplicates: true,
    });

    const entry = await tx.gamificationLedger.findUniqueOrThrow({ where: { reversalOf: original.id } });
    if (inserted.count === 0) return { entry, duplicate: true };

    await this.project(tx, entry, entry.points);
    await this.audit.record(
      {
        actorId: input.actorId,
        actorRole: input.actorRole,
        action: 'REWARD_REVERSED',
        entityType: 'GamificationLedger',
        entityId: original.id,
        before: { points: original.points, ruleId: original.ruleId, ruleVersion: original.ruleVersion, userId: original.userId },
        after: { points: entry.points, reversalId: entry.id },
        reason: input.reason,
      },
      tx as unknown as Pick<PrismaService, 'auditLog'>,
    );
    return { entry, duplicate: false };
  }

  private async project(tx: Prisma.TransactionClient, entry: GamificationLedger, delta: number): Promise<void> {
    if (entry.kind === 'STAR') {
      await tx.$executeRaw`UPDATE "User" SET stars = stars + ${delta} WHERE id = ${entry.userId}`;
      return;
    }
    await tx.$executeRaw`UPDATE "User" SET "totalPoints" = "totalPoints" + ${delta} WHERE id = ${entry.userId}`;
    for (const target of targetsOf(entry)) {
      await tx.$executeRaw`
        INSERT INTO "LeaderboardScore" (id, "userId", scope, "categoryId", "topicId", "subTopicId", score, "updatedAt")
        VALUES (${target.id}, ${entry.userId}, ${target.scope}::"LeaderboardScope", NULL, ${target.topicId}, ${target.subTopicId}, ${delta}, now())
        ON CONFLICT (id) DO UPDATE SET score = "LeaderboardScore".score + EXCLUDED.score, "updatedAt" = now()`;
    }
  }
}
