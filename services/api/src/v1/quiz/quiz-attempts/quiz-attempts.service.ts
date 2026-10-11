import { Injectable, Optional } from '@nestjs/common';
import {
  CreateQuizAttemptType,
  StartQuizAttemptDtoType,
  SubmitQuizAttemptDtoType,
} from './quizAttempets.dto';
import { errorHandler } from '@/common/lib/utils';
import { Query } from '@/common/interfaces';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { QuizAttemptsRepo } from './quiz-attempts.repo';
import { MisconceptionService } from '@/v1/personalization/misconception/misconception.service';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { EventLogService } from '@/v1/analytics/events/event-log.service';
import { QuizEvaluationService } from '@/v1/quiz/services/quiz-evaluation.service';
import { AttemptStatus, Prisma } from '@prisma/client';
import { ConceptRegistryService } from '@/v1/learner-model/concepts/concept-registry.service';
import { LearnerEventsService } from '@/v1/learner-model/events/learner-events.service';
import { RewardEngineService } from '@/v1/gamify/rewards/reward-engine.service';
import { AssessmentGamifyOutcome, AssessmentGamifyService } from '@/v1/gamify/assessment-gamify.service';
import { QuizAccessService } from '../quiz-access.service';

@Injectable()
export class QuizAttemptsService {
  constructor(
    private readonly quizAttempetsRepo: QuizAttemptsRepo,
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly misconception?: MisconceptionService,
    @Optional() private readonly events?: EventLogService,
    @Optional() private readonly evaluator?: QuizEvaluationService,
    @Optional() private readonly concepts?: ConceptRegistryService,
    @Optional() private readonly learnerEvents?: LearnerEventsService,
    @Optional() private readonly rewards?: RewardEngineService,
    @Optional() private readonly gamify?: AssessmentGamifyService,
    @Optional() private readonly access?: QuizAccessService,
  ) {}

  create(values: CreateQuizAttemptType) {
    return errorHandler(async()=>{
      const newQuizAttempt=await this.quizAttempetsRepo.create(values)

      return {
        message:'Successfully created quizAttempt',
        data:newQuizAttempt
      }
    })
  }

  async startAttempt(
    actor: { id: string; role: string },
    dto: StartQuizAttemptDtoType,
  ) {
    const prisma = this.prisma;
    if (!prisma) {
      throw new AppError(
        'Prisma is not available',
        500,
        AppErrorCode.INTERNAL_SERVER_ERROR,
      );
    }
    return errorHandler(async () => {
      await this.access?.assertCanTake(actor, dto.quizId);
      const lastAttempt = await prisma.quizAttempt.findFirst({
        where: { userId: actor.id, quizId: dto.quizId },
        orderBy: { attemptNumber: 'desc' },
      });
      const nextAttemptNumber = (lastAttempt?.attemptNumber ?? 0) + 1;

      const attempt = await prisma.quizAttempt.create({
        data: {
          userId: actor.id,
          quizId: dto.quizId,
          attemptNumber: nextAttemptNumber,
          status: AttemptStatus.IN_PROGRESS,
          score: null,
        },
      });

      return {
        message: 'Successfully started quiz attempt',
        data: attempt,
      };
    });
  }

  async submitAttempt(input: {
    userId: string;
    attemptId: string;
    answers: Record<string, unknown>;
    hintUsed?: boolean;
  }): Promise<{ isCorrect: Record<string, boolean>; score: number; gamify?: AssessmentGamifyOutcome }> {
    if (!this.prisma) {
      throw new AppError('Prisma is not available', 500, AppErrorCode.INTERNAL_SERVER_ERROR);
    }
    if (!this.evaluator) {
      throw new AppError('Evaluator is not available', 500, AppErrorCode.INTERNAL_SERVER_ERROR);
    }
    const prisma = this.prisma;
    const evaluator = this.evaluator;

    const result = await prisma.$transaction(async (tx) => {
      const attempt = await tx.quizAttempt.findUnique({ where: { id: input.attemptId } });
      if (!attempt) {
        throw new AppError('Quiz attempt not found', 404, AppErrorCode.NOT_FOUND);
      }
      if (attempt.userId !== input.userId) {
        throw new AppError('Quiz attempt not found', 404, AppErrorCode.NOT_FOUND);
      }
      if (attempt.status === AttemptStatus.COMPLETED) {
        throw new AppError('Quiz attempt already submitted', 409, AppErrorCode.INVALID_STATE_TRANSITION);
      }

      const quiz = await tx.quiz.findUnique({
        where: { id: attempt.quizId },
        select: {
          id: true,
          topicId: true,
          lessonId: true,
          subTopicId: true,
          subTopic: { select: { topicId: true } },
          lesson: { select: { subTopicId: true, subTopic: { select: { topicId: true } } } },
          step: { select: { lessonId: true, lesson: { select: { subTopicId: true, subTopic: { select: { topicId: true } } } } } },
          questions: { select: { id: true, questionType: true, correctAnswer: true, options: true, points: true } },
        },
      });
      if (!quiz) {
        throw new AppError('Quiz not found', 404, AppErrorCode.NOT_FOUND);
      }

      const questionMap = new Map(quiz.questions.map((q) => [q.id, q]));
      let scoreTotal = 0;
      let pointsTotal = 0;
      const perAnswer: { questionId: string; isCorrect: boolean; pointsEarned: number; patternCode: string | null }[] = [];

      for (const q of quiz.questions) {
        pointsTotal += q.points;
        const userAnswer = input.answers[q.id];
        const evaluation = evaluator.evaluate({
          questionType: q.questionType,
          userAnswer,
          correctAnswer: q.correctAnswer as unknown,
          options: q.options,
          points: q.points,
          hintUsed: input.hintUsed,
        });
        scoreTotal += evaluation.pointsEarned;
        perAnswer.push({
          questionId: q.id,
          isCorrect: evaluation.isCorrect,
          pointsEarned: evaluation.pointsEarned,
          patternCode: evaluation.isCorrect ? null : this.classifyPattern(q.questionType, userAnswer, q.correctAnswer as unknown),
        });
        await tx.answer.upsert({
          where: { attemptId_questionId: { attemptId: attempt.id, questionId: q.id } },
          create: {
            attemptId: attempt.id,
            questionId: q.id,
            userAnswer: userAnswer as any,
            isCorrect: evaluation.isCorrect,
            pointsEarned: evaluation.pointsEarned,
          },
          update: {
            userAnswer: userAnswer as any,
            isCorrect: evaluation.isCorrect,
            pointsEarned: evaluation.pointsEarned,
          },
        } as unknown as Parameters<typeof tx.answer.upsert>[0]);
      }

      const scorePercent = pointsTotal > 0 ? Math.round((scoreTotal / pointsTotal) * 100) : 0;

      await tx.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          status: AttemptStatus.COMPLETED,
          score: scorePercent,
        },
      });

      let gamify: AssessmentGamifyOutcome | undefined;
      if (!input.hintUsed && pointsTotal > 0) {
        gamify = await this.appendLearningEvidence(tx, {
          userId: input.userId,
          attemptId: attempt.id,
          attemptNumber: attempt.attemptNumber,
          quizId: quiz.id,
          score: scoreTotal / pointsTotal,
          items: quiz.questions.length,
          lessonId: quiz.lessonId ?? quiz.step?.lessonId ?? null,
          subTopicId: quiz.subTopicId ?? quiz.lesson?.subTopicId ?? quiz.step?.lesson.subTopicId ?? null,
          topicId: quiz.topicId ?? quiz.subTopic?.topicId ?? quiz.lesson?.subTopic.topicId ?? quiz.step?.lesson.subTopic.topicId ?? null,
        });
      }

      const isCorrectMap: Record<string, boolean> = {};
      for (const a of perAnswer) {
        isCorrectMap[a.questionId] = a.isCorrect;
      }

      return { score: scorePercent, isCorrect: isCorrectMap, perAnswer, topicId: quiz.topicId, gamify };
    });

    const misconception = this.misconception;
    if (misconception) {
      for (const a of result.perAnswer) {
        if (!a.isCorrect && a.patternCode) {
          const userAnswerForRecord = input.answers[a.questionId];
          await misconception.recordFromAnswer({
            userId: input.userId,
            topicId: result.topicId ?? '',
            questionId: a.questionId,
            userAnswer: typeof userAnswerForRecord === 'string' ? userAnswerForRecord : JSON.stringify(userAnswerForRecord ?? null),
            correctAnswer: '',
            isCorrect: false,
          });
        }
      }
    }

    const events = this.events;
    if (events) {
      await events.record({
        userId: input.userId,
        action: 'QUIZ_SUBMITTED',
        entityId: input.attemptId,
        metadata: { score: result.score, answerCount: result.perAnswer.length },
      });
    }

    return { isCorrect: result.isCorrect, score: result.score, ...(result.gamify ? { gamify: result.gamify } : {}) };
  }

  private async appendLearningEvidence(
    tx: Prisma.TransactionClient,
    evidence: {
      userId: string;
      attemptId: string;
      attemptNumber: number;
      quizId: string;
      score: number;
      items: number;
      lessonId: string | null;
      subTopicId: string | null;
      topicId: string | null;
    },
  ): Promise<AssessmentGamifyOutcome | undefined> {
    if (!this.concepts || !this.learnerEvents) return undefined;
    const { conceptIds } = await this.concepts.conceptsForCurriculum({
      lessonId: evidence.lessonId,
      subTopicId: evidence.subTopicId,
    });
    let xpGained = 0;
    for (const conceptId of conceptIds) {
      const stored = await this.learnerEvents.append(
        {
          userId: evidence.userId,
          conceptId,
          idempotencyKey: `assessment:${evidence.attemptId}:${conceptId}`,
          payload: {
            attemptId: evidence.attemptId,
            quizId: evidence.quizId,
            score: evidence.score,
            items: evidence.items,
            hintsUsed: 0,
            share: 1 / conceptIds.length,
            attemptNumber: evidence.attemptNumber,
          },
        },
        tx,
      );
      const rewarded = await this.rewards?.onAssessment(
        {
          userId: evidence.userId,
          conceptId,
          eventId: stored.eventId,
          duplicate: stored.duplicate,
          after: stored.state,
          topicId: evidence.topicId ?? undefined,
          subTopicId: evidence.subTopicId ?? undefined,
        },
        tx,
      );
      xpGained += rewarded?.points ?? 0;
    }
    if (conceptIds.length === 0 || !this.gamify) return undefined;
    return this.gamify.afterAssessment({ userId: evidence.userId, subTopicId: evidence.subTopicId, at: new Date(), xpGained }, tx);
  }

  findOne(id: string, q:Query) {
    return errorHandler(async()=>{
      const quizAttempet=await this.quizAttempetsRepo.findOne('id', id, q)

      if(!quizAttempet?.id){
        throw new AppError('Quiz attempt not found', 404)
      }

      return {
        message:'Successfully retrieved quiz attempt',
        data:quizAttempet
      }
    })
  }

  findByQuiz(quizId: string, q: Query) {
    return errorHandler(async() => {
      const result = await this.quizAttempetsRepo.findAll(quizId, q);
      return {
        message: 'Successfully listed quiz attempts',
        data: result,
      };
    });
  }

  update(id: string, values: unknown) {
    return errorHandler(async()=>{
      const updateQuizAttempt=await this.quizAttempetsRepo.update(id, values)

      if(!updateQuizAttempt.id){
        throw new AppError('Quiz attempt not found', 404)
      }

      return{
        message:'Successfully update quiz attempt',
        data:null
      }
    })
  }

  remove(id: string) {
    return errorHandler(async()=>{
      const deleteQuizAttempt=await this.quizAttempetsRepo.delete(id)

      if(!deleteQuizAttempt?.id){
        throw new AppError('Quiz attempt not found', 404)
      }
      return{
        message:'Successfully delete quiz attempt',
        data:null
      }
    })
  }

  findAllAnswer(quizAttemptId:string, q:Query){
    return errorHandler(async()=>{
      const result=await this.quizAttempetsRepo.findAll(quizAttemptId, q)
      return{
        message:'Successfully retrieved answers',
        data:{
          data:result.data,
          pagination: {
            page: result.meta.page,
            limit: result.meta.limit,
            total: result.meta.total,
            totalPages: result.meta.totalPages
          }
        }
      }
    })
  }

  private classifyPattern(questionType: string, userAnswer: unknown, correctAnswer: unknown): string | null {
    if (questionType === 'MULTIPLE_CHOICE') {
      if (typeof userAnswer === 'string' && typeof correctAnswer === 'string') {
        return userAnswer.trim() === correctAnswer.trim() ? null : 'wrong_multiple_choice';
      }
    }
    return 'wrong_answer';
  }
}
