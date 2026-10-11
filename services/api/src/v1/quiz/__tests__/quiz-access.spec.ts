import { AppErrorCode } from '@/common/lib/error';
import { decideQuizAccess } from '@/v1/quiz/quiz-access';
import { QuizAccessService } from '@/v1/quiz/quiz-access.service';

const student = { id: 'u-1', role: 'STUDENT' };
const base = { exists: true, progressOwnerIds: [] as string[], topicId: 'topic-1' as string | null };

describe('decideQuizAccess', () => {
  it('says not found for a quiz that does not exist, whoever asks', () => {
    expect(decideQuizAccess(student, { ...base, exists: false }, true)).toBe('not-found');
    expect(decideQuizAccess({ id: 'a', role: 'ADMIN' }, { ...base, exists: false }, true)).toBe('not-found');
  });

  it('lets admins and teachers through', () => {
    expect(decideQuizAccess({ id: 'a', role: 'ADMIN' }, base, false)).toBe('allow');
    expect(decideQuizAccess({ id: 't', role: 'TEACHER' }, { ...base, progressOwnerIds: ['u-9'] }, false)).toBe('allow');
  });

  it("gives a quiz that belongs to someone's progress only to that someone", () => {
    expect(decideQuizAccess(student, { ...base, progressOwnerIds: ['u-1'] }, false)).toBe('allow');
    expect(decideQuizAccess(student, { ...base, progressOwnerIds: ['u-2'] }, true)).toBe('not-owner');
  });

  it('gives a template quiz to a learner enrolled in its topic and to nobody else', () => {
    expect(decideQuizAccess(student, base, true)).toBe('allow');
    expect(decideQuizAccess(student, base, false)).toBe('not-enrolled');
  });

  it('refuses a template quiz that is attached to no topic', () => {
    expect(decideQuizAccess(student, { ...base, topicId: null }, true)).toBe('not-enrolled');
  });
});

describe('QuizAccessService.assertCanTake', () => {
  const build = (quiz: unknown, enrolled = 0) => {
    const prisma = {
      quiz: { findUnique: jest.fn().mockResolvedValue(quiz) },
      userTopic: { count: jest.fn().mockResolvedValue(enrolled) },
    };
    return { service: new QuizAccessService(prisma as any), prisma };
  };

  const template = {
    topicId: null,
    subTopic: null,
    lesson: { subTopic: { topicId: 'topic-1' } },
    step: null,
    topicProgress: null,
    subTopicProgress: null,
    lessonProgress: null,
    stepProgress: null,
    userStepProgress: null,
  };

  it('resolves the topic through the lesson and checks the learner is enrolled in it', async () => {
    const { service, prisma } = build(template, 1);

    await expect(service.assertCanTake(student, 'q-1')).resolves.toBeUndefined();
    expect(prisma.userTopic.count).toHaveBeenCalledWith({ where: { userId: 'u-1', topicId: 'topic-1' } });
  });

  it('answers 403 with the entitlement code when the learner never unlocked the topic', async () => {
    const { service } = build(template, 0);

    await expect(service.assertCanTake(student, 'q-1')).rejects.toMatchObject({ statusCode: 403, code: AppErrorCode.ENTITLEMENT_REQUIRED });
  });

  it("answers 403 for a quiz in somebody else's progress", async () => {
    const { service } = build({ ...template, lessonProgress: { userId: 'u-2' } }, 1);

    await expect(service.assertCanTake(student, 'q-1')).rejects.toMatchObject({ statusCode: 403, code: AppErrorCode.OWNERSHIP_DENIED });
  });

  it('answers 404 for an unknown quiz', async () => {
    const { service } = build(null);

    await expect(service.assertCanTake(student, 'q-1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('does not query enrolment for an admin', async () => {
    const { service, prisma } = build(template, 0);

    await expect(service.assertCanTake({ id: 'a', role: 'ADMIN' }, 'q-1')).resolves.toBeUndefined();
    expect(prisma.userTopic.count).not.toHaveBeenCalled();
  });
});
