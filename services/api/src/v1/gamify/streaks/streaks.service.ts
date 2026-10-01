import { Injectable } from '@nestjs/common';
import { StreaksRepo } from './streaks.repo';
import { Query } from '@/common/interfaces';
import { errorHandler } from '@/common/lib/utils';
import { AppError } from '@/common/lib/error';

@Injectable()
export class StreaksService {
  constructor(private readonly streaksRepo: StreaksRepo) {}

  findAll(q: Query = {}) {
    return errorHandler(async () => {
      const result = await this.streaksRepo.findAll(q);

      return {
        message: 'Successfully retrieved streak histories',
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

  findLatestStreak(userId: string) {
    return errorHandler(async () => {
      const result = await this.streaksRepo.findLast(userId);

      return {
        message: 'Successfully retrieved latest streak history',
        data: result,
      };
    });
  }

  findByUser(userId: string, q: Query = {}) {
    return errorHandler(async () => {
      const result = await this.streaksRepo.findByUser(userId, q);

      return {
        message: 'Successfully retrieved user streak histories',
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

  remove(id: string) {
    return errorHandler(async () => {
      const streak = await this.streaksRepo.findOne('id', id);
      if (!streak) throw new AppError('Streak history not found', 404);

      await this.streaksRepo.delete(id);

      return {
        message: 'Successfully deleted streak history',
        data:null
      };
    });
  }
}

