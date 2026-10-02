import { Injectable } from '@nestjs/common';
import { MisconceptionRepo } from './misconception.repo';

const PATTERNS: Array<{
  code: string;
  match: (input: { questionId: string; userAnswer: string; correctAnswer: string }) => boolean;
}> = [
  {
    code: 'debit_credit_swap',
    match: ({ questionId, userAnswer, correctAnswer }) => {
      const isJournal = questionId.startsWith('q-journal');
      if (!isJournal) return false;
      if (!/debit|credit/i.test(correctAnswer)) return false;
      const swapped = correctAnswer.replace(/debit/gi, '___DEBIT___').replace(/credit/gi, 'debit').replace(/___DEBIT___/g, 'credit');
      return userAnswer.trim() === swapped.trim();
    },
  },
  {
    code: 'trial_balance_imbalance',
    match: ({ questionId, userAnswer }) =>
      questionId.startsWith('q-trial-balance') &&
      (userAnswer.trim() === '' || !/credit/i.test(userAnswer)),
  },
  {
    code: 'missing_credit_side',
    match: ({ userAnswer }) => /debit/i.test(userAnswer) && !/credit/i.test(userAnswer),
  },
];

@Injectable()
export class MisconceptionService {
  constructor(private readonly repo: MisconceptionRepo) {}

  classifyPattern(input: {
    questionId: string;
    userAnswer: string;
    correctAnswer: string;
  }): string | null {
    for (const pattern of PATTERNS) {
      if (pattern.match(input)) return pattern.code;
    }
    return null;
  }

  async recordFromAnswer(input: {
    userId: string;
    topicId?: string;
    questionId: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
  }): Promise<{ patternCode: string | null }> {
    if (input.isCorrect) return { patternCode: null };
    const code = this.classifyPattern(input);
    if (!code) return { patternCode: null };
    await this.repo.upsert({
      userId: input.userId,
      conceptKey: code,
      topicId: input.topicId,
      evidence: { questionId: input.questionId, userAnswer: input.userAnswer },
      confidence: 0.7,
    });
    return { patternCode: code };
  }

  async listActiveByUser(userId: string) {
    return this.repo.listActiveByUser(userId);
  }
}