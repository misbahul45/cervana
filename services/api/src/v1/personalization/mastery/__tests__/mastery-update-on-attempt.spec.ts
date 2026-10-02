import { Test } from '@nestjs/testing';
import { QuizAttemptsService } from '@/v1/quiz/quiz-attempts/quiz-attempts.service';
import { MasteryService } from '@/v1/personalization/mastery/mastery.service';
import { MisconceptionService } from '@/v1/personalization/misconception/misconception.service';
import { QuizAttemptsRepo } from '@/v1/quiz/quiz-attempts/quiz-attempts.repo';
import { PrismaService } from '@/common/config/prisma/prisma.service';

describe('Mastery update on quiz attempt (Phase 2)', () => {
  it('QuizAttemptsService.submitAttempt delegates to MasteryService', async () => {
    const masteryMock = {
      updateFromAttempt: jest.fn().mockResolvedValue({ score: 0.72, attempts: 3 }),
    };
    const misconceptionMock = { recordFromAnswer: jest.fn() };
    const prismaMock = {
      quiz: { findUnique: jest.fn().mockResolvedValue({ id: 'q1', topicId: 't1' }) },
    };
    const repoMock = { create: jest.fn(), findOne: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        QuizAttemptsService,
        { provide: QuizAttemptsRepo, useValue: repoMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: MasteryService, useValue: masteryMock },
        { provide: MisconceptionService, useValue: misconceptionMock },
      ],
    }).compile();

    const quizSvc = module.get(QuizAttemptsService);
    const result = await quizSvc.submitAttempt({
      userId: 'u1',
      quizId: 'q1',
      attemptId: 'a1',
      score: 0.8,
    });

    expect(masteryMock.updateFromAttempt).toHaveBeenCalledWith('u1', 't1', 0.8);
    expect(result.updatedMastery).toEqual({
      topicId: 't1',
      score: 0.72,
      attempts: 3,
    });
  });
});