import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { UserTopicsController } from '../user-topics.controller';
import { UserTopicsService } from '../user-topics.service';
import { UserTopicsRepo } from '../user-topics.repo';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { PolicyService } from '@/common/authz/policy.service';
import { ADMIN_A, STUDENT_A, STUDENT_B, asUser, createHttpApp } from '@/test-utils/http-harness';

const PAID_TOPIC = '66666666-6666-4666-8666-666666666666';
const FREE_TOPIC = '77777777-7777-4777-8777-777777777777';
const ROW_ID = '88888888-8888-4888-8888-888888888888';

describe('UserTopics security', () => {
  let app: INestApplication;
  let repo: Record<string, jest.Mock>;
  let prisma: any;

  beforeEach(async () => {
    repo = {
      create: jest.fn().mockImplementation(async (values) => ({ id: ROW_ID, ...values })),
      findAll: jest.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }),
      findOne: jest.fn().mockResolvedValue({ id: ROW_ID, userId: STUDENT_A.id }),
      update: jest.fn().mockResolvedValue({ id: ROW_ID }),
      delete: jest.fn().mockResolvedValue({ id: ROW_ID }),
    };
    prisma = {
      topic: {
        findUnique: jest.fn().mockImplementation(async ({ where }) =>
          where.id === PAID_TOPIC ? { id: PAID_TOPIC, price: 150000 } : { id: FREE_TOPIC, price: 0 },
        ),
      },
      userTopic: { findUnique: jest.fn().mockResolvedValue({ userId: STUDENT_A.id }) },
    };
    app = await createHttpApp({
      controllers: [UserTopicsController],
      withOwnershipGuard: true,
      providers: [
        UserTopicsService,
        PolicyService,
        { provide: UserTopicsRepo, useValue: repo },
        { provide: PrismaService, useValue: prisma },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('paid content cannot be self-granted', () => {
    it('refuses to enroll a learner in a priced topic, whatever accessType they claim', async () => {
      await request(app.getHttpServer())
        .post('/user-topics')
        .set(asUser(STUDENT_A))
        .send({ topicId: PAID_TOPIC, accessType: 'PURCHASED', expiredAt: '2099-01-01T00:00:00.000Z' })
        .expect(403);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('enrolls a learner in a free topic as FREE, discarding purchase fields', async () => {
      await request(app.getHttpServer())
        .post('/user-topics')
        .set(asUser(STUDENT_A))
        .send({ topicId: FREE_TOPIC, accessType: 'PURCHASED', purchasedAt: '2026-01-01T00:00:00.000Z', expiredAt: '2099-01-01T00:00:00.000Z' })
        .expect(201);
      expect(repo.create).toHaveBeenCalledWith({
        userId: STUDENT_A.id,
        topicId: FREE_TOPIC,
        accessType: 'FREE',
        status: 'NOT_STARTED',
        progressPercent: 0,
      });
    });

    it('ignores a supplied userId that is not the caller and rejects it outright', async () => {
      await request(app.getHttpServer())
        .post('/user-topics')
        .set(asUser(STUDENT_A))
        .send({ topicId: FREE_TOPIC, userId: STUDENT_B.id })
        .expect(403);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('does not accept bulk enrollment from learners', async () => {
      await request(app.getHttpServer())
        .post('/user-topics')
        .set(asUser(STUDENT_A))
        .send([{ topicId: FREE_TOPIC }, { topicId: PAID_TOPIC }])
        .expect(400);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('a learner update can only change progress fields', async () => {
      await request(app.getHttpServer())
        .patch(`/user-topics/${ROW_ID}`)
        .set(asUser(STUDENT_A))
        .send({ status: 'IN_PROGRESS', accessType: 'PURCHASED', expiredAt: '2099-01-01T00:00:00.000Z', quizId: 'x' })
        .expect(200);
      expect(repo.update).toHaveBeenCalledWith(ROW_ID, { status: 'IN_PROGRESS' });
    });

    it('ADMIN keeps full control', async () => {
      await request(app.getHttpServer())
        .post('/user-topics')
        .set(asUser(ADMIN_A))
        .send({ userId: STUDENT_A.id, topicId: PAID_TOPIC, accessType: 'PURCHASED' })
        .expect(201);
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ accessType: 'PURCHASED' }));
    });
  });

  describe('ownership', () => {
    it('another learner cannot read, update, or delete the row', async () => {
      await request(app.getHttpServer()).get(`/user-topics/${ROW_ID}`).set(asUser(STUDENT_B)).expect(403);
      await request(app.getHttpServer()).patch(`/user-topics/${ROW_ID}`).set(asUser(STUDENT_B)).send({ status: 'COMPLETED' }).expect(403);
      await request(app.getHttpServer()).delete(`/user-topics/${ROW_ID}`).set(asUser(STUDENT_B)).expect(403);
      expect(repo.update).not.toHaveBeenCalled();
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('the owner and ADMIN can read the row', async () => {
      await request(app.getHttpServer()).get(`/user-topics/${ROW_ID}`).set(asUser(STUDENT_A)).expect(200);
      await request(app.getHttpServer()).get(`/user-topics/${ROW_ID}`).set(asUser(ADMIN_A)).expect(200);
    });
  });
});
