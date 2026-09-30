import { PrismaService } from '@/common/config/prisma/prisma.service';

export const UNOWNED = Symbol('UNOWNED');

export type OwnerLookup = string | null | typeof UNOWNED;

export type OwnedResource =
  | 'user'
  | 'chat'
  | 'content'
  | 'user-step'
  | 'message'
  | 'lesson-progress'
  | 'subtopic-progress'
  | 'step-progress'
  | 'user-topic'
  | 'quiz-attempt'
  | 'answer'
  | 'quiz'
  | 'question'
  | 'personality-quiz'
  | 'learning-style'
  | 'notification'
  | 'daily-log'
  | 'streak'
  | 'teacher-application'
  | 'teacher-experience'
  | 'teacher-certification'
  | 'payment-intent';

type Resolver = (prisma: PrismaService, id: string) => Promise<OwnerLookup>;

const direct =
  (model: keyof PrismaService): Resolver =>
  async (prisma, id) => {
    const row = await (prisma[model] as any).findUnique({ where: { id }, select: { userId: true } });
    return row?.userId ?? null;
  };

const quizOwner = (quiz: any): OwnerLookup => {
  if (!quiz) return null;
  const owner =
    quiz.topicProgress?.userId ??
    quiz.subTopicProgress?.userId ??
    quiz.lessonProgress?.userId ??
    quiz.stepProgress?.userId ??
    quiz.userStepProgress?.userId;
  return owner ?? UNOWNED;
};

const quizSelect = {
  topicProgress: { select: { userId: true } },
  subTopicProgress: { select: { userId: true } },
  lessonProgress: { select: { userId: true } },
  stepProgress: { select: { userId: true } },
  userStepProgress: { select: { userId: true } },
};

export const OWNER_RESOLVERS: Record<OwnedResource, Resolver> = {
  user: async (_prisma, id) => id,
  chat: async (prisma, id) => {
    const chat = await prisma.chat.findUnique({
      where: { id },
      select: { userStep: { select: { userId: true } } },
    });
    return chat?.userStep?.userId ?? null;
  },
  content: async (prisma, id) => {
    const content = await prisma.content.findUnique({
      where: { id },
      select: {
        chat: { select: { userStep: { select: { userId: true } } } },
        message: { select: { chat: { select: { userStep: { select: { userId: true } } } } } },
      },
    });
    return (
      content?.chat?.userStep?.userId ??
      content?.message?.chat?.userStep?.userId ??
      null
    );
  },
  'user-step': direct('userStep'),
  message: async (prisma, id) => {
    const message = await prisma.chatMessage.findUnique({
      where: { id },
      select: { chat: { select: { userStep: { select: { userId: true } } } } },
    });
    return message?.chat?.userStep?.userId ?? null;
  },
  'lesson-progress': direct('lessonProgress'),
  'subtopic-progress': direct('subTopicProgress'),
  'step-progress': direct('stepProgress'),
  'user-topic': direct('userTopic'),
  'quiz-attempt': direct('quizAttempt'),
  answer: async (prisma, id) => {
    const answer = await prisma.answer.findUnique({
      where: { id },
      select: { attempt: { select: { userId: true } } },
    });
    return answer?.attempt?.userId ?? null;
  },
  quiz: async (prisma, id) =>
    quizOwner(await prisma.quiz.findUnique({ where: { id }, select: quizSelect })),
  question: async (prisma, id) => {
    const question = await prisma.question.findUnique({
      where: { id },
      select: { quiz: { select: quizSelect } },
    });
    return question ? quizOwner(question.quiz) : null;
  },
  'personality-quiz': direct('personalityQuiz'),
  'learning-style': async (prisma, id) => {
    const profile = await prisma.learningStyleProfile.findUnique({
      where: { id },
      select: { userTopic: { select: { userId: true } } },
    });
    return profile?.userTopic?.userId ?? null;
  },
  notification: async (prisma, id) => {
    const row = await prisma.notification.findUnique({
      where: { id },
      select: { userId: true, isGlobal: true },
    });
    if (!row) return null;
    return row.userId ?? UNOWNED;
  },
  'daily-log': direct('dailyActivityLog'),
  streak: direct('streakHistory'),
  'teacher-application': direct('teacherApplication'),
  'teacher-experience': async (prisma, id) => {
    const row = await prisma.teacherExperience.findUnique({
      where: { id },
      select: { teacherApplication: { select: { userId: true } } },
    });
    return row?.teacherApplication?.userId ?? null;
  },
  'teacher-certification': async (prisma, id) => {
    const row = await prisma.certification.findUnique({
      where: { id },
      select: { teacherApplication: { select: { userId: true } } },
    });
    return row?.teacherApplication?.userId ?? null;
  },
  'payment-intent': async (prisma, id) => {
    const row = await prisma.paymentIntent.findUnique({
      where: { id },
      select: { order: { select: { userId: true } } },
    });
    return row?.order?.userId ?? null;
  },
};
