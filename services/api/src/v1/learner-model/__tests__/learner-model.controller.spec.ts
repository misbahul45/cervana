import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { LearnerModelController } from '../learner-model.controller';
import { LearnerStateService } from '../learner-state.service';
import { ADMIN_A, STUDENT_A, STUDENT_B, TEACHER_A, asUser, createHttpApp } from '@/test-utils/http-harness';

describe('LearnerModelController', () => {
  let app: INestApplication;
  let state: { listMastery: jest.Mock; nextConcept: jest.Mock; skillNodes: jest.Mock };

  beforeEach(async () => {
    state = {
      listMastery: jest.fn(async (userId: string) => [{ conceptId: 'c1', title: 'C1', level: 1, score: 0.62, confidence: 0.05, evidenceCount: 1, lastEventAt: null, owner: userId }]),
      nextConcept: jest.fn(async () => ({ conceptId: 'c2', level: 1, reasonCodes: ['PREREQUISITES_MET'], concept: { id: 'c2', title: 'C2', level: 1 } })),
      skillNodes: jest.fn(async () => [{ conceptId: 'c1', title: 'C1', level: 1, state: 'AVAILABLE', score: 0, evidenceCount: 0 }]),
    };
    app = await createHttpApp({
      controllers: [LearnerModelController],
      providers: [{ provide: LearnerStateService, useValue: state }],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /learner-model/me/mastery', () => {
    it('requires authentication', async () => {
      await request(app.getHttpServer()).get('/learner-model/me/mastery').expect(401);
    });

    it('returns the caller own mastery and never reads another learner', async () => {
      const res = await request(app.getHttpServer()).get('/learner-model/me/mastery').set(asUser(STUDENT_A)).expect(200);

      expect(state.listMastery).toHaveBeenCalledWith(STUDENT_A.id);
      expect(res.body.data ?? res.body).toBeDefined();
      expect(JSON.stringify(res.body)).toContain('c1');
    });

    it('ignores a userId in the query', async () => {
      await request(app.getHttpServer()).get(`/learner-model/me/mastery?userId=${STUDENT_B.id}`).set(asUser(STUDENT_A)).expect(200);

      expect(state.listMastery).toHaveBeenCalledWith(STUDENT_A.id);
      expect(state.listMastery).not.toHaveBeenCalledWith(STUDENT_B.id);
    });

    it('is open to teachers and admins as learners of their own', async () => {
      await request(app.getHttpServer()).get('/learner-model/me/mastery').set(asUser(TEACHER_A)).expect(200);
      await request(app.getHttpServer()).get('/learner-model/me/mastery').set(asUser(ADMIN_A)).expect(200);

      expect(state.listMastery).toHaveBeenCalledWith(TEACHER_A.id);
      expect(state.listMastery).toHaveBeenCalledWith(ADMIN_A.id);
    });
  });

  describe('GET /learner-model/me/next', () => {
    it('requires authentication', async () => {
      await request(app.getHttpServer()).get('/learner-model/me/next').expect(401);
    });

    it('returns the next concept with its reason codes for the caller', async () => {
      const res = await request(app.getHttpServer()).get('/learner-model/me/next').set(asUser(STUDENT_B)).expect(200);

      expect(state.nextConcept).toHaveBeenCalledWith(STUDENT_B.id);
      expect(JSON.stringify(res.body)).toContain('PREREQUISITES_MET');
    });
  });

  describe('GET /learner-model/me/skill-nodes', () => {
    it('requires authentication', async () => {
      await request(app.getHttpServer()).get('/learner-model/me/skill-nodes').expect(401);
    });

    it('returns the derived node states of the caller and ignores a userId in the query', async () => {
      const res = await request(app.getHttpServer())
        .get(`/learner-model/me/skill-nodes?userId=${STUDENT_B.id}`)
        .set(asUser(STUDENT_A))
        .expect(200);

      expect(state.skillNodes).toHaveBeenCalledWith(STUDENT_A.id);
      expect(state.skillNodes).not.toHaveBeenCalledWith(STUDENT_B.id);
      expect(JSON.stringify(res.body)).toContain('AVAILABLE');
    });
  });

  describe('the retired step progress backfill', () => {
    it('no longer exists for anyone', async () => {
      await request(app.getHttpServer()).post('/learner-model/backfill/topic-mastery').set(asUser(ADMIN_A)).expect(404);
    });
  });
});
