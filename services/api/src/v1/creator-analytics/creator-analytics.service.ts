import { Injectable } from '@nestjs/common';
import { EarningStatus } from '@prisma/client';
import { PrismaService } from '@/common/config/prisma/prisma.service';

export interface CreatorEarningRow {
  id: string;
  amount: number;
  currency: string;
  source: string;
  createdAt: string;
  paidOut: boolean;
}

export interface CreatorEarningsSummary {
  totalEarned: number;
  pendingPayout: number;
  lifetimeEarnings: number;
  recent: CreatorEarningRow[];
}

export interface ConceptDiagnostic {
  conceptKey: string;
  totalAttempts: number;
  totalFailures: number;
  failureRate: number;
  lastAttemptAt: Date | null;
  exampleSubTopicIds: string[];
}

export interface CreatorDiagnostics {
  totalLearners: number;
  activeLearners: number;
  concepts: ConceptDiagnostic[];
  strugglingConcepts: ConceptDiagnostic[];
  summary: string;
}

@Injectable()
export class CreatorAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCreatorEarnings(creatorId: string): Promise<CreatorEarningsSummary> {
    const [pending, lifetime, recent] = await Promise.all([
      this.prisma.creatorEarning.aggregate({
        where: {
          creatorId,
          status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
        },
        _sum: { creatorAmount: true },
      }),
      this.prisma.creatorEarning.aggregate({
        where: { creatorId, status: { not: EarningStatus.REVERSED } },
        _sum: { creatorAmount: true },
      }),
      this.prisma.creatorEarning.findMany({
        where: { creatorId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const rows: CreatorEarningRow[] = recent.map((e) => ({
      id: e.id,
      amount: Number(e.creatorAmount.toString()),
      currency: e.currency,
      source: e.orderItemId,
      createdAt: e.createdAt.toISOString(),
      paidOut: e.status === EarningStatus.PAID_OUT,
    }));

    return {
      pendingPayout: Number((pending._sum.creatorAmount ?? 0).toString()),
      lifetimeEarnings: Number((lifetime._sum.creatorAmount ?? 0).toString()),
      totalEarned: recent
        .filter((e) => e.status !== EarningStatus.REVERSED)
        .reduce((sum, e) => sum + Number(e.creatorAmount.toString()), 0),
      recent: rows,
    };
  }

  async getCreatorDiagnostics(creatorId: string): Promise<CreatorDiagnostics> {
    const articles = await this.prisma.article.findMany({
      where: { authorId: creatorId, status: 'PUBLISHED' },
      select: { id: true, slug: true, title: true },
    });
    const articleIds = articles.map((a) => a.id);

    const classes = await this.prisma.classProduct.findMany({
      where: { instructorId: creatorId, status: 'PUBLISHED' },
      select: { id: true, slug: true, title: true },
    });
    const classIds = classes.map((c) => c.id);

    if (articleIds.length === 0 && classIds.length === 0) {
      return {
        totalLearners: 0,
        activeLearners: 0,
        concepts: [],
        strugglingConcepts: [],
        summary: 'Tidak ada materi yang sudah terbit.',
      };
    }

    const purchases = await this.prisma.entitlement.findMany({
      where: {
        OR: [
          ...(articleIds.length > 0 ? [{ articleId: { in: articleIds } }] : []),
          ...(classIds.length > 0 ? [{ classId: { in: classIds } }] : []),
        ],
      },
      select: { userId: true, createdAt: true, articleId: true, classId: true },
    });

    const learnerSet = new Set(purchases.map((p) => p.userId));
    const totalLearners = learnerSet.size;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeLearners = new Set(
      purchases.filter((p) => p.createdAt >= sevenDaysAgo).map((p) => p.userId),
    ).size;

    const entitlementByArticle = new Map<string, string[]>();
    const entitlementByClass = new Map<string, string[]>();
    for (const p of purchases) {
      if (p.articleId) {
        const list = entitlementByArticle.get(p.articleId) ?? [];
        list.push(p.userId);
        entitlementByArticle.set(p.articleId, list);
      }
      if (p.classId) {
        const list = entitlementByClass.get(p.classId) ?? [];
        list.push(p.userId);
        entitlementByClass.set(p.classId, list);
      }
    }

    const conceptStats = new Map<
      string,
      { attempts: number; failures: number; lastAt: Date | null; subTopicIds: Set<string> }
    >();

    for (const article of articles) {
      const userIds = entitlementByArticle.get(article.id) ?? [];
      if (userIds.length === 0) continue;

      const topicLinkages = await this.prisma.article.findUnique({
        where: { id: article.id },
        select: { id: true, slug: true, categoryId: true },
      });

      const attempts = await this.prisma.episode.findMany({
        where: {
          userId: { in: userIds },
          createdAt: { gte: sevenDaysAgo },
        },
        select: { inputPayload: true, createdAt: true, evaluationScore: true },
      });
      this.aggregateAttempts(attempts, conceptStats, topicLinkages?.id ?? article.slug);
    }

    for (const cls of classes) {
      const userIds = entitlementByClass.get(cls.id) ?? [];
      if (userIds.length === 0) continue;

      const attempts = await this.prisma.episode.findMany({
        where: {
          userId: { in: userIds },
          createdAt: { gte: sevenDaysAgo },
        },
        select: { inputPayload: true, createdAt: true, evaluationScore: true },
      });
      this.aggregateAttempts(attempts, conceptStats, cls.slug);
    }

    const concepts: ConceptDiagnostic[] = [];
    for (const [conceptKey, stats] of conceptStats.entries()) {
      const failureRate = stats.attempts > 0 ? stats.failures / stats.attempts : 0;
      concepts.push({
        conceptKey,
        totalAttempts: stats.attempts,
        totalFailures: stats.failures,
        failureRate,
        lastAttemptAt: stats.lastAt,
        exampleSubTopicIds: Array.from(stats.subTopicIds).slice(0, 3),
      });
    }

    concepts.sort((a, b) => b.failureRate - a.failureRate);
    const strugglingConcepts = concepts.filter((c) => c.failureRate >= 0.5 && c.totalAttempts >= 3);

    const summary = this.buildSummary(totalLearners, activeLearners, concepts.length, strugglingConcepts);

    return {
      totalLearners,
      activeLearners,
      concepts: concepts.slice(0, 20),
      strugglingConcepts: strugglingConcepts.slice(0, 10),
      summary,
    };
  }

  private aggregateAttempts(
    attempts: Array<{ inputPayload: unknown; createdAt: Date; evaluationScore: number | null }>,
    conceptStats: Map<
      string,
      { attempts: number; failures: number; lastAt: Date | null; subTopicIds: Set<string> }
    >,
    fallbackKey: string,
  ): void {
    for (const a of attempts) {
      const payload = (a.inputPayload as Record<string, unknown> | null) ?? null;
      const conceptKey =
        typeof payload?.['conceptKey'] === 'string'
          ? (payload['conceptKey'] as string)
          : fallbackKey;
      const entry = conceptStats.get(conceptKey) ?? {
        attempts: 0,
        failures: 0,
        lastAt: null,
        subTopicIds: new Set<string>(),
      };
      entry.attempts += 1;
      const wasFailure =
        (a.evaluationScore !== null && a.evaluationScore < 0.5) ||
        (payload?.['wasCorrect'] === false);
      if (wasFailure) entry.failures += 1;
      if (!entry.lastAt || a.createdAt > entry.lastAt) entry.lastAt = a.createdAt;
      const subTopicId =
        typeof payload?.['subTopicId'] === 'string' ? (payload['subTopicId'] as string) : null;
      if (subTopicId) entry.subTopicIds.add(subTopicId);
      conceptStats.set(conceptKey, entry);
    }
  }

  private buildSummary(
    totalLearners: number,
    activeLearners: number,
    trackedConcepts: number,
    strugglingConcepts: ConceptDiagnostic[],
  ): string {
    if (trackedConcepts === 0) {
      return `Pantau ${totalLearners} mahasiswa. Belum cukup data untuk diagnosa konsep.`;
    }
    if (strugglingConcepts.length === 0) {
      return `${activeLearners} dari ${totalLearners} mahasiswa aktif minggu ini. Tidak ada konsep dengan tingkat kegagalan >= 50%.`;
    }
    const top = strugglingConcepts[0]!;
    return `${activeLearners} dari ${totalLearners} mahasiswa aktif. Konsep paling sulit: ${top.conceptKey} (${(top.failureRate * 100).toFixed(0)}% gagal dari ${top.totalAttempts} percobaan).`;
  }
}
