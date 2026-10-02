import { Test } from '@nestjs/testing';
import { QuizEvaluationService } from '@/v1/quiz/services/quiz-evaluation.service';
import { QuestionType } from '@prisma/client';

describe('QuizEvaluationService (Phase 0 verification)', () => {
  let service: QuizEvaluationService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [QuizEvaluationService],
    }).compile();
    service = module.get(QuizEvaluationService);
  });

  it('marks MULTIPLE_CHOICE correct on exact match', () => {
    const result = service.evaluate({
      questionType: QuestionType.MULTIPLE_CHOICE,
      userAnswer: 'A',
      correctAnswer: 'A',
      points: 10,
    });
    expect(result.isCorrect).toBe(true);
    expect(result.pointsEarned).toBe(10);
  });

  it('marks MULTIPLE_CHOICE incorrect on mismatch', () => {
    const result = service.evaluate({
      questionType: QuestionType.MULTIPLE_CHOICE,
      userAnswer: 'B',
      correctAnswer: 'A',
      points: 10,
    });
    expect(result.isCorrect).toBe(false);
    expect(result.pointsEarned).toBe(0);
  });

  it('awards partial points on TEXT with high token overlap', () => {
    const result = service.evaluate({
      questionType: QuestionType.TEXT,
      userAnswer: 'Debit Cash Credit Revenue',
      correctAnswer: 'Debit Cash Credit Revenue accrual',
      points: 10,
    });
    expect(result.partial).toBe(true);
    expect(result.pointsEarned).toBeGreaterThan(0);
    expect(result.pointsEarned).toBeLessThan(10);
  });

  it('scores FILE_UPLOAD as manual review (zero points)', () => {
    const result = service.evaluate({
      questionType: QuestionType.FILE_UPLOAD,
      userAnswer: '/path/to/upload.pdf',
      correctAnswer: 'reference',
      points: 10,
    });
    expect(result.isCorrect).toBe(false);
    expect(result.pointsEarned).toBe(0);
  });

  it('penalizes hint usage', () => {
    const result = service.evaluate({
      questionType: QuestionType.MULTIPLE_CHOICE,
      userAnswer: 'A',
      correctAnswer: 'A',
      points: 10,
      hintUsed: true,
    });
    expect(result.isCorrect).toBe(false);
    expect(result.pointsEarned).toBe(0);
  });

  it('returns safe default for unknown question types', () => {
    const result = service.evaluate({
      questionType: 'UNKNOWN' as any,
      userAnswer: 'x',
      correctAnswer: 'y',
      points: 5,
    });
    expect(result.isCorrect).toBe(false);
    expect(result.pointsEarned).toBe(0);
  });
});