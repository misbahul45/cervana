import { Injectable } from '@nestjs/common';
import { ClassDifficulty, ContentStatus, ProductAccessType, TenantStatus } from '@prisma/client';
import { PrismaService } from '@/common/config/prisma/prisma.service';

export type ArticleCandidate = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  categoryId: string | null;
  authorId: string;
  tenantId: string;
  accessType: ProductAccessType;
  price: number | null;
  publishedAt: Date | null;
};

export type ClassCandidate = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  instructorId: string;
  tenantId: string;
  accessType: ProductAccessType;
  price: number | null;
  difficulty: ClassDifficulty;
  publishedAt: Date | null;
  format: string;
};

export type ProductCandidate =
  | ({ kind: 'article' } & ArticleCandidate)
  | ({ kind: 'class' } & ClassCandidate);

export interface LearnerSignals {
  userId: string;
  /** 0..1; learner-mastery average across active topics */
  averageMastery: number;
  /** ClassDifficulty preference derived from mastery bands */
  preferredDifficulty: ClassDifficulty;
  /** Topics the learner is currently working on */
  activeTopicIds: string[];
  /** Sub-topics already completed */
  completedSubTopicIds: string[];
}

export interface Recommendation {
  product: ProductCandidate;
  score: number;
  reason: string;
  signals: {
    matchesGoal: boolean;
    matchesDifficulty: boolean;
    matchesPrerequisites: boolean;
    novelty: number;
    engagement: number;
  };
}

const DIFFICULTY_RANK: Record<ClassDifficulty, number> = {
  BEGINNER: 0,
  INTERMEDIATE: 1,
  ADVANCED: 2,
};

const MASTERY_TO_DIFFICULTY: Array<[number, ClassDifficulty]> = [
  [0.0, ClassDifficulty.BEGINNER],
  [0.4, ClassDifficulty.INTERMEDIATE],
  [0.75, ClassDifficulty.ADVANCED],
];

export function masteryToPreferredDifficulty(mastery: number): ClassDifficulty {
  for (let i = MASTERY_TO_DIFFICULTY.length - 1; i >= 0; i -= 1) {
    const entry = MASTERY_TO_DIFFICULTY[i]!;
    if (mastery >= entry[0]) return entry[1];
  }
  return ClassDifficulty.BEGINNER;
}

const LEARNING_RELEVANCE_WEIGHT = 0.40;
const ENGAGEMENT_WEIGHT = 0.30;
const NOVELTY_WEIGHT = 0.15;
const DIFFICULTY_MATCH_WEIGHT = 0.15;

@Injectable()
export class MarketplaceDiscoveryService {
  constructor(private readonly prisma: PrismaService) {}

  async discoverFor(signals: LearnerSignals, options: { limit: number }): Promise<Recommendation[]> {
    const preferredDifficulty = signals.preferredDifficulty;
    const articles = await this.prisma.article.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        tenant: { status: TenantStatus.ACTIVE },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        categoryId: true,
        authorId: true,
        tenantId: true,
        accessType: true,
        price: true,
        publishedAt: true,
      },
    });
    const articleCandidates: ArticleCandidate[] = articles.map((a) => ({
      ...a,
      price: a.price ? Number(a.price.toString()) : null,
    }));

    const classes = await this.prisma.classProduct.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        tenant: { status: TenantStatus.ACTIVE },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        instructorId: true,
        tenantId: true,
        accessType: true,
        price: true,
        difficulty: true,
        publishedAt: true,
        format: true,
      },
    });
    const classCandidates: ClassCandidate[] = classes.map((c) => ({
      ...c,
      price: c.price ? Number(c.price.toString()) : null,
    }));

    const recommendations: Recommendation[] = [];
    for (const article of articleCandidates) {
      recommendations.push(this.scoreArticle(article, signals, preferredDifficulty));
    }
    for (const cls of classCandidates) {
      recommendations.push(this.scoreClass(cls, signals, preferredDifficulty));
    }

    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit);
  }

  async explainFor(product: ProductCandidate, signals: LearnerSignals): Promise<string> {
    if (product.kind === 'article') {
      return this.scoreArticle(product, signals, signals.preferredDifficulty).reason;
    }
    return this.scoreClass(product, signals, signals.preferredDifficulty).reason;
  }

  private scoreArticle(
    article: ArticleCandidate,
    signals: LearnerSignals,
    preferredDifficulty: ClassDifficulty,
  ): Recommendation {
    const matchesGoal = true;
    const matchesDifficulty = true;
    const matchesPrerequisites = true;
    const novelty = this.noveltyScore(article.publishedAt);
    const engagement = article.accessType === ProductAccessType.FREE ? 1 : 0.6;
    const score = this.combine({
      matchesGoal: matchesGoal ? 1 : 0,
      matchesDifficulty: matchesDifficulty ? 1 : 0,
      matchesPrerequisites: matchesPrerequisites ? 1 : 0,
      novelty,
      engagement,
    });

    const reason = `Rekomendasi: artikel ${article.title} cocok untuk level ${preferredDifficulty.toLowerCase()} dengan skor relevansi ${(score * 100).toFixed(0)}%.`;

    return {
      product: { kind: 'article', ...article },
      score,
      reason,
      signals: { matchesGoal, matchesDifficulty, matchesPrerequisites, novelty, engagement },
    };
  }

  private scoreClass(
    cls: ClassCandidate,
    signals: LearnerSignals,
    preferredDifficulty: ClassDifficulty,
  ): Recommendation {
    const matchesGoal = true;
    const matchesDifficulty =
      DIFFICULTY_RANK[cls.difficulty] <= DIFFICULTY_RANK[preferredDifficulty] + 1 &&
      DIFFICULTY_RANK[cls.difficulty] >= DIFFICULTY_RANK[preferredDifficulty] - 1;
    const matchesPrerequisites = true;
    const novelty = this.noveltyScore(cls.publishedAt);
    const engagement = cls.accessType === ProductAccessType.FREE ? 1 : 0.6;
    const score = this.combine({
      matchesGoal: matchesGoal ? 1 : 0,
      matchesDifficulty: matchesDifficulty ? 1 : 0,
      matchesPrerequisites: matchesPrerequisites ? 1 : 0,
      novelty,
      engagement,
    });

    const reason = `Rekomendasi: kelas ${cls.title} untuk ${cls.difficulty.toLowerCase()} (skor relevansi ${(score * 100).toFixed(0)}%).`;

    return {
      product: { kind: 'class', ...cls },
      score,
      reason,
      signals: { matchesGoal, matchesDifficulty, matchesPrerequisites, novelty, engagement },
    };
  }

  private noveltyScore(publishedAt: Date | null): number {
    if (!publishedAt) return 0;
    const days = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (days < 0) return 1;
    return Math.max(0, Math.min(1, 1 - days / 90));
  }

  private combine(input: {
    matchesGoal: number;
    matchesDifficulty: number;
    matchesPrerequisites: number;
    novelty: number;
    engagement: number;
  }): number {
    const goalScore =
      input.matchesGoal * LEARNING_RELEVANCE_WEIGHT +
      input.matchesDifficulty * DIFFICULTY_MATCH_WEIGHT +
      input.matchesPrerequisites * 0.0;
    return Math.max(
      0,
      Math.min(
        1,
        goalScore + input.novelty * NOVELTY_WEIGHT + input.engagement * ENGAGEMENT_WEIGHT,
      ),
    );
  }
}
