import { Injectable } from "@nestjs/common";
import { DailylogsRepo } from "./daily-logs.repo";
import { Query } from "@/common/interfaces";
import {
  CreateDailyActivityLogType,
  UpdateDailyActivityLogType,
} from "./daily-logs.dto";
import { errorHandler } from "@/common/lib/utils";
import { AppError } from "@/common/lib/error";

@Injectable()
export class DailyLogsService {
  constructor(private readonly repo: DailylogsRepo) {}

  findAll(q: Query) {
    return errorHandler(async () => {
      const result = await this.repo.findAll(q);
      return {
        message: "Successfully retrieved daily activity logs",
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

  findOne(id: string, q: Query = {}) {
    return errorHandler(async () => {
      const log = await this.repo.findOne("id", id, q);
      if (!log) throw new AppError("Daily activity log not found", 404);

      return {
        message: "Successfully retrieved daily activity log",
        data: {
          data: log,
        },
      };
    });
  }

  findByUser(userId: string, q: Query) {
    return errorHandler(async () => {
      const result = await this.repo.findByUser(userId, q);
      return {
        message: "Successfully retrieved user daily activity logs",
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

  findToday(userId: string) {
    return errorHandler(async () => {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      const log = await this.repo.findToday(userId, startOfDay, endOfDay);
      if (!log) throw new AppError("No activity log found for today", 404);

      return {
        message: "Successfully retrieved today's activity log",
        data:log
      };
    });
  }

  create(values: CreateDailyActivityLogType) {
    return errorHandler(async () => {
      const newLog = await this.repo.create(values);
      return {
        message: "Successfully created daily activity log",
        data:newLog
      };
    });
  }

  update(id: string, values: UpdateDailyActivityLogType) {
    return errorHandler(async () => {
      const updatedLog = await this.repo.update(id, values);
      return {
        message: "Successfully updated daily activity log",
        data:null
      };
    });
  }

  remove(id: string) {
    return errorHandler(async () => {
      const log = await this.repo.findOne("id", id);
      if (!log) throw new AppError("Daily activity log not found", 404);

      await this.repo.delete(id);
      return {
        message: "Successfully deleted daily activity log",
        data:null
      };
    });
  }
}
