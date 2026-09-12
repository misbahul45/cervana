import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/common/config/prisma/prisma.service";
import { Query } from "@/common/interfaces";
import { errorHandler, validation } from "@/common/lib/utils";
import {
  CreateDailyActivityLogDto,
  CreateDailyActivityLogType,
  UpdateDailyActivityLogDto,
  UpdateDailyActivityLogType,
} from "./daily-logs.dto";
import { DailyActivityEmitter } from "@/v1/emitters/events/daily-activity.emitter";
import { DailyActivityLog, Prisma } from "@prisma/client";

@Injectable()
export class DailylogsRepo {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyEmitter: DailyActivityEmitter,
  ) {}

  async findAll(q: Query = {}) {
    return errorHandler(async () => {
      const {
        page = 1,
        limit = 10,
        sort = "date:desc",
        include,
        q: search,
        ...filters
      } = q;

      const take = Number(limit);
      const skip = (Number(page) - 1) * take;

      const [sortField, sortOrder] = sort.split(":");
      const orderBy = { [sortField]: sortOrder === "asc" ? "asc" : "desc" };

      const where: Prisma.DailyActivityLogWhereInput = {};

      if (search) {
        where.OR = [
          {
            user: { name: { contains: search, mode: "insensitive" } },
          },
        ];
      }

      Object.assign(where, filters);

      let includeObj: Record<string, boolean> | undefined;
      if (include) {
        const includes = Array.isArray(include) ? include : include.split(",");
        includeObj = includes.reduce((acc, curr) => {
          acc[curr] = true;
          return acc;
        }, {} as Record<string, boolean>);
      }

      const data = await this.prisma.dailyActivityLog.findMany({
        where,
        orderBy,
        take,
        skip,
        include: includeObj,
      });

      const total = await this.prisma.dailyActivityLog.count({ where });

      return {
        data,
        meta: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  }

  async findOne<K extends keyof DailyActivityLog>(
    key: K,
    value: DailyActivityLog[K],
    q: Query = {},
  ) {
    return errorHandler(async () => {
      let includeObj: Record<string, boolean> | undefined;

      if (q.include) {
        const includes = Array.isArray(q.include)
          ? q.include
          : q.include.split(",");
        includeObj = includes.reduce((acc, curr) => {
          acc[curr] = true;
          return acc;
        }, {} as Record<string, boolean>);
      }

      return await this.prisma.dailyActivityLog.findFirst({
        where: { [key]: value },
        include: includeObj,
      });
    });
  }

  async findByUser(userId: string, q: Query = {}) {
    return errorHandler(async () => {
      const {
        page = 1,
        limit = 10,
        sort = "date:desc",
        include,
      } = q;

      const take = Number(limit);
      const skip = (Number(page) - 1) * take;
      const [sortField, sortOrder] = sort.split(":");
      const orderBy = { [sortField]: sortOrder === "asc" ? "asc" : "desc" };

      let includeObj: Record<string, boolean> | undefined;
      if (include) {
        const includes = Array.isArray(include) ? include : include.split(",");
        includeObj = includes.reduce((acc, curr) => {
          acc[curr] = true;
          return acc;
        }, {} as Record<string, boolean>);
      }

      const where: Prisma.DailyActivityLogWhereInput = { userId };
      for (const key in q) {
          if (!['q', 'page', 'limit', 'sort', 'include'].includes(key)) {
              where[key] = q[key];
          }
      }


      const data = await this.prisma.dailyActivityLog.findMany({
        where,
        orderBy,
        take,
        skip,
        include: includeObj,
      });

      const total = await this.prisma.dailyActivityLog.count({ where });

      return {
        data,
        meta: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  }

  async findToday(userId: string, startOfDay: Date, endOfDay: Date) {
    return errorHandler(async () => {
      return await this.prisma.dailyActivityLog.findFirst({
        where: {
          userId,
          date: { gte: startOfDay, lte: endOfDay },
        },
      });
    });
  }

  async create(values: CreateDailyActivityLogType) {
    return errorHandler(async () => {
      const data = validation(CreateDailyActivityLogDto, values);
      const normalize = (v: any) => ({
        ...v,
        date: new Date(v.date),
        lastAccessedAt: v.lastAccessedAt ? new Date(v.lastAccessedAt) : null,
      });

      if (Array.isArray(data)) {
        return await this.prisma.dailyActivityLog.createMany({
          data: data.map(normalize),
        });
      }

      const result = await this.prisma.dailyActivityLog.create({
        data: normalize(data),
      });

      this.dailyEmitter.activityCreated(values); 
    });
  }

  async update(id: string, values: UpdateDailyActivityLogType) {
    return errorHandler(async () => {
      const data = validation(UpdateDailyActivityLogDto, values);
      const { metadata, ...rest } = data;
      const normalized = {
        ...rest,
        ...(metadata !== undefined && {
          metadata:
            metadata === null
              ? Prisma.JsonNull
              : (metadata as Prisma.InputJsonValue),
        }),
        date: data.date ? new Date(data.date) : undefined,
        lastAccessedAt: data.lastAccessedAt
          ? new Date(data.lastAccessedAt)
          : undefined,
      };
      delete (normalized as any).userId;

      const result = await this.prisma.dailyActivityLog.update({
        where: { id },
        data: normalized,
      });

      this.dailyEmitter.activityCreated({
        userId: result.userId,
        date: result.date,
        activityType: result.activityType,
        metadata: result.metadata as any,
        lastAccessedAt: result.lastAccessedAt,
      }); 
      return result;
    });
  }

  async delete(id: string) {
    return errorHandler(async () => {
      return await this.prisma.dailyActivityLog.delete({ where: { id } });
    });
  }
}
