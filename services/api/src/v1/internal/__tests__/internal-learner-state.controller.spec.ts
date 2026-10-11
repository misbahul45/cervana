import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { InternalLearnerStateController } from '../internal-learner-state.controller';
import { LearnerStateService } from '../../learner-model/learner-state.service';
import { ConceptRegistryService } from '../../learner-model/concepts/concept-registry.service';
import { InternalServiceGuard } from '@/common/authz/internal-service.guard';
import { ActingUserGuard } from '@/common/authz/acting-user.guard';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { createHttpApp } from '@/test-utils/http-harness';
import { internalAuthProviders, signInternalRequest } from '@/test-utils/internal-signing';

describe('InternalLearnerStateController', () => {
  let app: INestApplication;
  let state: { conceptStates: jest.Mock; nextConcept: jest.Mock; conceptIdsForUserStep: jest.Mock };
  let registry: { listActive: jest.Mock; approvedAliases: jest.Mock; conceptsForLesson: jest.Mock };

  const users: Record<string, { id: string; role: string; isActive: boolean }> = {
    'student-a': { id: 'student-a', role: 'STUDENT', isActive: true },
    'student-b': { id: 'student-b', role: 'STUDENT', isActive: true },
    'admin-a': { id: 'admin-a', role: 'ADMIN', isActive: true },
  };

  const get = (target: string, actingUser?: string) =>
    request(app.getHttpServer())
      .get(target)
      .set(signInternalRequest({ method: 'GET', target, actingUser }));

  beforeEach(async () => {
    const view = (conceptId: string, userId: string) => ({
      conceptId,
      title: conceptId.toUpperCase(),
      level: 1,
      mastery: { score: 0.62, confidence: 0.05, evidenceCount: 1, lastEventAt: null },
      prerequisites: [],
      prerequisiteMasteryMet: true,
      owner: userId,
    });
    state = {
      conceptStates: jest.fn(async (userId: string, ids: string[]) => ids.filter((id) => id !== 'nope').map((id) => view(id, userId))),
      nextConcept: jest.fn(async () => ({ conceptId: 'c2', level: 1, reasonCodes: ['PREREQUISITES_MET'], concept: { id: 'c2', title: 'C2', level: 1 } })),
      conceptIdsForUserStep: jest.fn(async (userId: string, userStepId: string) => (userStepId === 'us-1' && userId === 'student-a' ? ['c5'] : [])),
    };
    registry = {
      listActive: jest.fn().mockResolvedValue([{ id: 'c1', title: 'C1', description: null, level: 1, sortOrder: 1, estimatedMinutes: null, prerequisiteIds: [] }]),
      approvedAliases: jest.fn().mockResolvedValue({ journal_entry: ['c1'] }),
      conceptsForLesson: jest.fn(async (lessonId: string) =>
        lessonId === 'lesson-1' ? { source: 'LESSON', conceptIds: ['c3', 'c4'] } : { source: 'NONE', conceptIds: [] },
      ),
    };

    app = await createHttpApp({
      controllers: [InternalLearnerStateController],
      rawBody: true,
      providers: [
        InternalServiceGuard,
        ActingUserGuard,
        { provide: PrismaService, useValue: { user: { findUnique: jest.fn(async ({ where }) => users[where.id] ?? null) } } },
        { provide: LearnerStateService, useValue: state },
        { provide: ConceptRegistryService, useValue: registry },
        ...internalAuthProviders(),
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /internal/concepts', () => {
    it('serves the registry and the approved python aliases to a signed service', async () => {
      const response = await get('/internal/concepts').expect(200);

      expect(registry.approvedAliases).toHaveBeenCalledWith('PYTHON_DOMAIN');
      expect(response.body.data).toEqual({
        concepts: [{ id: 'c1', title: 'C1', description: null, level: 1, sortOrder: 1, estimatedMinutes: null, prerequisiteIds: [] }],
        aliases: { PYTHON_DOMAIN: { journal_entry: ['c1'] } },
      });
    });

    it('rejects a request without a service signature', async () => {
      await request(app.getHttpServer()).get('/internal/concepts').expect(401);
    });
  });

  describe('GET /internal/learner-state', () => {
    it('answers for the acting user only, with the named concept and the next concept', async () => {
      const response = await get('/internal/learner-state?conceptId=c1', 'student-a').expect(200);

      expect(state.conceptStates).toHaveBeenCalledWith('student-a', ['c1']);
      expect(state.nextConcept).toHaveBeenCalledWith('student-a');
      expect(response.body.data).toMatchObject({
        userId: 'student-a',
        concepts: [{ conceptId: 'c1', mastery: { score: 0.62 } }],
        next: { conceptId: 'c2', reasonCodes: ['PREREQUISITES_MET'] },
      });
    });

    it('resolves a lesson to its approved concepts through the registry', async () => {
      const response = await get('/internal/learner-state?lessonId=lesson-1', 'student-a').expect(200);

      expect(registry.conceptsForLesson).toHaveBeenCalledWith('lesson-1');
      expect(state.conceptStates).toHaveBeenCalledWith('student-a', ['c3', 'c4']);
      expect(response.body.data.concepts.map((c: { conceptId: string }) => c.conceptId)).toEqual(['c3', 'c4']);
    });

    it('merges a named concept and the lesson concepts without repeats', async () => {
      await get('/internal/learner-state?conceptId=c3&lessonId=lesson-1', 'student-a').expect(200);

      expect(state.conceptStates).toHaveBeenCalledWith('student-a', ['c3', 'c4']);
    });

    it('returns no concepts for an unknown lesson or concept, and still the next concept', async () => {
      const lesson = await get('/internal/learner-state?lessonId=ghost', 'student-a').expect(200);
      const concept = await get('/internal/learner-state?conceptId=nope', 'student-a').expect(200);

      expect(lesson.body.data).toMatchObject({ concepts: [], next: { conceptId: 'c2' } });
      expect(concept.body.data.concepts).toEqual([]);
    });

    it('resolves a user step of the acting user to its concepts', async () => {
      const response = await get('/internal/learner-state?userStepId=us-1', 'student-a').expect(200);

      expect(state.conceptIdsForUserStep).toHaveBeenCalledWith('student-a', 'us-1');
      expect(state.conceptStates).toHaveBeenCalledWith('student-a', ['c5']);
      expect(response.body.data.concepts.map((c: { conceptId: string }) => c.conceptId)).toEqual(['c5']);
    });

    it('never resolves the user step of another learner', async () => {
      const response = await get('/internal/learner-state?userStepId=us-1', 'student-b').expect(200);

      expect(state.conceptIdsForUserStep).toHaveBeenCalledWith('student-b', 'us-1');
      expect(state.conceptStates).not.toHaveBeenCalled();
      expect(response.body.data.concepts).toEqual([]);
    });

    it('merges the lesson, the user step and the named concept without repeats', async () => {
      await get('/internal/learner-state?lessonId=lesson-1&userStepId=us-1&conceptId=c3', 'student-a').expect(200);

      expect(state.conceptStates).toHaveBeenCalledWith('student-a', ['c3', 'c3', 'c4', 'c5'].filter((id, i, all) => all.indexOf(id) === i));
    });

    it('does not read any concept when none is asked for', async () => {
      const response = await get('/internal/learner-state', 'student-b').expect(200);

      expect(state.conceptStates).not.toHaveBeenCalled();
      expect(response.body.data).toMatchObject({ userId: 'student-b', concepts: [] });
    });

    it('ignores a userId in the query and still answers for the acting user', async () => {
      await get('/internal/learner-state?userId=student-b', 'student-a').expect(200);

      expect(state.nextConcept).toHaveBeenCalledWith('student-a');
      expect(state.nextConcept).not.toHaveBeenCalledWith('student-b');
    });

    it('rejects a missing acting user, an unknown one and an invalid signature', async () => {
      await get('/internal/learner-state').expect(400);
      await get('/internal/learner-state', 'ghost').expect(403);
      await request(app.getHttpServer()).get('/internal/learner-state').set({ 'x-acting-user-id': 'student-a' }).expect(401);

      expect(state.nextConcept).not.toHaveBeenCalled();
    });
  });
});
