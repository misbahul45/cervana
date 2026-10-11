import { buildConceptGraph } from '../../concepts/concept-graph';
import { ConceptView } from '../../concepts/concept.types';
import { LearnerPolicyService } from '../learner-policy.service';
import { ConceptProgress } from '../policy.types';

const concept = (id: string, level: number, sortOrder: number, prerequisiteIds: string[] = []): ConceptView => ({
  id,
  title: id,
  description: null,
  level,
  sortOrder,
  estimatedMinutes: null,
  prerequisiteIds,
});

const graph = buildConceptGraph([
  concept('a', 1, 1),
  concept('b', 1, 2, ['a']),
  concept('c', 1, 3, ['a']),
  concept('d', 2, 1, ['b', 'c']),
]);

const progress = (entries: Record<string, [number, number]>): Map<string, ConceptProgress> =>
  new Map(Object.entries(entries).map(([id, [score, evidenceCount]]) => [id, { score, evidenceCount }]));

describe('LearnerPolicyService.nextConcept', () => {
  const service = new LearnerPolicyService();

  it('starts a learner without any evidence at the first concept', () => {
    expect(service.nextConcept({ graph, progress: progress({}) })).toEqual({
      conceptId: 'a',
      level: 1,
      reasonCodes: ['NO_EVIDENCE_START'],
    });
  });

  it('answers null for an empty graph', () => {
    expect(service.nextConcept({ graph: buildConceptGraph([]), progress: progress({}) })).toEqual({
      conceptId: null,
      level: null,
      reasonCodes: ['NO_CONCEPTS'],
    });
  });

  it('moves to the next concept whose prerequisites are all passed', () => {
    const decision = service.nextConcept({ graph, progress: progress({ a: [0.75, 3] }) });

    expect(decision).toEqual({ conceptId: 'b', level: 1, reasonCodes: ['PREREQUISITES_MET'] });
  });

  it('does not count a high score on fewer than three events as passed', () => {
    const decision = service.nextConcept({ graph, progress: progress({ a: [0.9, 2] }) });

    expect(decision).toEqual({ conceptId: 'a', level: 1, reasonCodes: ['CONTINUE_PRACTICE'] });
  });

  it('does not count a score just under 0.7 as passed, and counts 0.7 itself', () => {
    expect(service.nextConcept({ graph, progress: progress({ a: [0.69, 5] }) }).conceptId).toBe('a');
    expect(service.nextConcept({ graph, progress: progress({ a: [0.7, 3] }) }).conceptId).toBe('b');
  });

  it('returns to a passed concept whose score has fallen back, before moving on', () => {
    const decision = service.nextConcept({ graph, progress: progress({ a: [0.55, 6], b: [0.8, 4] }) });

    expect(decision).toEqual({ conceptId: 'a', level: 1, reasonCodes: ['CONTINUE_PRACTICE'] });
  });

  it('skips a passed concept and picks the next one whose prerequisites are passed', () => {
    const decision = service.nextConcept({ graph, progress: progress({ a: [0.8, 3], b: [0.8, 3] }) });

    expect(decision.conceptId).toBe('c');
  });

  it('opens the next level once the previous ones are passed', () => {
    const decision = service.nextConcept({ graph, progress: progress({ a: [0.8, 3], b: [0.8, 3], c: [0.8, 3] }) });

    expect(decision).toEqual({ conceptId: 'd', level: 2, reasonCodes: ['PREREQUISITES_MET'] });
  });

  it('says every concept is passed when they are', () => {
    const all = progress({ a: [0.8, 3], b: [0.8, 3], c: [0.8, 3], d: [0.8, 3] });

    expect(service.nextConcept({ graph, progress: all })).toEqual({ conceptId: null, level: null, reasonCodes: ['ALL_CONCEPTS_PASSED'] });
  });

  it('ignores progress on a concept that is not in the graph', () => {
    const decision = service.nextConcept({ graph, progress: progress({ retired: [0.9, 9] }) });

    expect(decision.reasonCodes).toEqual(['NO_EVIDENCE_START']);
    expect(decision.conceptId).toBe('a');
  });

  it('falls back to the first unfinished concept when no prerequisite chain can start, and says so', () => {
    const cyclic = buildConceptGraph([concept('p', 1, 1, ['q']), concept('q', 1, 2, ['p'])]);

    expect(service.nextConcept({ graph: cyclic, progress: progress({}) })).toEqual({
      conceptId: 'p',
      level: 1,
      reasonCodes: ['NO_EVIDENCE_START'],
    });
    expect(service.nextConcept({ graph: cyclic, progress: progress({ q: [0.2, 1] }) })).toEqual({
      conceptId: 'p',
      level: 1,
      reasonCodes: ['UNREACHABLE_PREREQUISITES'],
    });
  });

  it('gives a different answer as the learner progresses, which the id-mismatched policy never did', () => {
    const first = service.nextConcept({ graph, progress: progress({}) }).conceptId;
    const second = service.nextConcept({ graph, progress: progress({ a: [0.8, 3] }) }).conceptId;

    expect(first).not.toBe(second);
  });
});
