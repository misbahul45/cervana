import { Prisma, PrismaClient } from '@prisma/client';
import { DEFAULT_LEVELS } from '../me/level-progress';
import { DEFAULT_REWARD_RULE_ROWS } from '../rewards/reward-rules';
import { DEFAULT_ACHIEVEMENTS } from './default-catalog';

export interface GamifySeedReport {
  rules: number;
  levels: number;
  achievements: number;
}

export class GamifySeeder {
  constructor(private readonly prisma: Pick<PrismaClient, '$transaction'>) {}

  async run(): Promise<GamifySeedReport> {
    await this.prisma.$transaction(async (tx) => {
      await tx.rewardRule.createMany({
        data: DEFAULT_REWARD_RULE_ROWS.map((row) => ({
          code: row.code,
          version: row.version,
          eventType: row.eventType,
          rewardKind: row.rewardKind,
          amount: row.amount,
          dailyCap: row.dailyCap,
          params: (row.params ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          active: true,
        })),
        skipDuplicates: true,
      });

      await tx.levelThreshold.createMany({ data: DEFAULT_LEVELS.map((level) => ({ level: level.level, xp: level.xp })), skipDuplicates: true });

      for (const achievement of DEFAULT_ACHIEVEMENTS) {
        const exists = await tx.achievement.findUnique({ where: { code: achievement.code }, select: { id: true } });
        if (exists) continue;
        await tx.achievement.create({
          data: {
            code: achievement.code,
            title: achievement.title,
            description: achievement.description,
            type: achievement.type,
            iconName: achievement.iconName,
            rule: achievement.rule,
            sortOrder: achievement.sortOrder,
            active: true,
          },
        });
      }
    });

    return { rules: DEFAULT_REWARD_RULE_ROWS.length, levels: DEFAULT_LEVELS.length, achievements: DEFAULT_ACHIEVEMENTS.length };
  }
}
