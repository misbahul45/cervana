import { CreateQuizAttemptDto, StartQuizAttemptDto, SubmitQuizAttemptDto } from '../quizAttempets.dto';

describe('Quiz attempts DTOs (F-01: no client-writable score/status; F-08: new start + submit flows)', () => {
  it('CreateQuizAttemptDto rejects score or status in body', () => {
    const parsed = CreateQuizAttemptDto.safeParse({
      userId: 'u1',
      quizId: 'q1',
      attemptNumber: 1,
      score: 100,
      status: 'COMPLETED',
    });
    expect(parsed.success).toBe(false);
  });

  it('CreateQuizAttemptDto accepts only client-authorized fields', () => {
    const parsed = CreateQuizAttemptDto.safeParse({
      userId: 'u1',
      quizId: 'q1',
      attemptNumber: 1,
    });
    expect(parsed.success).toBe(true);
  });

  it('StartQuizAttemptDto only requires quizId', () => {
    const parsed = StartQuizAttemptDto.safeParse({ quizId: 'q1' });
    expect(parsed.success).toBe(true);
  });

  it('StartQuizAttemptDto rejects other fields', () => {
    const parsed = StartQuizAttemptDto.safeParse({ quizId: 'q1', score: 100 });
    expect(parsed.success).toBe(false);
  });

  it('SubmitQuizAttemptDto accepts answers map and hintUsed', () => {
    const parsed = SubmitQuizAttemptDto.safeParse({
      answers: { 'q1': 'A', 'q2': true },
      hintUsed: false,
    });
    expect(parsed.success).toBe(true);
  });

  it('SubmitQuizAttemptDto rejects score/status in body', () => {
    const parsed = SubmitQuizAttemptDto.safeParse({
      answers: { 'q1': 'A' },
      score: 100,
      status: 'COMPLETED',
    });
    expect(parsed.success).toBe(false);
  });
});
