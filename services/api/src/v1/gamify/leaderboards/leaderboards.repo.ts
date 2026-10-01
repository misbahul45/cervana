import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Query } from '@/common/interfaces';
import { errorHandler, validation } from '@/common/lib/utils';
import { Injectable } from '@nestjs/common';
import {
  CreateLeaderboardScoreDto,
  CreateLeaderboardScoreType,
  UpdateLeaderboardScoreDto,
  UpdateLeaderboardScoreType,
} from './leaderboards.dto';
import { LeaderboardEmitter } from '@/v1/emitters/events/leaderboard.emitter';
import { LeaderboardScope, LeaderboardScore } from '@prisma/client';

@Injectable()
export class LeaderboardsRepo {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emitter: LeaderboardEmitter,
  ) {}

  async findAll(q: Query) {
    return errorHandler(async () => {
      const page = Number(q.page) || 1;
      const limit = Number(q.limit) || 10;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (q.q) {
        where.OR = [
          { user: { name: { contains: q.q, mode: 'insensitive' } } },
          { category: { name: { contains: q.q, mode: 'insensitive' } } },
          { topic: { title: { contains: q.q, mode: 'insensitive' } } },
          { subTopic: { title: { contains: q.q, mode: 'insensitive' } } },
        ];
      }

      let orderBy: any = { score: 'desc' };
      if (q.sort) {
        const [field, direction = 'desc'] = q.sort.split(':');
        orderBy = { [field]: direction };
      }
      for (const key in q) {
          if (!['q', 'page', 'limit', 'sort', 'include'].includes(key)) {
              where[key] = q[key];
          }
      }

      let include: any = {
        user: true,
        category: true,
        topic: true,
        subTopic: true,
      };

      if (q.include) {
        const includes = Array.isArray(q.include)
          ? q.include
          : q.include.split(',');
        include = includes.reduce((acc, field) => {
          acc[field] = true;
          return acc;
        }, {} as Record<string, boolean>);
      }

      const [data, total] = await Promise.all([
        this.prisma.leaderboardScore.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include,
        }),
        this.prisma.leaderboardScore.count({ where }),
      ]);

      const rankedData = data.map((item, index) => ({
        ...item,
        rank: skip + index + 1,
      }));

      return {
        data: rankedData,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  }

  async findOne<K extends keyof LeaderboardScore>(
    key: K,
    value: LeaderboardScore[K],
    q: Query = {},
  ) {
    return errorHandler(async () => {
      let include: Record<string, boolean> | undefined;
      if (q.include) {
        const includes = Array.isArray(q.include)
          ? q.include
          : q.include.split(',');
        include = includes.reduce((acc, curr) => {
          acc[curr] = true;
          return acc;
        }, {} as Record<string, boolean>);
      }

      return await this.prisma.leaderboardScore.findFirst({
        where: { [key]: value },
        include,
      });
    });
  }

  async create(values: CreateLeaderboardScoreType) {
    return errorHandler(async () => {
      const data = validation(CreateLeaderboardScoreDto, values);
      if (Array.isArray(data)) {
        return await this.prisma.leaderboardScore.createMany({ data });
      }
      const created = await this.prisma.leaderboardScore.create({ data });
      this.emitter.leaderboardCreated(created);
      return created;
    });
  }

  async update(id: string, values: UpdateLeaderboardScoreType) {
    return errorHandler(async () => {
      const data = validation(UpdateLeaderboardScoreDto, values);
      const result = await this.prisma.leaderboardScore.update({
        where: { id },
        data,
      });
      this.emitter.leaderboardUpdated(result);
      return result;
    });
  }

  async delete(id: string) {
    return errorHandler(async () => {
      const deleted = await this.prisma.leaderboardScore.delete({
        where: { id },
      });
      this.emitter.leaderboardDeleted(deleted);
      return deleted;
    });
  }

  async incrementScore(
    userId: string,
    leaderboardType: LeaderboardScope,
    incrementBy: number,
  ) {
    return errorHandler(async () => {
      const leaderboardScore = await this.prisma.leaderboardScore.findFirst({
        where: { userId, scope: leaderboardType },
      });
      let result;
      if (leaderboardScore) {
        result = await this.prisma.leaderboardScore.update({
          where: { id: leaderboardScore.id },
          data: { score: { increment: incrementBy } },
        });
      } else {
        result = await this.prisma.leaderboardScore.create({
          data: { userId, scope: leaderboardType, score: incrementBy },
        });
      }
      this.emitter.leaderboardUpdated(result);
      return result;
    });
  }
}
