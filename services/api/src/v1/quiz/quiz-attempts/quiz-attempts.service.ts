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
import { MasteryService } from '@/v1/personalization/mastery/mastery.service';
import { MisconceptionService } from '@/v1/personalization/misconception/misconception.service';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { EventLogService } from '@/v1/analytics/events/event-log.service';
import { QuizEvaluationService } from '@/v1/quiz/services/quiz-evaluation.service';
import { AttemptStatus } from '@prisma/client';

@Injectable()
export class QuizAttemptsService {
  constructor(
    private readonly quizAttempetsRepo: QuizAttemptsRepo,
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly mastery?: MasteryService,
    @Optional() private readonly misconception?: MisconceptionService,
    @Optional() private readonly events?: EventLogService,
    @Optional() private readonly evaluator?: QuizEvaluationService,
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
  }): Promise<{ updatedMastery: { topicId: string; score: number; attempts: number } | null; isCorrect: Record<string, boolean>; score: number; }> {
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
        select: { id: true, topicId: true, lessonId: true, questions: { select: { id: true, questionType: true, correctAnswer: true, options: true, points: true } } },
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

      const isCorrectMap: Record<string, boolean> = {};
      for (const a of perAnswer) {
        isCorrectMap[a.questionId] = a.isCorrect;
      }

      return { score: scorePercent, isCorrect: isCorrectMap, perAnswer, topicId: quiz.topicId };
    });

    let updatedMastery: { topicId: string; score: number; attempts: number } | null = null;
    if (result.topicId && this.mastery) {
      const masteryTopicId = result.topicId;
      const updated = await this.mastery.updateFromAttempt(input.userId, masteryTopicId, result.score);
      updatedMastery = { topicId: masteryTopicId, score: updated.score, attempts: updated.attempts };
    }

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

    return { updatedMastery, isCorrect: result.isCorrect, score: result.score };
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
