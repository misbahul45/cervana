import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn();

vi.mock('~/lib/api', () => ({ request: (...args: unknown[]) => request(...args), toQueryString: () => '' }));

import { quizService } from '~/services/learning/quiz';

describe('quizService talks to the routes the API really exposes', () => {
  beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue({ success: true });
  });

  it('reads a quiz and its questions under /quiz', async () => {
    await quizService.findOne('q-1');
    await quizService.questions('q-1');

    expect(request.mock.calls[0]?.slice(0, 2)).toEqual(['/quiz/quizs/q-1', 'GET']);
    expect(request.mock.calls[1]?.slice(0, 2)).toEqual(['/quiz/quizs/q-1/questions?limit=100', 'GET']);
  });

  it('starts and submits an attempt under /quiz', async () => {
    await quizService.startAttempt('q-1');
    await quizService.submitAttempt('a-1', { answers: { x: 'A' } });

    expect(request.mock.calls[0]).toEqual(['/quiz/quiz-attempts/start', 'POST', { quizId: 'q-1' }]);
    expect(request.mock.calls[1]).toEqual(['/quiz/quiz-attempts/a-1/submit', 'POST', { answers: { x: 'A' } }]);
  });
});
