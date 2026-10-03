import { Injectable, Optional } from '@nestjs/common';
import { Query } from '@/common/interfaces';
import { errorHandler } from '@/common/lib/utils';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { UserStepsRepo } from './user-steps.repo';
import { CreateUserStepType, UpdateUserStepType } from './user-steps.dto';
import { EventLogService } from '@/v1/analytics/events/event-log.service';

const LEVEL_FALLBACK_TOPIC_ID = 'l1-t01-accounting-equation';

@Injectable()
export class UserStepsService {
  constructor(
    private readonly userStepsRepo: UserStepsRepo,
    @Optional() private readonly events?: EventLogService,
  ) {}

  placeDiagnostic(answers: string[]): {
    recommendedLevel: number;
    recommendedTopicId: string;
    confidence: number;
  } {
    if (!Array.isArray(answers) || answers.length === 0) {
      return {
        recommendedLevel: 1,
        recommendedTopicId: LEVEL_FALLBACK_TOPIC_ID,
        confidence: 0,
      };
    }
    const correct = answers.filter((a) => a === 'A').length;
    const score = correct / answers.length;
    let recommendedLevel = 1;
    if (score >= 0.8) recommendedLevel = 4;
    else if (score >= 0.6) recommendedLevel = 3;
    else if (score >= 0.4) recommendedLevel = 2;

    return {
      recommendedLevel,
      recommendedTopicId: LEVEL_FALLBACK_TOPIC_ID,
      confidence: score,
    };
  }

  create(values: CreateUserStepType) {
    return errorHandler(async () => {
      const newStep = await this.userStepsRepo.create(values);
      return {
        message: 'Successfully created new user step',
        data: newStep,
      };
    });
  }

  findAll(q: Query) {
    return errorHandler(async () => {
      const result = await this.userStepsRepo.findAll(q);
      return {
        message: 'Successfully retrieved user steps',
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

  findOne(id: string, q: Query) {
    return errorHandler(async () => {
      const userStep = await this.userStepsRepo.findOne('id', id, q);
      if (!userStep) {
        throw new AppError('User step not found', 404, AppErrorCode.NOT_FOUND);
      }
      return {
        message: 'Successfully retrieved user step',
        data: userStep,
      };
    });
  }

  update(id: string, values: UpdateUserStepType) {
    return errorHandler(async () => {
      const findStep = await this.userStepsRepo.findOne('id', id);
      if (!findStep) {
        throw new AppError('User step not found', 404, AppErrorCode.NOT_FOUND);
      }
      await this.userStepsRepo.update(id, values);
      return {
        message: 'Successfully updated user step',
        data: null,
      };
    });
  }

  complete(id:string){
    return errorHandler(async()=>{
      const complete=await this.userStepsRepo.complete(id)
      if (this.events) {
        const step = await this.userStepsRepo.findOne('id', id);
        if (step?.userId) {
          await this.events.record({
            userId: step.userId,
            action: 'LESSON_COMPLETED',
            entityId: id,
            metadata: { stepId: id },
          });
        }
      }
      return {
        message:'Nice congratulation',
        data:complete
      }
    })
  }
  remove(id: string) {
    return errorHandler(async () => {
      const findStep = await this.userStepsRepo.findOne('id', id);
      if (!findStep) {
        throw new AppError('User step not found', 404, AppErrorCode.NOT_FOUND);
      }
      await this.userStepsRepo.delete(id);
      return {
        message: 'Successfully deleted user step',
        data: null,
      };
    });
  }
}
