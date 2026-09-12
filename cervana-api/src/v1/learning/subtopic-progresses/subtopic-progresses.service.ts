import { Injectable } from '@nestjs/common';
import { Query } from '@/common/interfaces';
import { errorHandler } from '@/common/lib/utils';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { SubtopicProgressesRepo } from './subtopic-progresses.repo';
import { CreateSubTopicProgressType, UpdateSubTopicProgressType } from './subtopic-progresses.dto';

@Injectable()
export class SubtopicProgressesService {
  constructor(private readonly subtopicProgressesRepo: SubtopicProgressesRepo) {}

  create(values: CreateSubTopicProgressType) {
    return errorHandler(async () => {
      const newProgress = await this.subtopicProgressesRepo.create(values);
      return {
        message: 'Successfully created new subtopic progress',
        data: newProgress,
      };
    });
  }

  findAll(q: Query) {
    return errorHandler(async () => {
      const result = await this.subtopicProgressesRepo.findAll(q);
      return {
        message: 'Successfully retrieved subtopic progresses',
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
      const subtopicProgress = await this.subtopicProgressesRepo.findOne('id', id, q);
      if (!subtopicProgress) {
        throw new AppError('Subtopic progress not found', 404, AppErrorCode.NOT_FOUND);
      }
      return {
        message: 'Successfully retrieved subtopic progress',
        data: subtopicProgress,
      };
    });
  }

  update(id: string, values: UpdateSubTopicProgressType) {
    return errorHandler(async () => {
      const findProgress = await this.subtopicProgressesRepo.findOne('id', id);
      if (!findProgress) {
        throw new AppError('Subtopic progress not found', 404, AppErrorCode.NOT_FOUND);
      }
      await this.subtopicProgressesRepo.update(id, values);
      return {
        message: 'Successfully updated subtopic progress',
        data: null,
      };
    });
  }

  remove(id: string) {
    return errorHandler(async () => {
      const findProgress = await this.subtopicProgressesRepo.findOne('id', id);
      if (!findProgress) {
        throw new AppError('Subtopic progress not found', 404, AppErrorCode.NOT_FOUND);
      }
      await this.subtopicProgressesRepo.delete(id);
      return {
        message: 'Successfully deleted subtopic progress',
        data: null,
      };
    });
  }
}