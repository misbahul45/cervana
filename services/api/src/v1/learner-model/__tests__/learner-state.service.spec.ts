import { ConceptView } from '../concepts/concept.types';
import { LearnerPolicyService } from '../policy/learner-policy.service';
import { LearnerStateService } from '../learner-state.service';

const concept = (id: string, level: number, sortOrder: number, prerequisiteIds: string[] = []): ConceptView => ({
  id,
  title: `Title ${id}`,
  description: null,
  level,
  sortOrder,
  estimatedMinutes: null,
  prerequisiteIds,
});

const concepts = [concept('a', 1, 1), concept('b', 1, 2, ['a']), concept('c', 2, 1, ['b'])];

const row = (conceptId: string, score: number, evidenceCount: number, confidence = 0.2) => ({
  conceptId,
  score,
  confidence,
  evidenceCount,
  lastEventAt: new Date('2026-10-09T10:00:00Z'),
});

const build = (rows: Array<ReturnType<typeof row>>) => {
  const prisma = {
    conceptMastery: { findMany: jest.fn().mockResolvedValue(rows) },
    userStep: { findFirst: jest.fn(async ({ where }: { where: { id: string; userId: string } }) => (where.id === 'us-1' && where.userId === 'user-1' ? { stepTemplateId: 'step-1' } : where.id === 'us-custom' && where.userId === 'user-1' ? { stepTemplateId: null } : null)) },
    step: { findUnique: jest.fn(async ({ where }: { where: { id: string } }) => (where.id === 'step-1' ? { lessonId: 'lesson-1' } : null)) },
  };
  const registry = {
    listActive: jest.fn().mockResolvedValue(concepts),
    conceptsForLesson: jest.fn(async (lessonId: string) => (lessonId === 'lesson-1' ? { source: 'LESSON', conceptIds: ['a', 'b'] } : { source: 'NONE', conceptIds: [] })),
    topicConceptIds: jest.fn(async (topicId: string) => (topicId === 'topic-1' ? ['a', 'b'] : [])),
  };
  const service = new LearnerStateService(prisma as never, registry as never, new LearnerPolicyService());
  return { service, prisma };
};

describe('LearnerStateService', () => {
  describe('listMastery', () => {
    it("reads only the learner's own rows and returns them in teaching order with concept titles", async () => {
      const { service, prisma } = build([row('c', 0.6, 2), row('a', 0.8, 4)]);

      const list = await service.listMastery('user-1');

      expect(prisma.conceptMastery.findMany).toHaveBeenCalledWith({ where: { userId: 'user-1', concept: { status: 'ACTIVE' } } });
      expect(list.map((entry) => [entry.conceptId, entry.title, entry.level])).toEqual([
        ['a', 'Title a', 1],
        ['c', 'Title c', 2],
      ]);
      expect(list[0]).toMatchObject({ score: 0.8, evidenceCount: 4, confidence: 0.2, lastEventAt: new Date('2026-10-09T10:00:00Z') });
    });

    it('says on the server whether a concept is passed and whether it is mastered', async () => {
      const { service } = build([row('a', 0.95, 3), row('b', 0.8, 3), row('c', 0.97, 2)]);

      const list = await service.listMastery('user-1');

      expect(list.map((entry) => [entry.conceptId, entry.passed, entry.mastered])).toEqual([
        ['a', true, true],
        ['b', true, false],
        ['c', false, false],
      ]);
    });

    it('is empty for a learner without evidence', async () => {
      expect(await build([]).service.listMastery('user-1')).toEqual([]);
    });
  });

  describe('nextConcept', () => {
    it('names the concept, its title and why', async () => {
      const { service } = build([row('a', 0.8, 3)]);

      expect(await service.nextConcept('user-1')).toEqual({
        conceptId: 'b',
        level: 1,
        reasonCodes: ['PREREQUISITES_MET'],
        concept: { id: 'b', title: 'Title b', level: 1 },
      });
    });

    it('starts a new learner at the first concept', async () => {
      const result = await build([]).service.nextConcept('user-1');

      expect(result).toMatchObject({ conceptId: 'a', reasonCodes: ['NO_EVIDENCE_START'] });
    });

    it('has no concept to name once everything is passed', async () => {
      const { service } = build([row('a', 0.8, 3), row('b', 0.8, 3), row('c', 0.8, 3)]);

      expect(await service.nextConcept('user-1')).toEqual({ conceptId: null, level: null, reasonCodes: ['ALL_CONCEPTS_PASSED'], concept: null });
    });
  });

  describe('conceptState', () => {
    it('returns the learner mastery of the concept and the state of its prerequisites', async () => {
      const { service } = build([row('a', 0.8, 4), row('b', 0.5, 2)]);

      const state = await service.conceptState('user-1', 'c');

      expect(state).toMatchObject({
        conceptId: 'c',
        mastery: { score: 0.5, evidenceCount: 0 },
        prerequisiteMasteryMet: false,
      });
      expect(state?.prerequisites).toEqual([{ conceptId: 'b', title: 'Title b', score: 0.5, evidenceCount: 2, passed: false }]);
    });

    it('reports a concept without evidence as even odds with no evidence', async () => {
      const state = await build([]).service.conceptState('user-1', 'a');

      expect(state).toMatchObject({ mastery: { score: 0.5, confidence: 0, evidenceCount: 0, lastEventAt: null }, prerequisiteMasteryMet: true, prerequisites: [] });
    });

    it('says prerequisites are met when every direct prerequisite is passed', async () => {
      const state = await build([row('b', 0.75, 3)]).service.conceptState('user-1', 'c');

      expect(state?.prerequisiteMasteryMet).toBe(true);
    });

    it('is null for an id the registry does not know', async () => {
      expect(await build([]).service.conceptState('user-1', 'free-text')).toBeNull();
    });
  });

  describe('conceptIdsForUserStep', () => {
    it("resolves the learner's own user step to the concepts of its lesson", async () => {
      const { service, prisma } = build([]);

      expect(await service.conceptIdsForUserStep('user-1', 'us-1')).toEqual(['a', 'b']);
      expect(prisma.userStep.findFirst).toHaveBeenCalledWith({ where: { id: 'us-1', userId: 'user-1' }, select: { stepTemplateId: true } });
    });

    it('answers nothing for a user step of another learner, an unknown one, or one without a template step', async () => {
      const { service } = build([]);

      expect(await service.conceptIdsForUserStep('user-2', 'us-1')).toEqual([]);
      expect(await service.conceptIdsForUserStep('user-1', 'ghost')).toEqual([]);
      expect(await service.conceptIdsForUserStep('user-1', 'us-custom')).toEqual([]);
    });

    it('answers nothing when the template step is gone', async () => {
      const { service, prisma } = build([]);
      prisma.step.findUnique.mockResolvedValueOnce(null as never);

      expect(await service.conceptIdsForUserStep('user-1', 'us-1')).toEqual([]);
    });
  });

  describe('conceptStates', () => {
    it('answers several concepts with one read of the learner rows, skipping unknown ids and repeats', async () => {
      const { service, prisma } = build([row('a', 0.8, 4)]);

      const states = await service.conceptStates('user-1', ['c', 'a', 'nope', 'c']);

      expect(prisma.conceptMastery.findMany).toHaveBeenCalledTimes(1);
      expect(states.map((s) => s.conceptId)).toEqual(['c', 'a']);
      expect(states[0].prerequisiteMasteryMet).toBe(false);
      expect(states[1].mastery).toMatchObject({ score: 0.8, evidenceCount: 4 });
    });

    it('is empty for no ids and does not read the database', async () => {
      const { service, prisma } = build([]);

      expect(await service.conceptStates('user-1', [])).toEqual([]);
      expect(prisma.conceptMastery.findMany).not.toHaveBeenCalled();
    });
  });

  describe('topicMastery', () => {
    it("aggregates the learner's own concept rows of the topic and counts a concept without evidence as zero", async () => {
      const { service, prisma } = build([row('a', 0.8, 3), row('c', 0.9, 5)]);

      const aggregate = await service.topicMastery('user-1', 'topic-1');

      expect(prisma.conceptMastery.findMany).toHaveBeenCalledWith({ where: { userId: 'user-1', concept: { status: 'ACTIVE' } } });
      expect(aggregate).toMatchObject({ score: 0.4, passedConcepts: 1, totalConcepts: 2, evidenceCount: 3 });
    });

    it('has no score for a topic without approved concepts', async () => {
      const aggregate = await build([row('a', 0.8, 3)]).service.topicMastery('user-1', 'unknown-topic');

      expect(aggregate).toMatchObject({ score: null, totalConcepts: 0, passedConcepts: 0 });
    });
  });

  describe('averageMastery', () => {
    it('is the mean score of the concepts that have evidence', async () => {
      expect(await build([row('a', 0.8, 3), row('c', 0.4, 1)]).service.averageMastery('user-1')).toBeCloseTo(0.6, 10);
    });

    it('is zero for a learner without evidence', async () => {
      expect(await build([]).service.averageMastery('user-1')).toBe(0);
    });
  });

  describe('skillNodes', () => {
    it('derives a state per active concept from the prerequisite graph and the score, in teaching order', async () => {
      const { service } = build([row('a', 0.95, 3), row('b', 0.4, 1)]);

      const nodes = await service.skillNodes('user-1');

      expect(nodes.map((n) => [n.conceptId, n.state])).toEqual([
        ['a', 'MASTERED'],
        ['b', 'IN_PROGRESS'],
        ['c', 'LOCKED'],
      ]);
      expect(nodes[1]).toMatchObject({ title: 'Title b', level: 1, score: 0.4, evidenceCount: 1 });
      expect(nodes[2]).toMatchObject({ score: 0, evidenceCount: 0 });
    });

    it('opens a concept without evidence once its prerequisites are passed and locks the rest', async () => {
      const { service } = build([row('a', 0.8, 3)]);

      const nodes = await service.skillNodes('user-1');

      expect(nodes.map((n) => [n.conceptId, n.state])).toEqual([
        ['a', 'IN_PROGRESS'],
        ['b', 'AVAILABLE'],
        ['c', 'LOCKED'],
      ]);
    });

    it('starts a new learner with the root concepts available and everything else locked', async () => {
      const nodes = await build([]).service.skillNodes('user-1');

      expect(nodes.map((n) => n.state)).toEqual(['AVAILABLE', 'LOCKED', 'LOCKED']);
    });
  });
});
