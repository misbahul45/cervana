import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { QuizAttemptsController } from '../quiz-attempts.controller';
import { QuizAttemptsService } from '../quiz-attempts.service';
import { ActivityDetectorInterceptor } from '@/common/interceptors/daily-activity.interceptor';
import { PolicyService } from '@/common/authz/policy.service';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { DailylogsRepo } from '@/v1/gamify/daily-logs/daily-logs.repo';
import { StreaksRepo } from '@/v1/gamify/streaks/streaks.repo';
import { STUDENT_A, STUDENT_B, asUser, createHttpApp } from '@/test-utils/http-harness';

describe('QuizAttemptsController start and submit', () => {
  let app: INestApplication;
  let service: { startAttempt: jest.Mock; submitAttempt: jest.Mock };

  beforeEach(async () => {
    service = {
      startAttempt: jest.fn().mockResolvedValue({ message: 'started', data: { id: 'attempt-1' } }),
      submitAttempt: jest.fn().mockResolvedValue({ score: 100, isCorrect: {} }),
    };
    app = await createHttpApp({
      controllers: [QuizAttemptsController],
      withOwnershipGuard: true,
      providers: [
        { provide: QuizAttemptsService, useValue: service },
        { provide: PrismaService, useValue: { quizAttempt: { findUnique: jest.fn(async ({ where }) => (where.id === 'attempt-1' ? { userId: STUDENT_A.id } : null)) } } },
        PolicyService,
        ActivityDetectorInterceptor,
        { provide: DailylogsRepo, useValue: { findToday: jest.fn().mockResolvedValue({ id: 'log' }), create: jest.fn() } },
        { provide: StreaksRepo, useValue: { incrementOrReset: jest.fn() } },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /quiz-attempts/start', () => {
    it('starts an attempt for the caller from the quiz id alone', async () => {
      await request(app.getHttpServer()).post('/quiz-attempts/start').set(asUser(STUDENT_A)).send({ quizId: 'quiz-1' }).expect(201);

      expect(service.startAttempt).toHaveBeenCalledWith({ id: STUDENT_A.id, role: STUDENT_A.role }, { quizId: 'quiz-1' });
    });

    it('never takes the learner from the body: an extra userId is rejected and nothing starts', async () => {
      await request(app.getHttpServer()).post('/quiz-attempts/start').set(asUser(STUDENT_A)).send({ quizId: 'quiz-1', userId: STUDENT_B.id }).expect(400);

      expect(service.startAttempt).not.toHaveBeenCalled();
    });

    it('requires authentication', async () => {
      await request(app.getHttpServer()).post('/quiz-attempts/start').send({ quizId: 'quiz-1' }).expect(401);
    });
  });

  describe('POST /quiz-attempts/:id/submit', () => {
    const answers = { answers: { q1: 'A' } };

    it('lets the owner submit', async () => {
      await request(app.getHttpServer()).post('/quiz-attempts/attempt-1/submit').set(asUser(STUDENT_A)).send(answers).expect(201);

      expect(service.submitAttempt).toHaveBeenCalledWith({ userId: STUDENT_A.id, attemptId: 'attempt-1', answers: answers.answers, hintUsed: false });
    });

    it("refuses another learner's attempt", async () => {
      await request(app.getHttpServer()).post('/quiz-attempts/attempt-1/submit').set(asUser(STUDENT_B)).send(answers).expect(403);

      expect(service.submitAttempt).not.toHaveBeenCalled();
    });
  });
});
