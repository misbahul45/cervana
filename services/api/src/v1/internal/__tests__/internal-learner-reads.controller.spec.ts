import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { InternalLearnerReadsController } from '../internal-learner-reads.controller';
import { UserStepsService } from '../../learning/user-steps/user-steps.service';
import { LearningStylesService } from '../../learning/learning-styles/learning-styles.service';
import { PersonalityQuizzesService } from '../../learning/personality-quizzes/personality-quizzes.service';
import { ContentSimilarityService } from '../../chat/contents/content-similarity.service';
import { InternalServiceGuard } from '@/common/authz/internal-service.guard';
import { ActingUserGuard } from '@/common/authz/acting-user.guard';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { createHttpApp } from '@/test-utils/http-harness';
import { internalAuthProviders, signInternalRequest } from '@/test-utils/internal-signing';

describe('InternalLearnerReadsController', () => {
  let app: INestApplication;
  let prisma: Record<string, { findUnique: jest.Mock }>;
  let userSteps: { findOne: jest.Mock };
  let learningStyles: { findOne: jest.Mock };
  let personalityQuizzes: { findAll: jest.Mock };
  let similarity: { findSimilar: jest.Mock };

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
    prisma = {
      user: { findUnique: jest.fn(async ({ where }) => users[where.id] ?? null) },
      userStep: { findUnique: jest.fn(async ({ where }) => (where.id === 'us-a' ? { userId: 'student-a' } : null)) },
      learningStyleProfile: {
        findUnique: jest.fn(async ({ where }) =>
          where.id === 'ls-a' ? { userTopic: { userId: 'student-a' } } : null,
        ),
      },
      chat: {
        findUnique: jest.fn(async ({ where }) => (where.id === 'chat-a' ? { userStep: { userId: 'student-a' } } : null)),
      },
    };
    userSteps = { findOne: jest.fn().mockResolvedValue({ message: 'ok', data: { id: 'us-a' } }) };
    learningStyles = { findOne: jest.fn().mockResolvedValue({ message: 'ok', data: { id: 'ls-a' } }) };
    personalityQuizzes = { findAll: jest.fn().mockResolvedValue({ message: 'ok', data: { data: [] } }) };
    similarity = { findSimilar: jest.fn().mockResolvedValue({ data: [{ id: 'c-1', score: 1 }] }) };

    app = await createHttpApp({
      controllers: [InternalLearnerReadsController],
      rawBody: true,
      withOwnershipGuard: true,
      providers: [
        InternalServiceGuard,
        ActingUserGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: UserStepsService, useValue: userSteps },
        { provide: LearningStylesService, useValue: learningStyles },
        { provide: PersonalityQuizzesService, useValue: personalityQuizzes },
        { provide: ContentSimilarityService, useValue: similarity },
        ...internalAuthProviders(),
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /internal/user-steps/:id', () => {
    it('serves the owner', async () => {
      const response = await get('/internal/user-steps/us-a', 'student-a').expect(200);

      expect(userSteps.findOne).toHaveBeenCalledWith('us-a', {});
      expect(response.body.data).toEqual({ id: 'us-a' });
    });

    it('rejects another user, an admin acting user and a missing step', async () => {
      await get('/internal/user-steps/us-a', 'student-b').expect(403);
      await get('/internal/user-steps/us-a', 'admin-a').expect(403);
      await get('/internal/user-steps/us-missing', 'student-a').expect(403);
      expect(userSteps.findOne).not.toHaveBeenCalled();
    });

    it('answers 400 without an acting user and 401 without service credentials', async () => {
      await get('/internal/user-steps/us-a').expect(400);
      await request(app.getHttpServer()).get('/internal/user-steps/us-a').expect(401);
    });
  });

  describe('GET /internal/learning-styles/:id', () => {
    it('serves the owner and rejects another user', async () => {
      await get('/internal/learning-styles/ls-a', 'student-a').expect(200);
      await get('/internal/learning-styles/ls-a', 'student-b').expect(403);
      expect(learningStyles.findOne).toHaveBeenCalledTimes(1);
    });

    it('answers 401 without service credentials', async () => {
      await request(app.getHttpServer()).get('/internal/learning-styles/ls-a').expect(401);
    });
  });

  describe('GET /internal/personality-quizzes', () => {
    it('lists the acting user quizzes when no user is named', async () => {
      await get('/internal/personality-quizzes?lessonId=l-1', 'student-a').expect(200);

      expect(personalityQuizzes.findAll).toHaveBeenCalledWith('student-a', { lessonId: 'l-1' });
    });

    it('accepts the acting user as the named user', async () => {
      await get('/internal/personality-quizzes?lessonId=l-1&userId=student-a', 'student-a').expect(200);

      expect(personalityQuizzes.findAll).toHaveBeenCalledWith('student-a', { lessonId: 'l-1', userId: 'student-a' });
    });

    it('rejects naming another user, also for an admin acting user', async () => {
      await get('/internal/personality-quizzes?userId=student-a', 'student-b').expect(403);
      await get('/internal/personality-quizzes?userId=student-a', 'admin-a').expect(403);
      expect(personalityQuizzes.findAll).not.toHaveBeenCalled();
    });

    it('answers 400 without an acting user and 401 without service credentials', async () => {
      await get('/internal/personality-quizzes').expect(400);
      await request(app.getHttpServer()).get('/internal/personality-quizzes').expect(401);
    });
  });

  describe('GET /internal/contents/similarity', () => {
    const target = '/internal/contents/similarity?chatId=chat-a&query=debit%20kredit';

    it('serves the owner of the chat', async () => {
      const response = await get(target, 'student-a').expect(200);

      expect(similarity.findSimilar).toHaveBeenCalledWith('chat-a', 'debit kredit');
      expect(response.body.data).toEqual([{ id: 'c-1', score: 1 }]);
    });

    it('rejects another user and an unknown chat', async () => {
      await get(target, 'student-b').expect(403);
      await get('/internal/contents/similarity?chatId=chat-x&query=debit', 'student-a').expect(403);
      expect(similarity.findSimilar).not.toHaveBeenCalled();
    });

    it('answers 401 without service credentials', async () => {
      await request(app.getHttpServer()).get(target).expect(401);
    });
  });
});
