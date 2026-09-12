import { Injectable } from '@nestjs/common';
import { Query } from '@/common/interfaces';
import { errorHandler } from '@/common/lib/utils';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { StepProgressesRepo } from './step-progresses.repo';
import {
  CreateStepProgressType,
  UpdateStepProgressType,
} from './step-progresses.dto';

@Injectable()
export class StepProgressesService {
  constructor(private readonly stepProgressesRepo: StepProgressesRepo) {}

  create(values: CreateStepProgressType) {
    return errorHandler(async () => {
      const newData = await this.stepProgressesRepo.create(values);
      return {
        message: 'Successfully created new step progress',
        data: newData,
      };
    });
  }

  findAll(q: Query) {
    return errorHandler(async () => {
      const result = await this.stepProgressesRepo.findAll(q);
      return {
        message: 'Successfully retrieved step progresses',
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
      const data = await this.stepProgressesRepo.findOne('id', id, q);
      if (!data) {
        throw new AppError('Step progress not found', 404, AppErrorCode.NOT_FOUND);
      }
      return {
        message: 'Successfully retrieved step progress',
        data,
      };
    });
  }

  update(id: string, values: UpdateStepProgressType) {
    return errorHandler(async () => {
      const existing = await this.stepProgressesRepo.findOne('id', id);
      if (!existing) {
        throw new AppError('Step progress not found', 404, AppErrorCode.NOT_FOUND);
      }

      await this.stepProgressesRepo.update(id, values);

      return {
        message: 'Successfully updated step progress',
        data: null,
      };
    });
  }

  remove(id: string) {
    return errorHandler(async () => {
      const existing = await this.stepProgressesRepo.findOne('id', id);
      if (!existing) {
        throw new AppError('Step progress not found', 404, AppErrorCode.NOT_FOUND);
      }

      await this.stepProgressesRepo.delete(id);

      return {
        message: 'Successfully deleted step progress',
        data: null,
      };
    });
  }
}
