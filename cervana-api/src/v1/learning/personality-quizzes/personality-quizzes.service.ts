import { Injectable } from '@nestjs/common';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { errorHandler } from '@/common/lib/utils';
import { Query } from '@/common/interfaces';

import { PersonalityQuizzesRepo } from './personality-quizzes.repo';
import { CreatePersonalityQuizType, UpdatePersonalityQuizType, PersonalityQuizUserAttemptSchema, PersonalityQuizResultSchema } from './personality-quizzes.dto';
import z from 'zod';
import { QueueService } from '@/v1/queue/queue.service';

@Injectable()
export class PersonalityQuizzesService {
  constructor(
    private readonly personalityQuizzesRepo: PersonalityQuizzesRepo,
    private readonly queueService: QueueService,
  ) {}

  create(values: CreatePersonalityQuizType) {
    return errorHandler(async () => {
      const quiz = await this.personalityQuizzesRepo.create(values);

      return {
        message: 'Successfully created new personality quiz',
        data: quiz,
      };
    });
  }

  findAll(userId: string, q: Query) {
    return errorHandler(async () => {
      const result = await this.personalityQuizzesRepo.findAll(userId, q);

      return {
        message: 'Successfully retrieved personality quizzes',
        data: {
          data: result.data,
          pagination: {
            page: result.meta.page,
            limit: result.meta.limit,
            total: result.meta.total,
            totalPages: result.meta.totalPages,
          },
        },
      };
    });
  }

  findOne(id: string, q?: Query) {
    return errorHandler(async () => {
      const quiz = await this.personalityQuizzesRepo.findOne('id', id, q);

      if (!quiz) {
        throw new AppError(
          'Personality quiz not found',
          404,
          AppErrorCode.NOT_FOUND
        );
      }

      return {
        message: 'Successfully retrieved personality quiz',
        data: quiz,
      };
    });
  }

  update(id: string, values: UpdatePersonalityQuizType) {
    return errorHandler(async () => {
      const quiz = await this.personalityQuizzesRepo.findOne('id', id);

      if (!quiz) {
        throw new AppError(
          'Personality quiz not found',
          404,
          AppErrorCode.NOT_FOUND
        );
      }

      const updatedQuiz = await this.personalityQuizzesRepo.update(id, values);

      return {
        message: 'Successfully updated personality quiz',
        data: updatedQuiz,
      };
    });
  }

  remove(id: string) {
    return errorHandler(async () => {
      const quiz = await this.personalityQuizzesRepo.findOne('id', id);

      if (!quiz) {
        throw new AppError(
          'Personality quiz not found',
          404,
          AppErrorCode.NOT_FOUND
        );
      }

      await this.personalityQuizzesRepo.delete(id);

      return {
        message: 'Successfully deleted personality quiz',
        data: null,
      };
    });
  }

  submitAttempt(data:{
    userId: string
    token: string
    topicId: string
    lessonId: string
    learningStyleId: string
    quizId:string
  }, values: z.infer<typeof PersonalityQuizUserAttemptSchema>) {
    return errorHandler(async () => {
      const quiz = await this.personalityQuizzesRepo.findOne("id", data.quizId);
      if (!quiz) {
        throw new AppError(
          "Personality quiz not found",
          404,
          AppErrorCode.NOT_FOUND
        );
      }

      const scores: Record<string, number> = {};

      values.forEach((item) => {
        if (!item.answer) return;

        const category = item.answer.trim();
        if (!scores[category]) scores[category] = 0;

        if (item.userAnswer.trim() === item.answer.trim()) {
          scores[category] += 1;
        }
      });

      const maxScore = values.length;
      const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
      const percentage = (totalScore / maxScore) * 100;

      const level =
        percentage <= 50
          ? "beginner"
          : percentage <= 70
          ? "intermediate"
          : percentage <= 90
          ? "advanced"
          : "expert";
      const normalizedScores: Record<string, number> = {};
      Object.keys(scores).forEach((key) => {
        normalizedScores[key] = scores[key] * 10;
      });

      const result: z.infer<typeof PersonalityQuizResultSchema> = {
        scores: normalizedScores,
        level,
      };

      const submitAnswer = await this.personalityQuizzesRepo.update(data.quizId, {
        userAttempt: values,
        result,
        takenAt:new Date()
      });
      
      await this.queueService.addUserStepsJob({
        ...data
      })

      if (!submitAnswer) {
        throw new AppError("Personality quiz error", 400);
      }

      return {
        message: "successfully sending answer",
        data: submitAnswer,
      };
    });
  }
}
