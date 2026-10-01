import { Injectable } from '@nestjs/common';
import { QuestionType } from '@prisma/client';

export interface AnswerEvaluationInput {
  questionType: QuestionType;
  userAnswer: unknown;
  correctAnswer: unknown;
  options?: unknown;
  points: number;
  hintUsed?: boolean;
}

export interface AnswerEvaluationResult {
  isCorrect: boolean;
  pointsEarned: number;
  partial: boolean;
  reason: string;
}

@Injectable()
export class QuizEvaluationService {
  evaluate(input: AnswerEvaluationInput): AnswerEvaluationResult {
    if (input.hintUsed) {
      return {
        isCorrect: false,
        pointsEarned: 0,
        partial: false,
        reason: 'Hint used; mastery not demonstrated',
      };
    }

    switch (input.questionType) {
      case 'MULTIPLE_CHOICE':
        return this.evaluateMultipleChoice(input);
      case 'TEXT':
        return this.evaluateText(input);
      case 'FILE_UPLOAD':
        return this.evaluateFileUpload(input);
      case 'CASE_STUDY':
        return this.evaluateCaseStudy(input);
      default:
        return {
          isCorrect: false,
          pointsEarned: 0,
          partial: false,
          reason: `Unknown question type: ${input.questionType}`,
        };
    }
  }

  private evaluateMultipleChoice(input: AnswerEvaluationInput): AnswerEvaluationResult {
    if (typeof input.userAnswer !== 'string' || typeof input.correctAnswer !== 'string') {
      return {
        isCorrect: false,
        pointsEarned: 0,
        partial: false,
        reason: 'Multiple choice answer must be string',
      };
    }
    const correct = input.userAnswer.trim() === input.correctAnswer.trim();
    return {
      isCorrect: correct,
      pointsEarned: correct ? input.points : 0,
      partial: false,
      reason: correct ? 'Selected correct option' : 'Selected incorrect option',
    };
  }

  private evaluateText(input: AnswerEvaluationInput): AnswerEvaluationResult {
    if (typeof input.userAnswer !== 'string' || typeof input.correctAnswer !== 'string') {
      return {
        isCorrect: false,
        pointsEarned: 0,
        partial: false,
        reason: 'Text answer must be string',
      };
    }
    const userNorm = this.normalize(input.userAnswer);
    const correctNorm = this.normalize(input.correctAnswer as string);
    if (userNorm === correctNorm) {
      return {
        isCorrect: true,
        pointsEarned: input.points,
        partial: false,
        reason: 'Exact match',
      };
    }
    const overlap = this.tokenOverlap(userNorm, correctNorm);
    const partial = overlap >= 0.7;
    return {
      isCorrect: partial,
      pointsEarned: partial ? Math.round(input.points * 0.5) : 0,
      partial: partial && overlap < 1,
      reason: partial
        ? `Token overlap ${Math.round(overlap * 100)}%`
        : 'Insufficient overlap',
    };
  }

  private evaluateFileUpload(input: AnswerEvaluationInput): AnswerEvaluationResult {
    return {
      isCorrect: false,
      pointsEarned: 0,
      partial: false,
      reason: 'File upload requires manual review by Tutor',
    };
  }

  private evaluateCaseStudy(input: AnswerEvaluationInput): AnswerEvaluationResult {
    if (typeof input.userAnswer !== 'string' || typeof input.correctAnswer !== 'string') {
      return {
        isCorrect: false,
        pointsEarned: 0,
        partial: false,
        reason: 'Case study answer must be string',
      };
    }
    const userNorm = this.normalize(input.userAnswer);
    const correctNorm = this.normalize(input.correctAnswer);
    const overlap = this.tokenOverlap(userNorm, correctNorm);
    const partial = overlap >= 0.6;
    return {
      isCorrect: partial,
      pointsEarned: partial ? Math.round(input.points * overlap) : 0,
      partial: partial && overlap < 1,
      reason: partial
        ? `Concept overlap ${Math.round(overlap * 100)}%`
        : 'Insufficient conceptual overlap',
    };
  }

  private normalize(s: string): string {
    return s
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private tokenOverlap(a: string, b: string): number {
    const aTokens = new Set(a.split(' ').filter((t) => t.length > 2));
    const bTokens = new Set(b.split(' ').filter((t) => t.length > 2));
    if (aTokens.size === 0 || bTokens.size === 0) return 0;
    let inter = 0;
    for (const t of aTokens) if (bTokens.has(t)) inter += 1;
    const union = new Set([...aTokens, ...bTokens]).size;
    return inter / union;
  }
}