import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RewardRuleSet, buildRuleSet } from './reward-rules';

@Injectable()
export class RewardRulesService {
  async current(tx: Prisma.TransactionClient): Promise<RewardRuleSet> {
    const rows = await tx.rewardRule.findMany();
    return buildRuleSet(
      rows.map((row) => ({
        code: row.code,
        version: row.version,
        eventType: row.eventType,
        rewardKind: row.rewardKind,
        amount: row.amount,
        dailyCap: row.dailyCap,
        params: row.params,
        active: row.active,
      })),
    );
  }
}
