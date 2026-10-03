import { Injectable, Inject, Optional } from '@nestjs/common';
import { SkillNodeRepo } from './skill-node.repo';
import { MasteryRepo } from '../mastery/mastery.repo';

const PREREQ_THRESHOLD = 0.7;
const MASTERY_THRESHOLD = 0.9;

export type SkillNodeState = 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'MASTERED';

export interface GoldenGraphLite {
  levels: Array<{
    id: number;
    topics: Array<{ id: string; prerequisites: string[] }>;
  }>;
}

@Injectable()
export class SkillNodeService {
  constructor(
    private readonly repo: SkillNodeRepo,
    @Optional() private readonly masteryRepo?: MasteryRepo,
    @Optional() @Inject('GOLDEN_GRAPH') private readonly goldenGraph?: GoldenGraphLite,
  ) {}

  computeState(input: {
    mastery: number;
    prereqMastery: number[];
  }): SkillNodeState {
    const allPrereqsMet = input.prereqMastery.every((m) => m >= PREREQ_THRESHOLD);
    if (input.prereqMastery.length > 0 && !allPrereqsMet) return 'LOCKED';
    if (input.mastery === 0) return 'AVAILABLE';
    if (input.mastery < MASTERY_THRESHOLD) return 'IN_PROGRESS';
    return 'MASTERED';
  }

  async upsertForUserTopic(
    userId: string,
    topicId: string,
    mastery: number,
    prereqMastery?: number[],
  ) {
    let resolvedPrereqs = prereqMastery;
    if (!resolvedPrereqs && this.masteryRepo && this.goldenGraph) {
      const prereqIds = this.findPrerequisiteIds(topicId);
      if (prereqIds.length > 0) {
        const masteryRows = await this.masteryRepo.listByUser(userId);
        const masteryMap = new Map(masteryRows.map((m) => [m.topicId, m.score]));
        resolvedPrereqs = prereqIds.map((id) => masteryMap.get(id) ?? 0);
      } else {
        resolvedPrereqs = [];
      }
    }
    const state = this.computeState({ mastery, prereqMastery: resolvedPrereqs ?? [] });
    return this.repo.upsert({ userId, topicId, state, progress: mastery });
  }

  private findPrerequisiteIds(topicId: string): string[] {
    if (!this.goldenGraph) return [];
    for (const level of this.goldenGraph.levels) {
      const topic = level.topics.find((t) => t.id === topicId);
      if (topic) return topic.prerequisites ?? [];
    }
    return [];
  }
}