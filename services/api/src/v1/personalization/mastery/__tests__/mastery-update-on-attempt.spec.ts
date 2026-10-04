import { Test } from '@nestjs/testing';
import { QuizAttemptsService } from '@/v1/quiz/quiz-attempts/quiz-attempts.service';
import { MasteryService } from '@/v1/personalization/mastery/mastery.service';
import { MisconceptionService } from '@/v1/personalization/misconception/misconception.service';
import { QuizAttemptsRepo } from '@/v1/quiz/quiz-attempts/quiz-attempts.repo';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { QuizEvaluationService } from '@/v1/quiz/services/quiz-evaluation.service';
import { AttemptStatus } from '@prisma/client';

describe('Mastery update on quiz attempt (Phase 2)', () => {
  it('QuizAttemptsService.submitAttempt delegates to MasteryService with computed score', async () => {
    const masteryMock = {
      updateFromAttempt: jest.fn().mockResolvedValue({ score: 1.0, attempts: 1 }),
    };
    const misconceptionMock = { recordFromAnswer: jest.fn() };

    const attempt = {
      id: 'a1',
      userId: 'u1',
      quizId: 'q1',
      status: AttemptStatus.IN_PROGRESS,
      score: null,
    };
    const updatedAttempt = { ...attempt, status: AttemptStatus.COMPLETED, score: 100 };

    const txMock = {
      quizAttempt: {
        findUnique: jest.fn().mockResolvedValue(attempt),
        update: jest.fn().mockResolvedValue(updatedAttempt),
      },
      quiz: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'q1',
          topicId: 't1',
          questions: [
            { id: 'q1-1', questionType: 'MULTIPLE_CHOICE', correctAnswer: 'A', options: null, points: 1 },
          ],
        }),
      },
      answer: {
        upsert: jest.fn().mockResolvedValue({}),
      },
    };

    const prismaMock = {
      $transaction: (fn: (tx: unknown) => unknown) => fn(txMock),
      quizAttempt: txMock.quizAttempt,
      quiz: txMock.quiz,
      answer: txMock.answer,
    };

    const repoMock = { create: jest.fn() };

    const evaluatorMock = {
      evaluate: jest.fn().mockReturnValue({
        isCorrect: true,
        pointsEarned: 1,
        partial: false,
        reason: 'Selected correct option',
      }),
    };

    const eventLogMock = { record: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        QuizAttemptsService,
        { provide: QuizAttemptsRepo, useValue: repoMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: MasteryService, useValue: masteryMock },
        { provide: MisconceptionService, useValue: misconceptionMock },
        { provide: QuizEvaluationService, useValue: evaluatorMock },
        { provide: 'EventLogService' as any, useValue: eventLogMock },
      ],
    }).compile();

    const quizSvc = module.get(QuizAttemptsService);
    const result = await quizSvc.submitAttempt({
      userId: 'u1',
      attemptId: 'a1',
      answers: { 'q1-1': 'A' },
    });

    expect(masteryMock.updateFromAttempt).toHaveBeenCalledWith('u1', 't1', 100);
    expect(result.updatedMastery).toEqual({
      topicId: 't1',
      score: 1.0,
      attempts: 1,
    });
    expect(result.score).toBe(100);
    expect(evaluatorMock.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        questionType: 'MULTIPLE_CHOICE',
        userAnswer: 'A',
        correctAnswer: 'A',
        points: 1,
      }),
    );
  });
});
