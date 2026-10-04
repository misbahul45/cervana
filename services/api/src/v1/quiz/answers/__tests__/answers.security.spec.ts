import { CreateAnswerDto } from '../answers.dto';

describe('Answers DTO (F-02: no client-writable isCorrect)', () => {
  it('rejects an isCorrect field via Zod', () => {
    const attempt = {
      attemptId: 'a1',
      questionId: 'q1',
      userAnswer: 'A',
      isCorrect: true,
    };
    const parsed = CreateAnswerDto.safeParse(attempt);
    expect(parsed.success).toBe(false);
  });

  it('rejects a pointsEarned field via Zod', () => {
    const attempt = {
      attemptId: 'a1',
      questionId: 'q1',
      userAnswer: 'A',
      pointsEarned: 100,
    };
    const parsed = CreateAnswerDto.safeParse(attempt);
    expect(parsed.success).toBe(false);
  });

  it('accepts only client-authorized fields', () => {
    const parsed = CreateAnswerDto.safeParse({
      attemptId: 'a1',
      questionId: 'q1',
      userAnswer: 'A',
    });
    expect(parsed.success).toBe(true);
  });
});
