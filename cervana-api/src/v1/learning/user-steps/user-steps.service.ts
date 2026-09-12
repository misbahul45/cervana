import { Injectable } from '@nestjs/common';
import { Query } from '@/common/interfaces';
import { errorHandler } from '@/common/lib/utils';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { UserStepsRepo } from './user-steps.repo';
import { CreateUserStepType, UpdateUserStepType } from './user-steps.dto';

@Injectable()
export class UserStepsService {
  constructor(private readonly userStepsRepo: UserStepsRepo) {}

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
