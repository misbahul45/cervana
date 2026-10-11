import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AchievementMetric, AchievementRule, parseAchievementRule, ruleSatisfied } from './achievement-rule';

export const ACHIEVEMENT_METRIC_SOURCE = Symbol('ACHIEVEMENT_METRIC_SOURCE');

export interface MetricSource {
  values(userId: string, metrics: ReadonlySet<AchievementMetric>, tx: Prisma.TransactionClient): Promise<Partial<Record<AchievementMetric, number>>>;
}

export interface UnlockedAchievement {
  code: string;
  title: string;
  iconName: string | null;
}

export interface AchievementProgress {
  code: string;
  title: string;
  description: string | null;
  iconName: string | null;
  unlocked: boolean;
  unlockedAt: Date | null;
  progress: { value: number; target: number };
}

interface CatalogEntry {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  iconName: string | null;
  rule: AchievementRule;
}

@Injectable()
export class AchievementEvaluator {
  constructor(@Inject(ACHIEVEMENT_METRIC_SOURCE) private readonly source: MetricSource) {}

  async evaluate(userId: string, tx: Prisma.TransactionClient): Promise<UnlockedAchievement[]> {
    const [catalog, owned] = await Promise.all([this.catalog(tx), this.owned(userId, tx)]);
    const pending = catalog.filter((entry) => !owned.has(entry.id));
    if (pending.length === 0) return [];

    const values = await this.source.values(userId, new Set(pending.map((entry) => entry.rule.metric)), tx);
    const unlocked: UnlockedAchievement[] = [];
    for (const entry of pending) {
      if (!ruleSatisfied(entry.rule, values[entry.rule.metric] ?? 0)) continue;
      const created = await tx.userAchievement.createMany({ data: [{ userId, achievementId: entry.id }], skipDuplicates: true });
      if (created.count > 0) unlocked.push({ code: entry.code ?? entry.id, title: entry.title, iconName: entry.iconName });
    }
    return unlocked;
  }

  async progressFor(userId: string, tx: Prisma.TransactionClient): Promise<AchievementProgress[]> {
    const [catalog, owned] = await Promise.all([this.catalog(tx), this.owned(userId, tx)]);
    if (catalog.length === 0) return [];

    const values = await this.source.values(userId, new Set(catalog.map((entry) => entry.rule.metric)), tx);
    return catalog.map((entry) => {
      const value = values[entry.rule.metric] ?? 0;
      const persisted = owned.get(entry.id);
      return {
        code: entry.code ?? entry.id,
        title: entry.title,
        description: entry.description,
        iconName: entry.iconName,
        unlocked: persisted !== undefined || ruleSatisfied(entry.rule, value),
        unlockedAt: persisted ?? null,
        progress: { value: Math.min(value, entry.rule.value), target: entry.rule.value },
      };
    });
  }

  private async catalog(tx: Prisma.TransactionClient): Promise<CatalogEntry[]> {
    const rows = await tx.achievement.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    return rows.flatMap((row) => {
      const rule = parseAchievementRule(row.rule);
      return rule ? [{ id: row.id, code: row.code, title: row.title, description: row.description, iconName: row.iconName, rule }] : [];
    });
  }

  private async owned(userId: string, tx: Prisma.TransactionClient): Promise<Map<string, Date>> {
    const rows = await tx.userAchievement.findMany({ where: { userId }, select: { achievementId: true, awardedAt: true } });
    return new Map(rows.map((row) => [row.achievementId, row.awardedAt]));
  }
}
