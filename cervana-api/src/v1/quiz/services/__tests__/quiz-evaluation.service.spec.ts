import { QuizEvaluationService } from '../quiz-evaluation.service';
import { QuestionType } from '@prisma/client';

describe('QuizEvaluationService', () => {
  let service: QuizEvaluationService;

  beforeEach(() => {
    service = new QuizEvaluationService();
  });

  describe('multiple choice', () => {
    it('marks correct when strings match', () => {
      const r = service.evaluate({
        questionType: QuestionType.MULTIPLE_CHOICE,
        userAnswer: 'B',
        correctAnswer: 'B',
        points: 10,
      });
      expect(r.isCorrect).toBe(true);
      expect(r.pointsEarned).toBe(10);
      expect(r.partial).toBe(false);
    });

    it('marks incorrect when strings differ', () => {
      const r = service.evaluate({
        questionType: QuestionType.MULTIPLE_CHOICE,
        userAnswer: 'A',
        correctAnswer: 'B',
        points: 10,
      });
      expect(r.isCorrect).toBe(false);
      expect(r.pointsEarned).toBe(0);
    });

    it('trims whitespace before comparison', () => {
      const r = service.evaluate({
        questionType: QuestionType.MULTIPLE_CHOICE,
        userAnswer: '  B  ',
        correctAnswer: 'B',
        points: 5,
      });
      expect(r.isCorrect).toBe(true);
    });

    it('rejects non-string answers', () => {
      const r = service.evaluate({
        questionType: QuestionType.MULTIPLE_CHOICE,
        userAnswer: 42 as any,
        correctAnswer: 'B',
        points: 10,
      });
      expect(r.isCorrect).toBe(false);
      expect(r.reason).toMatch(/string/);
    });
  });

  describe('text answer', () => {
    it('marks correct when normalized strings match', () => {
      const r = service.evaluate({
        questionType: QuestionType.TEXT,
        userAnswer: 'Debit Cash, Credit Revenue',
        correctAnswer: 'debit cash, credit revenue',
        points: 10,
      });
      expect(r.isCorrect).toBe(true);
      expect(r.pointsEarned).toBe(10);
    });

    it('awards half points on high overlap', () => {
      const r = service.evaluate({
        questionType: QuestionType.TEXT,
        userAnswer: 'debit cash credit revenue',
        correctAnswer: 'debit cash credit revenue extra',
        points: 10,
      });
      expect(r.isCorrect).toBe(true);
      expect(r.partial).toBe(true);
      expect(r.pointsEarned).toBe(5);
    });

    it('fails on insufficient overlap', () => {
      const r = service.evaluate({
        questionType: QuestionType.TEXT,
        userAnswer: 'banana apple orange',
        correctAnswer: 'computer database server',
        points: 10,
      });
      expect(r.isCorrect).toBe(false);
      expect(r.pointsEarned).toBe(0);
    });
  });

  describe('case study', () => {
    it('uses lower threshold (60%) than free-text (70%)', () => {
      const r = service.evaluate({
        questionType: QuestionType.CASE_STUDY,
        userAnswer: 'a b c',
        correctAnswer: 'a b c d',
        points: 10,
      });
      expect(r.isCorrect).toBe(true);
      expect(r.partial).toBe(true);
      const r2 = service.evaluate({
        questionType: QuestionType.TEXT,
        userAnswer: 'a b c',
        correctAnswer: 'a b c d',
        points: 10,
      });
      expect(r2.isCorrect).toBe(false);
    });

    it('awards partial points proportional to overlap', () => {
      const r = service.evaluate({
        questionType: QuestionType.CASE_STUDY,
        userAnswer: 'cash revenue asset',
        correctAnswer: 'cash revenue asset liability equity',
        points: 100,
      });
      expect(r.partial).toBe(true);
      expect(r.pointsEarned).toBeGreaterThan(0);
      expect(r.pointsEarned).toBeLessThan(100);
    });
  });

  describe('file upload', () => {
    it('always returns manual review', () => {
      const r = service.evaluate({
        questionType: QuestionType.FILE_UPLOAD,
        userAnswer: '/path/to/file.pdf',
        correctAnswer: 'rubric reference',
        points: 10,
      });
      expect(r.isCorrect).toBe(false);
      expect(r.pointsEarned).toBe(0);
      expect(r.reason).toMatch(/manual review/);
    });
  });

  describe('hint penalty', () => {
    it('always returns isCorrect=false when hint used (regardless of answer)', () => {
      const r = service.evaluate({
        questionType: QuestionType.MULTIPLE_CHOICE,
        userAnswer: 'B',
        correctAnswer: 'B',
        points: 10,
        hintUsed: true,
      });
      expect(r.isCorrect).toBe(false);
      expect(r.pointsEarned).toBe(0);
      expect(r.reason).toMatch(/Hint/);
    });
  });

  describe('unknown question type', () => {
    it('returns zero-score with safe error message', () => {
      const r = service.evaluate({
        questionType: 'UNKNOWN' as any,
        userAnswer: 'whatever',
        correctAnswer: 'whatever',
        points: 10,
      });
      expect(r.isCorrect).toBe(false);
      expect(r.pointsEarned).toBe(0);
      expect(r.reason).toMatch(/Unknown question type/);
    });
  });
});