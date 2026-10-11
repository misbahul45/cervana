import { Role } from '@prisma/client';
import { canSeeAnswerKey, viewerQuery, withoutAnswerKey } from '@/v1/quiz/answer-key';
import { QuestionsController } from '@/v1/quiz/questions/questions.controller';
import { QuizzesController } from '@/v1/quiz/quizzes/quizzes.controller';

const question = (id: string) => ({ id, quizId: 'q-1', question: 'Apa itu aset?', options: ['A', 'B'], correctAnswer: 'A', points: 2, sortOrder: 1 });

describe('canSeeAnswerKey', () => {
  it('lets the people who write quizzes see the key, nobody else', () => {
    expect(canSeeAnswerKey(Role.ADMIN)).toBe(true);
    expect(canSeeAnswerKey(Role.TEACHER)).toBe(true);
    expect(canSeeAnswerKey(Role.STUDENT)).toBe(false);
    expect(canSeeAnswerKey(undefined)).toBe(false);
    expect(canSeeAnswerKey('SOMETHING_ELSE')).toBe(false);
  });
});

describe('withoutAnswerKey', () => {
  it('removes correctAnswer from every question in a list response and keeps the rest', () => {
    const response = { message: 'ok', data: { data: [question('a'), question('b')], pagination: { total: 2 } } };

    const cleaned = withoutAnswerKey(response);

    expect(cleaned.data.data.map((q) => 'correctAnswer' in q)).toEqual([false, false]);
    expect(cleaned.data.data[0]).toMatchObject({ id: 'a', question: 'Apa itu aset?', options: ['A', 'B'], points: 2 });
    expect(cleaned.data.pagination).toEqual({ total: 2 });
  });

  it('removes it from a single question and from questions nested under a quiz', () => {
    expect('correctAnswer' in withoutAnswerKey({ data: question('a') }).data).toBe(false);

    const quiz = withoutAnswerKey({ data: { id: 'q-1', questions: [question('a')], lesson: { title: 'L' } } });
    expect('correctAnswer' in quiz.data.questions[0]!).toBe(false);
    expect(quiz.data.lesson).toEqual({ title: 'L' });
  });

  it('does not change its input', () => {
    const input = { data: [question('a')] };

    withoutAnswerKey(input);

    expect(input.data[0]!.correctAnswer).toBe('A');
  });

  it('copes with primitives, nulls and dates', () => {
    const when = new Date('2026-10-11T00:00:00Z');

    expect(withoutAnswerKey(null)).toBeNull();
    expect(withoutAnswerKey('teks')).toBe('teks');
    expect(withoutAnswerKey(7)).toBe(7);
    expect(withoutAnswerKey({ at: when }).at).toEqual(when);
  });
});

describe('controllers hide the key from learners', () => {
  const rows = { data: { data: [question('a')] } };
  const access = { assertCanTake: jest.fn().mockResolvedValue(undefined) };
  const quizzes = new QuizzesController(
    {
      findAllQuestions: jest.fn().mockResolvedValue(rows),
      findOne: jest.fn().mockResolvedValue({ data: { id: 'q-1', questions: [question('a')] } }),
    } as any,
    access as any,
  );
  const questions = new QuestionsController({ findOne: jest.fn().mockResolvedValue({ data: question('a') }) } as any);

  const learner = { id: 'u-1', role: Role.STUDENT } as any;
  const teacher = { id: 'u-2', role: Role.TEACHER } as any;

  it('quiz question list', async () => {
    expect('correctAnswer' in (await quizzes.findAllQuestions('q-1', {}, learner)).data.data[0]!).toBe(false);
    expect((await quizzes.findAllQuestions('q-1', {}, teacher)).data.data[0]!.correctAnswer).toBe('A');
  });

  it('quiz with its questions included', async () => {
    const asLearner: any = await quizzes.findOne('q-1', { include: 'questions' }, learner);
    const asTeacher: any = await quizzes.findOne('q-1', { include: 'questions' }, teacher);

    expect('correctAnswer' in asLearner.data.questions[0]).toBe(false);
    expect(asTeacher.data.questions[0].correctAnswer).toBe('A');
  });

  it('single question', async () => {
    expect('correctAnswer' in (await questions.findOne('a', {}, learner)).data).toBe(false);
    expect((await questions.findOne('a', {}, teacher)).data.correctAnswer).toBe('A');
  });
});

describe('controllers check access before they read', () => {
  it('never reads the questions when the learner may not take the quiz', async () => {
    const service = { findAllQuestions: jest.fn(), findOne: jest.fn() };
    const denied = { assertCanTake: jest.fn().mockRejectedValue(new Error('no access')) };
    const controller = new QuizzesController(service as any, denied as any);

    await expect(controller.findAllQuestions('q-1', {}, { id: 'u-1', role: Role.STUDENT } as any)).rejects.toThrow('no access');
    await expect(controller.findOne('q-1', {}, { id: 'u-1', role: Role.STUDENT } as any)).rejects.toThrow('no access');

    expect(service.findAllQuestions).not.toHaveBeenCalled();
    expect(service.findOne).not.toHaveBeenCalled();
    expect(denied.assertCanTake).toHaveBeenCalledWith({ id: 'u-1', role: Role.STUDENT }, 'q-1');
  });
});

describe('viewerQuery', () => {
  it('lets a learner include the questions and nothing else, so other learners attempts and progress stay private', () => {
    expect(viewerQuery(Role.STUDENT, { include: 'quizAttempts,questions,topicProgress' } as any)).toEqual({ include: 'questions' });
    expect(viewerQuery(Role.STUDENT, { include: ['questions', 'lessonProgress'] } as any)).toEqual({ include: 'questions' });
  });

  it('drops the include altogether when nothing allowed was asked for', () => {
    expect('include' in viewerQuery(Role.STUDENT, { include: 'quizAttempts' } as any)).toBe(false);
    expect('include' in viewerQuery(Role.STUDENT, {} as any)).toBe(false);
  });

  it('leaves the query of an author untouched', () => {
    const query = { include: 'quizAttempts,questions' } as any;

    expect(viewerQuery(Role.TEACHER, query)).toBe(query);
    expect(viewerQuery(Role.ADMIN, query)).toBe(query);
  });

  it('does not change its input and keeps other keys', () => {
    const query = { include: 'quizAttempts', page: 2 } as any;

    expect(viewerQuery(Role.STUDENT, query)).toEqual({ page: 2 });
    expect(query).toEqual({ include: 'quizAttempts', page: 2 });
  });
});

describe('QuizzesController passes a restricted query for learners', () => {
  it('asks the service only for what a learner may include', async () => {
    const service = { findOne: jest.fn().mockResolvedValue({ data: { id: 'q-1' } }), findAllQuestions: jest.fn() };
    const controller = new QuizzesController(service as any, { assertCanTake: jest.fn() } as any);

    await controller.findOne('q-1', { include: 'quizAttempts,questions' } as any, { id: 'u-1', role: Role.STUDENT } as any);
    await controller.findOne('q-1', { include: 'quizAttempts' } as any, { id: 'u-2', role: Role.TEACHER } as any);

    expect(service.findOne.mock.calls[0]).toEqual(['q-1', { include: 'questions' }]);
    expect(service.findOne.mock.calls[1]).toEqual(['q-1', { include: 'quizAttempts' }]);
  });
});
