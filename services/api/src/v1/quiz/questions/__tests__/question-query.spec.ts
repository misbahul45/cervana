import { buildQuestionQuery } from '@/v1/quiz/questions/question-query';

describe('buildQuestionQuery', () => {
  it('always scopes to the quiz in the path, even when the query tries to name another quiz', () => {
    const query = buildQuestionQuery('quiz-1', { quizId: 'quiz-2' } as any);

    expect(query.where.quizId).toBe('quiz-1');
  });

  it('ignores any filter on the answer key, the text or the options, which would let a learner guess the key', () => {
    const query = buildQuestionQuery('quiz-1', { correctAnswer: 'Ekuitas', options: 'x', question: 'y', id: 'z', 'quiz[is][id]': 'q' } as any);

    expect(query.where).toEqual({ quizId: 'quiz-1' });
  });

  it('accepts the few filters that are safe to expose', () => {
    const query = buildQuestionQuery('quiz-1', { questionType: 'TEXT', points: '2', sortOrder: '3' } as any);

    expect(query.where).toEqual({ quizId: 'quiz-1', questionType: 'TEXT', points: 2, sortOrder: 3 });
  });

  it('drops a filter value that is not valid for its field', () => {
    const query = buildQuestionQuery('quiz-1', { questionType: 'EVIL', points: 'many', sortOrder: { gt: 1 } } as any);

    expect(query.where).toEqual({ quizId: 'quiz-1' });
  });

  it('never sorts by the answer key, so the order cannot reveal it', () => {
    expect(buildQuestionQuery('quiz-1', { sort: 'correctAnswer:asc' } as any).orderBy).toEqual({ sortOrder: 'asc' });
    expect(buildQuestionQuery('quiz-1', { sort: 'points:desc' } as any).orderBy).toEqual({ points: 'desc' });
    expect(buildQuestionQuery('quiz-1', { sort: 'points:sideways' } as any).orderBy).toEqual({ points: 'asc' });
    expect(buildQuestionQuery('quiz-1', {} as any).orderBy).toEqual({ sortOrder: 'asc' });
  });

  it('does not include other learners answers', () => {
    expect(buildQuestionQuery('quiz-1', { include: 'answers' } as any).include).toBeUndefined();
    expect(buildQuestionQuery('quiz-1', { include: 'answers,quiz' } as any).include).toEqual({ quiz: true });
    expect(buildQuestionQuery('quiz-1', { include: ['quiz'] } as any).include).toEqual({ quiz: true });
  });

  it('paginates within bounds', () => {
    expect(buildQuestionQuery('quiz-1', {} as any)).toMatchObject({ page: 1, limit: 10, skip: 0, take: 10 });
    expect(buildQuestionQuery('quiz-1', { page: '3', limit: '20' } as any)).toMatchObject({ page: 3, limit: 20, skip: 40, take: 20 });
    expect(buildQuestionQuery('quiz-1', { page: '-4', limit: '100000' } as any)).toMatchObject({ page: 1, limit: 100 });
    expect(buildQuestionQuery('quiz-1', { page: 'x', limit: '0' } as any)).toMatchObject({ page: 1, limit: 10 });
  });
});
