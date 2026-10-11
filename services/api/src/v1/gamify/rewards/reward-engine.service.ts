import { Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConceptState } from '@/v1/learner-model/mastery/mastery-v1';
import { DEFAULT_RULE_SET, REWARD_RULES, evaluateAssessment } from './reward-rules';
import { RewardRulesService } from './reward-rules.service';
import { RewardLedgerService } from './reward-ledger.service';

export interface AssessmentRewardEvent {
  userId: string;
  conceptId: string;
  eventId: string;
  duplicate: boolean;
  after: Pick<ConceptState, 'score' | 'evidenceCount'>;
  topicId?: string;
  subTopicId?: string;
}

export interface RewardOutcome {
  points: number;
  entryIds: string[];
}

@Injectable()
export class RewardEngineService {
  constructor(
    private readonly ledger: RewardLedgerService,
    @Optional() private readonly rules?: RewardRulesService,
  ) {}

  async onAssessment(event: AssessmentRewardEvent, tx: Prisma.TransactionClient): Promise<RewardOutcome> {
    if (event.duplicate) return { points: 0, entryIds: [] };

    const paid = await tx.gamificationLedger.aggregate({
      where: { userId: event.userId, conceptId: event.conceptId, ruleId: REWARD_RULES.MASTERY_PROGRESS.id, reversalOf: null },
      _sum: { points: true },
    });

    const rules = this.rules ? await this.rules.current(tx) : DEFAULT_RULE_SET;
    const grants = evaluateAssessment(
      {
        userId: event.userId,
        conceptId: event.conceptId,
        eventId: event.eventId,
        after: event.after,
        alreadyPaidProgress: paid._sum.points ?? 0,
      },
      rules,
    );

    const outcome: RewardOutcome = { points: 0, entryIds: [] };
    for (const grant of grants) {
      const result = await this.ledger.grant(
        { userId: event.userId, ...grant, topicId: event.topicId, subTopicId: event.subTopicId },
        tx,
      );
      if (!result.duplicate) {
        outcome.points += result.entry.points;
        outcome.entryIds.push(result.entry.id);
      }
    }
    return outcome;
  }
}
