import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { decideQuizAccess, QuizAccessActor, QuizAccessFacts } from './quiz-access';

const progressOwner = { select: { userId: true } };

const factsOf = (quiz: any): QuizAccessFacts => {
  if (!quiz) return { exists: false, progressOwnerIds: [], topicId: null };
  const owners = [quiz.topicProgress, quiz.subTopicProgress, quiz.lessonProgress, quiz.stepProgress, quiz.userStepProgress]
    .map((progress) => progress?.userId as string | undefined)
    .filter((id): id is string => Boolean(id));
  const topicId: string | null =
    quiz.topicId ?? quiz.subTopic?.topicId ?? quiz.lesson?.subTopic?.topicId ?? quiz.step?.lesson?.subTopic?.topicId ?? null;
  return { exists: true, progressOwnerIds: owners, topicId };
};

@Injectable()
export class QuizAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanTake(actor: QuizAccessActor, quizId: string): Promise<void> {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      select: {
        topicId: true,
        subTopic: { select: { topicId: true } },
        lesson: { select: { subTopic: { select: { topicId: true } } } },
        step: { select: { lesson: { select: { subTopic: { select: { topicId: true } } } } } },
        topicProgress: progressOwner,
        subTopicProgress: progressOwner,
        lessonProgress: progressOwner,
        stepProgress: progressOwner,
        userStepProgress: progressOwner,
      },
    });
    const facts = factsOf(quiz);
    const needsEnrolment = facts.exists && facts.progressOwnerIds.length === 0 && facts.topicId !== null && !['ADMIN', 'TEACHER'].includes(actor.role);
    const enrolled = needsEnrolment
      ? (await this.prisma.userTopic.count({ where: { userId: actor.id, topicId: facts.topicId as string } })) > 0
      : false;

    switch (decideQuizAccess(actor, facts, enrolled)) {
      case 'allow':
        return;
      case 'not-found':
        throw new AppError('Quiz not found', 404, AppErrorCode.NOT_FOUND);
      case 'not-owner':
        throw new AppError('Not the quiz owner', 403, AppErrorCode.OWNERSHIP_DENIED);
      default:
        throw new AppError('Unlock the topic to take this quiz', 403, AppErrorCode.ENTITLEMENT_REQUIRED);
    }
  }
}
