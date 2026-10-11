import { PASS_EVIDENCE, PASS_SCORE } from '../policy/learner-policy.service';

export const ELIGIBILITY_SCORE = 0.85;
export const MASTERED_SCORE = 0.9;

export interface ConceptProgressLike {
  score: number;
  evidenceCount: number;
}

export interface ConceptEvidence extends ConceptProgressLike {
  lastEventAt: Date | null;
}

export interface TopicAggregate {
  score: number | null;
  passedConcepts: number;
  totalConcepts: number;
  evidenceCount: number;
  lastEventAt: Date | null;
}

export type SkillNodeState = 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'MASTERED';

export const hasPassed = (progress: ConceptProgressLike): boolean =>
  progress.score >= PASS_SCORE && progress.evidenceCount >= PASS_EVIDENCE;

const later = (a: Date | null, b: Date | null): Date | null => (a && b ? (a > b ? a : b) : (a ?? b));

export const aggregateTopic = (conceptIds: readonly string[], byConcept: ReadonlyMap<string, ConceptEvidence>): TopicAggregate => {
  const ids = [...new Set(conceptIds)];
  if (ids.length === 0) return { score: null, passedConcepts: 0, totalConcepts: 0, evidenceCount: 0, lastEventAt: null };

  let total = 0;
  let passed = 0;
  let evidenceCount = 0;
  let lastEventAt: Date | null = null;
  for (const id of ids) {
    const own = byConcept.get(id);
    if (!own) continue;
    total += own.score;
    evidenceCount += own.evidenceCount;
    lastEventAt = later(lastEventAt, own.lastEventAt);
    if (hasPassed(own)) passed += 1;
  }
  return { score: total / ids.length, passedConcepts: passed, totalConcepts: ids.length, evidenceCount, lastEventAt };
};

export const isCreatorEligible = (aggregate: TopicAggregate): boolean =>
  aggregate.score !== null &&
  aggregate.totalConcepts > 0 &&
  aggregate.passedConcepts === aggregate.totalConcepts &&
  aggregate.score >= ELIGIBILITY_SCORE;

export const skillNodeState = (input: { prerequisitesPassed: boolean; own: ConceptProgressLike | null }): SkillNodeState => {
  if (!input.prerequisitesPassed) return 'LOCKED';
  if (!input.own || input.own.evidenceCount === 0) return 'AVAILABLE';
  return hasPassed(input.own) && input.own.score >= MASTERED_SCORE ? 'MASTERED' : 'IN_PROGRESS';
};
