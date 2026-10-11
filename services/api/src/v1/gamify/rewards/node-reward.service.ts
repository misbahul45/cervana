import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConceptRegistryService } from '@/v1/learner-model/concepts/concept-registry.service';
import { hasPassed } from '@/v1/learner-model/mastery/topic-aggregate';
import { RewardLedgerService } from './reward-ledger.service';
import { nodeMasteredGrant } from './reward-rules';
import { RewardRulesService } from './reward-rules.service';

export interface NodeAssessmentEvent {
  userId: string;
  subTopicId: string | null | undefined;
}

@Injectable()
export class NodeRewardService {
  constructor(
    private readonly registry: ConceptRegistryService,
    private readonly ledger: RewardLedgerService,
    private readonly rules: RewardRulesService,
  ) {}

  async onAssessment(event: NodeAssessmentEvent, tx: Prisma.TransactionClient): Promise<{ stars: number }> {
    if (!event.subTopicId) return { stars: 0 };

    const grant = nodeMasteredGrant(event.userId, event.subTopicId, await this.rules.current(tx));
    if (!grant) return { stars: 0 };

    const conceptIds = await this.registry.subTopicConceptIds(event.subTopicId);
    if (conceptIds.length === 0) return { stars: 0 };

    const rows = await tx.conceptMastery.findMany({ where: { userId: event.userId, conceptId: { in: conceptIds } } });
    const byConcept = new Map(rows.map((row) => [row.conceptId, row]));
    const allPassed = conceptIds.every((id) => {
      const own = byConcept.get(id);
      return own !== undefined && hasPassed(own);
    });
    if (!allPassed) return { stars: 0 };

    const result = await this.ledger.grant({ userId: event.userId, ...grant }, tx);
    return { stars: result.duplicate ? 0 : result.entry.points };
  }
}
