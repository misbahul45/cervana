import { QuizAttemptsService } from '../quiz-attempts.service';
import { QuizEvaluationService } from '@/v1/quiz/services/quiz-evaluation.service';

interface QuizFixture {
  topicId?: string | null;
  lessonId?: string | null;
  subTopicId?: string | null;
  stepId?: string | null;
  subTopic?: { topicId: string } | null;
  lesson?: { subTopicId: string; subTopic: { topicId: string } } | null;
  step?: { lessonId: string; lesson: { subTopicId: string; subTopic: { topicId: string } } } | null;
  questions?: Array<{ id: string; points: number; correctAnswer: string }>;
}

const question = (id: string, points = 1) => ({
  id,
  questionType: 'MULTIPLE_CHOICE',
  correctAnswer: 'A',
  options: ['A', 'B'],
  points,
});

const build = (quiz: QuizFixture, links: { source: string; conceptIds: string[] } = { source: 'LESSON', conceptIds: ['c1'] }) => {
  const tx = {
    quizAttempt: {
      findUnique: jest.fn().mockResolvedValue({ id: 'attempt-1', userId: 'user-1', quizId: 'quiz-1', status: 'IN_PROGRESS', attemptNumber: 3 }),
      update: jest.fn().mockResolvedValue({}),
    },
    quiz: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'quiz-1',
        topicId: quiz.topicId ?? null,
        lessonId: quiz.lessonId ?? null,
        subTopicId: quiz.subTopicId ?? null,
        stepId: quiz.stepId ?? null,
        subTopic: quiz.subTopic ?? null,
        lesson: quiz.lesson ?? null,
        step: quiz.step ?? null,
        questions: (quiz.questions ?? [question('q1'), question('q2')]),
      }),
    },
    answer: { upsert: jest.fn().mockResolvedValue({}) },
  };
  const prisma = { $transaction: jest.fn(async (work: (client: typeof tx) => unknown) => work(tx)) };
  const misconception = { recordFromAnswer: jest.fn().mockResolvedValue(undefined) };
  const concepts = { conceptsForCurriculum: jest.fn().mockResolvedValue(links) };
  const learnerEvents = {
    append: jest.fn(async (input: { conceptId: string; idempotencyKey: string; payload: { score: number; items: number; share: number } }) => ({
      eventId: `event-${input.conceptId}`,
      streamSeq: 1,
      duplicate: false,
      state: { score: 0.6, evidenceCount: 1, theta: 0.4, confidence: 0.05, lastEventAt: null, lastSeq: 1 },
    })),
  };
  const rewards = { onAssessment: jest.fn().mockResolvedValue({ points: 4, entryIds: ['entry-1'] }) };
  const gamify = {
    afterAssessment: jest.fn().mockResolvedValue({
      xpGained: 8,
      starsGained: 0,
      streak: { current: 1, longest: 1, freezes: 0, extended: true, freezeEarned: false, freezesUsed: 0, bonusPoints: 0 },
      achievements: [],
    }),
  };
  const service = new QuizAttemptsService(
    {} as never,
    prisma as never,
    misconception as never,
    undefined,
    new QuizEvaluationService(),
    concepts as never,
    learnerEvents as never,
    rewards as never,
    gamify as never,
  );
  return { service, tx, misconception, concepts, learnerEvents, rewards, gamify };
};

const submit = (service: QuizAttemptsService, answers: Record<string, unknown>, hintUsed?: boolean) =>
  service.submitAttempt({ userId: 'user-1', attemptId: 'attempt-1', answers, hintUsed });

describe('quiz submission appends learning evidence', () => {
  it('appends one assessment event per approved concept of a lesson quiz, inside the grading transaction', async () => {
    const { service, tx, concepts, learnerEvents } = build({ lessonId: 'lesson-1', lesson: { subTopicId: 'sub-1', subTopic: { topicId: 'topic-1' } } });

    await submit(service, { q1: 'A', q2: 'B' });

    expect(concepts.conceptsForCurriculum).toHaveBeenCalledWith({ lessonId: 'lesson-1', subTopicId: 'sub-1' });
    expect(learnerEvents.append).toHaveBeenCalledTimes(1);
    expect(learnerEvents.append).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        conceptId: 'c1',
        idempotencyKey: 'assessment:attempt-1:c1',
        payload: { attemptId: 'attempt-1', quizId: 'quiz-1', score: 0.5, items: 2, hintsUsed: 0, share: 1, attemptNumber: 3 },
      },
      tx,
    );
  });

  it('uses the exact share of points earned, not the rounded percentage', async () => {
    const { service, learnerEvents } = build(
      { lessonId: 'lesson-1', questions: [question('q1', 3), question('q2', 1), question('q3', 3)] },
    );

    await submit(service, { q1: 'A', q2: 'B', q3: 'A' });

    expect(learnerEvents.append.mock.calls[0][0].payload.score).toBeCloseTo(6 / 7, 10);
    expect(learnerEvents.append.mock.calls[0][0].payload.items).toBe(3);
  });

  it('splits the credit equally between the concepts of a quiz and gives each its own key', async () => {
    const { service, learnerEvents } = build({ subTopicId: 'sub-1' }, { source: 'SUBTOPIC', conceptIds: ['c1', 'c2', 'c3', 'c4'] });

    await submit(service, { q1: 'A', q2: 'A' });

    const calls = learnerEvents.append.mock.calls.map(([input]) => [input.conceptId, input.idempotencyKey, input.payload.share]);
    expect(calls).toEqual([
      ['c1', 'assessment:attempt-1:c1', 0.25],
      ['c2', 'assessment:attempt-1:c2', 0.25],
      ['c3', 'assessment:attempt-1:c3', 0.25],
      ['c4', 'assessment:attempt-1:c4', 0.25],
    ]);
  });

  it('finds the location of a step quiz through its step and lesson', async () => {
    const { service, concepts } = build({ stepId: 'step-1', step: { lessonId: 'lesson-9', lesson: { subTopicId: 'sub-9', subTopic: { topicId: 'topic-9' } } } });

    await submit(service, { q1: 'A', q2: 'A' });

    expect(concepts.conceptsForCurriculum).toHaveBeenCalledWith({ lessonId: 'lesson-9', subTopicId: 'sub-9' });
  });

  it('takes the sub-topic of a sub-topic quiz directly', async () => {
    const { service, concepts } = build({ subTopicId: 'sub-3' });

    await submit(service, { q1: 'A', q2: 'A' });

    expect(concepts.conceptsForCurriculum).toHaveBeenCalledWith({ lessonId: null, subTopicId: 'sub-3' });
  });

  it('appends nothing when the quiz has no approved concept', async () => {
    const { service, learnerEvents } = build({ lessonId: 'lesson-1' }, { source: 'NONE', conceptIds: [] });

    await submit(service, { q1: 'A', q2: 'A' });

    expect(learnerEvents.append).not.toHaveBeenCalled();
  });

  it('appends nothing when a hint was used, because the grader says mastery was not demonstrated', async () => {
    const { service, concepts, learnerEvents } = build({ lessonId: 'lesson-1' });

    const result = await submit(service, { q1: 'A', q2: 'A' }, true);

    expect(result.score).toBe(0);
    expect(concepts.conceptsForCurriculum).not.toHaveBeenCalled();
    expect(learnerEvents.append).not.toHaveBeenCalled();
  });

  it('appends nothing for a quiz without questions', async () => {
    const { service, learnerEvents } = build({ lessonId: 'lesson-1', questions: [] });

    await submit(service, {});

    expect(learnerEvents.append).not.toHaveBeenCalled();
  });

  describe('rewards', () => {
    it('hands each stored event to the reward engine with the state after it and the location of the quiz, in the same transaction', async () => {
      const { service, tx, rewards } = build({ lessonId: 'lesson-1', lesson: { subTopicId: 'sub-1', subTopic: { topicId: 'topic-1' } } });

      await submit(service, { q1: 'A', q2: 'A' });

      expect(rewards.onAssessment).toHaveBeenCalledTimes(1);
      expect(rewards.onAssessment).toHaveBeenCalledWith(
        {
          userId: 'user-1',
          conceptId: 'c1',
          eventId: 'event-c1',
          duplicate: false,
          after: expect.objectContaining({ score: 0.6, evidenceCount: 1 }),
          topicId: 'topic-1',
          subTopicId: 'sub-1',
        },
        tx,
      );
    });

    it('rewards every concept of a shared quiz once, after its own event', async () => {
      const { service, learnerEvents, rewards } = build({ subTopicId: 'sub-1', subTopic: { topicId: 'topic-1' } }, { source: 'SUBTOPIC', conceptIds: ['c1', 'c2'] });

      await submit(service, { q1: 'A', q2: 'A' });

      expect(rewards.onAssessment.mock.calls.map(([e]) => e.conceptId)).toEqual(['c1', 'c2']);
      expect(learnerEvents.append.mock.invocationCallOrder[0]).toBeLessThan(rewards.onAssessment.mock.invocationCallOrder[0]);
      expect(rewards.onAssessment.mock.calls[0][0]).toMatchObject({ topicId: 'topic-1', subTopicId: 'sub-1' });
    });

    it('takes the topic of a topic level location from the quiz itself', async () => {
      const { service, rewards } = build({ topicId: 'topic-7', subTopicId: 'sub-7' }, { source: 'SUBTOPIC', conceptIds: ['c1'] });

      await submit(service, { q1: 'A', q2: 'A' });

      expect(rewards.onAssessment.mock.calls[0][0]).toMatchObject({ topicId: 'topic-7', subTopicId: 'sub-7' });
    });

    it('passes the duplicate flag of a replayed event, so the engine can pay nothing', async () => {
      const { service, learnerEvents, rewards } = build({ lessonId: 'lesson-1' });
      learnerEvents.append.mockResolvedValueOnce({ eventId: 'event-old', streamSeq: 1, duplicate: true, state: { score: 0.6, evidenceCount: 1, theta: 0.4, confidence: 0.05, lastEventAt: null, lastSeq: 1 } });

      await submit(service, { q1: 'A', q2: 'A' });

      expect(rewards.onAssessment.mock.calls[0][0]).toMatchObject({ duplicate: true, eventId: 'event-old' });
    });

    it('fails the submission when the reward cannot be stored, so evidence and reward never part', async () => {
      const { service, rewards, misconception } = build({ lessonId: 'lesson-1', topicId: 'topic-1' });
      rewards.onAssessment.mockRejectedValueOnce(new Error('ledger down'));

      await expect(submit(service, { q1: 'A', q2: 'A' })).rejects.toThrow('ledger down');

      expect(misconception.recordFromAnswer).not.toHaveBeenCalled();
    });

    it('rewards nothing when no concept is linked or a hint was used', async () => {
      const none = build({ lessonId: 'lesson-1' }, { source: 'NONE', conceptIds: [] });
      const hinted = build({ lessonId: 'lesson-1' });

      await submit(none.service, { q1: 'A', q2: 'A' });
      await submit(hinted.service, { q1: 'A', q2: 'A' }, true);

      expect(none.rewards.onAssessment).not.toHaveBeenCalled();
      expect(hinted.rewards.onAssessment).not.toHaveBeenCalled();
    });
  });

  it('fails the submission and skips the legacy updates when the event cannot be stored', async () => {
    const { service, learnerEvents, misconception } = build({ lessonId: 'lesson-1', topicId: 'topic-1' });
    learnerEvents.append.mockRejectedValueOnce(new Error('stream locked'));

    await expect(submit(service, { q1: 'A', q2: 'B' })).rejects.toThrow('stream locked');

    expect(misconception.recordFromAnswer).not.toHaveBeenCalled();
  });

  it('writes no mastery for a topic level quiz without concept links and answers without a legacy mastery field', async () => {
    const { service, learnerEvents, rewards } = build({ topicId: 'topic-1' }, { source: 'NONE', conceptIds: [] });

    const result = await submit(service, { q1: 'A', q2: 'A' });

    expect(learnerEvents.append).not.toHaveBeenCalled();
    expect(rewards.onAssessment).not.toHaveBeenCalled();
    expect(Object.keys(result).sort()).toEqual(['isCorrect', 'score']);
  });

  it('still grades when the learner state services are not available', async () => {
    const tx = {
      quizAttempt: { findUnique: jest.fn().mockResolvedValue({ id: 'attempt-1', userId: 'user-1', quizId: 'quiz-1', status: 'IN_PROGRESS', attemptNumber: 1 }), update: jest.fn() },
      quiz: { findUnique: jest.fn().mockResolvedValue({ id: 'quiz-1', topicId: null, lessonId: 'l', subTopicId: null, stepId: null, lesson: null, step: null, questions: [question('q1')] }) },
      answer: { upsert: jest.fn() },
    };
    const prisma = { $transaction: jest.fn(async (work: (client: typeof tx) => unknown) => work(tx)) };
    const service = new QuizAttemptsService({} as never, prisma as never, undefined, undefined, new QuizEvaluationService());

    await expect(service.submitAttempt({ userId: 'user-1', attemptId: 'attempt-1', answers: { q1: 'A' } })).resolves.toMatchObject({ score: 100 });
  });
});

describe('quiz submission gamification after the evidence', () => {
  const lessonQuiz = { lessonId: 'lesson-1', lesson: { subTopicId: 'sub-1', subTopic: { topicId: 'topic-1' } } };

  it('hands the xp of the assessment and its sub-topic to the gamification step, inside the grading transaction', async () => {
    const { service, tx, gamify } = build(lessonQuiz, { source: 'LESSON', conceptIds: ['c1', 'c2'] });

    await submit(service, { q1: 'A', q2: 'A' });

    expect(gamify.afterAssessment).toHaveBeenCalledTimes(1);
    expect(gamify.afterAssessment).toHaveBeenCalledWith({ userId: 'user-1', subTopicId: 'sub-1', at: expect.any(Date), xpGained: 8 }, tx);
  });

  it('returns what the gamification step reports next to the grade', async () => {
    const { service } = build(lessonQuiz);

    const result = await submit(service, { q1: 'A', q2: 'A' });

    expect(result.gamify).toMatchObject({ xpGained: 8, streak: { current: 1, extended: true } });
    expect(result.score).toBe(100);
  });

  it('does nothing for a submission with a hint, for a quiz without approved concepts, and omits the field', async () => {
    const hinted = build(lessonQuiz);
    const hintedResult = await submit(hinted.service, { q1: 'A', q2: 'A' }, true);
    expect(hinted.gamify.afterAssessment).not.toHaveBeenCalled();
    expect(hintedResult).not.toHaveProperty('gamify');

    const unlinked = build({ topicId: 'topic-1' }, { source: 'NONE', conceptIds: [] });
    const unlinkedResult = await submit(unlinked.service, { q1: 'A', q2: 'A' });
    expect(unlinked.gamify.afterAssessment).not.toHaveBeenCalled();
    expect(unlinkedResult).not.toHaveProperty('gamify');
  });

  it('fails the whole submission when the gamification step fails, so the grade, the evidence and the reward roll back together', async () => {
    const { service, gamify, misconception } = build(lessonQuiz);
    gamify.afterAssessment.mockRejectedValueOnce(new Error('streak down'));

    await expect(submit(service, { q1: 'A', q2: 'B' })).rejects.toThrow('streak down');

    expect(misconception.recordFromAnswer).not.toHaveBeenCalled();
  });
});
