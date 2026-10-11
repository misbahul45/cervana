import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { buildConceptGraph } from './concepts/concept-graph';
import { ConceptRegistryService } from './concepts/concept-registry.service';
import { ConceptView } from './concepts/concept.types';
import { LearnerPolicyService } from './policy/learner-policy.service';
import { NextConceptDecision } from './policy/policy.types';
import { MASTERED_SCORE, SkillNodeState, TopicAggregate, aggregateTopic, hasPassed, skillNodeState } from './mastery/topic-aggregate';

interface MasteryRow {
  conceptId: string;
  score: number;
  confidence: number;
  evidenceCount: number;
  lastEventAt: Date;
}

export interface MasteryEntry {
  conceptId: string;
  title: string;
  level: number;
  score: number;
  confidence: number;
  evidenceCount: number;
  lastEventAt: Date | null;
  passed: boolean;
  mastered: boolean;
}

export interface PrerequisiteState {
  conceptId: string;
  title: string;
  score: number;
  evidenceCount: number;
  passed: boolean;
}

export interface ConceptStateView {
  conceptId: string;
  title: string;
  level: number;
  mastery: Pick<MasteryEntry, 'score' | 'confidence' | 'evidenceCount' | 'lastEventAt'>;
  prerequisites: PrerequisiteState[];
  prerequisiteMasteryMet: boolean;
}

export interface SkillNodeView {
  conceptId: string;
  title: string;
  level: number;
  state: SkillNodeState;
  score: number;
  evidenceCount: number;
}

export interface NextConceptView extends NextConceptDecision {
  concept: { id: string; title: string; level: number } | null;
}

const NO_EVIDENCE = { score: 0.5, confidence: 0, evidenceCount: 0, lastEventAt: null } as const;

@Injectable()
export class LearnerStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ConceptRegistryService,
    private readonly policy: LearnerPolicyService,
  ) {}

  async listMastery(userId: string): Promise<MasteryEntry[]> {
    const [rows, concepts] = await Promise.all([this.rowsOf(userId), this.registry.listActive()]);
    const byId = new Map(concepts.map((c) => [c.id, c]));
    const order = new Map(concepts.map((c, index) => [c.id, index]));

    return rows
      .filter((row) => byId.has(row.conceptId))
      .sort((a, b) => (order.get(a.conceptId) ?? 0) - (order.get(b.conceptId) ?? 0))
      .map((row) => {
        const concept = byId.get(row.conceptId) as ConceptView;
        return {
          conceptId: row.conceptId,
          title: concept.title,
          level: concept.level,
          score: row.score,
          confidence: row.confidence,
          evidenceCount: row.evidenceCount,
          lastEventAt: row.lastEventAt,
          passed: hasPassed(row),
          mastered: hasPassed(row) && row.score >= MASTERED_SCORE,
        };
      });
  }

  async topicMastery(userId: string, topicId: string): Promise<TopicAggregate> {
    const [rows, conceptIds] = await Promise.all([this.rowsOf(userId), this.registry.topicConceptIds(topicId)]);
    return aggregateTopic(conceptIds, new Map(rows.map((row) => [row.conceptId, row])));
  }

  async averageMastery(userId: string): Promise<number> {
    const rows = (await this.rowsOf(userId)).filter((row) => row.evidenceCount > 0);
    return rows.length === 0 ? 0 : rows.reduce((sum, row) => sum + row.score, 0) / rows.length;
  }

  async skillNodes(userId: string): Promise<SkillNodeView[]> {
    const [rows, concepts] = await Promise.all([this.rowsOf(userId), this.registry.listActive()]);
    const byConcept = new Map(rows.map((row) => [row.conceptId, row]));
    const active = new Set(concepts.map((c) => c.id));

    return concepts.map((concept) => {
      const own = byConcept.get(concept.id) ?? null;
      const prerequisitesPassed = concept.prerequisiteIds
        .filter((id) => active.has(id))
        .every((id) => {
          const prerequisite = byConcept.get(id);
          return prerequisite !== undefined && hasPassed(prerequisite);
        });
      return {
        conceptId: concept.id,
        title: concept.title,
        level: concept.level,
        state: skillNodeState({ prerequisitesPassed, own }),
        score: own?.score ?? 0,
        evidenceCount: own?.evidenceCount ?? 0,
      };
    });
  }

  async nextConcept(userId: string): Promise<NextConceptView> {
    const [rows, concepts] = await Promise.all([this.rowsOf(userId), this.registry.listActive()]);
    const decision = this.policy.nextConcept({
      graph: buildConceptGraph(concepts),
      progress: new Map(rows.map((row) => [row.conceptId, { score: row.score, evidenceCount: row.evidenceCount }])),
    });
    const chosen = concepts.find((c) => c.id === decision.conceptId);
    return { ...decision, concept: chosen ? { id: chosen.id, title: chosen.title, level: chosen.level } : null };
  }

  async conceptIdsForUserStep(userId: string, userStepId: string): Promise<string[]> {
    const userStep = await this.prisma.userStep.findFirst({ where: { id: userStepId, userId }, select: { stepTemplateId: true } });
    if (!userStep?.stepTemplateId) return [];
    const step = await this.prisma.step.findUnique({ where: { id: userStep.stepTemplateId }, select: { lessonId: true } });
    if (!step) return [];
    return (await this.registry.conceptsForLesson(step.lessonId)).conceptIds;
  }

  async conceptState(userId: string, conceptId: string): Promise<ConceptStateView | null> {
    return (await this.conceptStates(userId, [conceptId]))[0] ?? null;
  }

  async conceptStates(userId: string, conceptIds: string[]): Promise<ConceptStateView[]> {
    const wanted = [...new Set(conceptIds)];
    if (wanted.length === 0) return [];

    const [rows, concepts] = await Promise.all([this.rowsOf(userId), this.registry.listActive()]);
    const byConcept = new Map(rows.map((row) => [row.conceptId, row]));
    const known = new Map(concepts.map((c) => [c.id, c]));

    return wanted.flatMap((conceptId) => {
      const concept = known.get(conceptId);
      if (!concept) return [];
      const own = byConcept.get(conceptId);

      const prerequisites = concept.prerequisiteIds
        .filter((id) => known.has(id))
        .map((id) => {
          const progress = { score: byConcept.get(id)?.score ?? NO_EVIDENCE.score, evidenceCount: byConcept.get(id)?.evidenceCount ?? 0 };
          return { conceptId: id, title: (known.get(id) as ConceptView).title, ...progress, passed: hasPassed(progress) };
        });

      return [
        {
          conceptId,
          title: concept.title,
          level: concept.level,
          mastery: own
            ? { score: own.score, confidence: own.confidence, evidenceCount: own.evidenceCount, lastEventAt: own.lastEventAt }
            : { ...NO_EVIDENCE },
          prerequisites,
          prerequisiteMasteryMet: prerequisites.every((p) => p.passed),
        },
      ];
    });
  }

  private rowsOf(userId: string): Promise<MasteryRow[]> {
    return this.prisma.conceptMastery.findMany({ where: { userId, concept: { status: 'ACTIVE' } } });
  }
}
