import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { errorHandler } from '@/common/lib/utils';
import { Query } from '@/common/interfaces';
import { StreakEmitter } from '@/v1/emitters/events/streak.emitter';
import { LeaderboardsRepo } from '../leaderboards/leaderboards.repo';
import { StreakActivity, StreakHistory } from '@prisma/client';

@Injectable()
export class StreaksRepo {
  constructor(
    private readonly prisma: PrismaService,
    private readonly streakEmitter: StreakEmitter,
    private readonly leaderboardsRepo: LeaderboardsRepo,
  ) {}

  async findAll(q: Query = {}) {
    return errorHandler(async () => {
      const page = Number(q.page) || 1;
      const limit = Number(q.limit) || 10;
      const skip = (page - 1) * limit;
      const where: any = {};

      if (q.q) where.OR = [{ activityType: { contains: q.q, mode: 'insensitive' } }];
      if (q.userId) where.userId = q.userId;

      let orderBy: any;
      if (q.sort) {
        const [field, direction = 'asc'] = q.sort.split(':');
        orderBy = { [field]: direction };
      }

      let include: Record<string, boolean> | undefined;
      if (q.include) {
        const includes = Array.isArray(q.include) ? q.include : q.include.split(',');
        include = includes.reduce((acc, curr) => {
          acc[curr] = true;
          return acc;
        }, {} as Record<string, boolean>);
      }
      for (const key in q) {
          if (!['q', 'page', 'limit', 'sort', 'include'].includes(key)) {
              where[key] = q[key];
          }
      }

      const [data, total] = await Promise.all([
        this.prisma.streakHistory.findMany({ where, skip, take: limit, orderBy, include }),
        this.prisma.streakHistory.count({ where }),
      ]);

      return {
        data,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    });
  }

  async findByUser(userId: string, q: Query = {}) {
    return errorHandler(async () => {
      const where: any = { userId };
      const page = Number(q.page) || 1;
      const limit = Number(q.limit) || 10;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.prisma.streakHistory.findMany({ where, skip, take: limit, orderBy: { date: 'desc' } }),
        this.prisma.streakHistory.count({ where }),
      ]);

      return {
        data,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    });
  }

  async findOne<K extends keyof StreakHistory>(
    key: K,
    value: StreakHistory[K],
    q: Query = {},
  ) {
    return errorHandler(async () => {
      let include: Record<string, boolean> | undefined;
      if (q.include) {
        const includes = Array.isArray(q.include) ? q.include : q.include.split(',');
        include = includes.reduce((acc, curr) => {
          acc[curr] = true;
          return acc;
        }, {} as Record<string, boolean>);
      }
      return await this.prisma.streakHistory.findFirst({ where: { [key]: value }, include });
    });
  }

  async findToday(userId: string, start: Date, end: Date) {
    return await this.prisma.streakHistory.findFirst({
      where: { userId, date: { gte: start, lte: end } },
    });
  }

  async findLast(userId: string, activityType?: StreakActivity) {
    const where: any = { userId };
    if (activityType) where.activityType = activityType;

    return await this.prisma.streakHistory.findFirst({
      where,
      orderBy: { date: 'desc' },
    });
  }


  async create(data: Omit<StreakHistory, 'id'>) {
    return errorHandler(async () => {
      const result = await this.prisma.streakHistory.create({ data });
      this.streakEmitter.streakUpdated(result);
      return result;
    });
  }

  async update(id: string, data: Partial<StreakHistory>) {
    return errorHandler(async () => {
      const result = await this.prisma.streakHistory.update({ where: { id }, data });
      this.streakEmitter.streakUpdated(result);
      return result;
    });
  }

  async delete(id: string) {
    return errorHandler(async () => {
      await this.prisma.streakHistory.delete({ where: { id } });
      return { message: 'StreakHistory deleted successfully', id };
    });
  }

  async incrementOrReset(userId: string, activityType: StreakActivity) {
    const today = new Date();
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);

    const existingToday = await this.findToday(userId, start, end);
    if (existingToday) return existingToday;

    const last = await this.findLast(userId, activityType);
    let streakCount = 1;

    if (last) {
      const lastDate = new Date(last.date);
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const isConsecutive =
        lastDate.getFullYear() === yesterday.getFullYear() &&
        lastDate.getMonth() === yesterday.getMonth() &&
        lastDate.getDate() === yesterday.getDate();
      if (isConsecutive) streakCount = last.streakCount + 1;
    }

    if(streakCount % 7 === 0){
      await this.leaderboardsRepo.incrementScore(userId, 'GLOBAL', 50);
    }

    return await this.create({
      userId,
      date: today,
      activityType,
      streakCount,
      isDeleted: false,
    } as Omit<StreakHistory, 'id'>);
  }
}
