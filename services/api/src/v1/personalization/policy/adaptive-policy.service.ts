import { Injectable } from '@nestjs/common';
import { MasteryRepo } from '../mastery/mastery.repo';
import { MisconceptionRepo } from '../misconception/misconception.repo';
import { AdaptivePolicyRepo } from './adaptive-policy.repo';

const MASTERY_THRESHOLD = 0.7;
const REMEDIATION_THRESHOLD = 0.5;

export type RationaleKind = 'no_exploration' | 'remediation' | 'progression';

export interface GoldenGraph {
  levels: Array<{
    id: number;
    title: string;
    topics: Array<{ id: string; title: string; prerequisites: string[] }>;
  }>;
}

export interface PolicyDecision {
  topicId: string;
  level: number;
  rationaleKind: RationaleKind;
  rationale: Record<string, unknown>;
}

@Injectable()
export class AdaptivePolicyService {
  constructor(
    private readonly masteryRepo: MasteryRepo,
    private readonly misconceptionRepo: MisconceptionRepo,
    private readonly policyRepo: AdaptivePolicyRepo,
    private readonly goldenGraph: GoldenGraph,
  ) {}

  async decideNext(userId: string): Promise<PolicyDecision> {
    const mastery = await this.masteryRepo.listByUser(userId);
    const misconceptions = await this.misconceptionRepo.listActiveByUser(userId);
    const masteryMap = new Map(mastery.map((m: any) => [m.topicId, m.score] as const));

    if (mastery.length === 0) {
      const firstTopic = this.goldenGraph.levels[0]?.topics[0];
      const decision: PolicyDecision = {
        topicId: firstTopic?.id ?? 'l1-t01-accounting-equation',
        level: 1,
        rationaleKind: 'no_exploration',
        rationale: { reason: 'no_mastery_recorded' },
      };
      return decision;
    }

    const active = misconceptions.find(
      (mc: any) => (masteryMap.get(mc.topicId ?? mc.conceptKey) ?? 0) < REMEDIATION_THRESHOLD,
    );
    if (active) {
      const topicId = (active as any).topicId ?? (active as any).conceptKey;
      const decision: PolicyDecision = {
        topicId,
        level: this.levelOf(topicId),
        rationaleKind: 'remediation',
        rationale: {
          patternCode: (active as any).conceptKey,
          topicId,
        },
      };
      return decision;
    }

    for (const level of this.goldenGraph.levels) {
      for (const topic of level.topics) {
        const met = topic.prerequisites.every((p) => (masteryMap.get(p) ?? 0) >= MASTERY_THRESHOLD);
        const passed = (masteryMap.get(topic.id) ?? 0) >= MASTERY_THRESHOLD;
        if (met && !passed) {
          return {
            topicId: topic.id,
            level: level.id,
            rationaleKind: 'progression',
            rationale: { prerequisitesMet: topic.prerequisites },
          };
        }
      }
    }

    return {
      topicId: this.goldenGraph.levels[0].topics[0].id,
      level: 1,
      rationaleKind: 'no_exploration',
      rationale: { reason: 'all_topics_mastered' },
    };
  }

  async recordDecision(userId: string, decision: PolicyDecision) {
    return this.policyRepo.upsert({
      userId,
      topicId: decision.topicId,
      nextActivityId: null,
      rationale: { level: decision.level, kind: decision.rationaleKind, ...decision.rationale },
    });
  }

  async listByUser(userId: string) {
    return this.policyRepo.listByUser(userId);
  }

  private levelOf(topicId: string): number {
    for (const level of this.goldenGraph.levels) {
      if (level.topics.some((t) => t.id === topicId)) return level.id;
    }
    return 1;
  }
}