import { Injectable } from '@nestjs/common';
import { LeaderboardsRepo } from './leaderboards.repo';
import { Query } from '@/common/interfaces';
import { errorHandler } from '@/common/lib/utils';
import { AppError, AppErrorCode } from '@/common/lib/error';

@Injectable()
export class LeaderboardsService {
  constructor(private readonly leaderboardsRepo: LeaderboardsRepo) {}

  findAll(q: Query) {
    return errorHandler(async () => {
      const result = await this.leaderboardsRepo.findAll(q);

      return {
        message: 'Successfully retrieved leaderboard data',
        data: result.data,
        pagination: {
          page: result.meta.page,
          limit: result.meta.limit,
          total: result.meta.total,
          totalPages: result.meta.totalPages,
        },
      };
    });
  }

  findOne(id: string, q: Query) {
    return errorHandler(async () => {
      const leaderboard = await this.leaderboardsRepo.findOne('id', id, q);

      if (!leaderboard) {
        throw new AppError('Leaderboard entry not found', 404, AppErrorCode.NOT_FOUND);
      }

      return {
        message: 'Successfully retrieved leaderboard entry',
        data: leaderboard,
      };
    });
  }
}
