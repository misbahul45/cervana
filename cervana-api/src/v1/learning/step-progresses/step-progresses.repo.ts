import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/common/config/prisma/prisma.service";
import { Query } from "@/common/interfaces";
import { errorHandler, validation } from "@/common/lib/utils";
import {
  CreateStepProgressDto,
  CreateStepProgressType,
  UpdateStepProgressDto,
  UpdateStepProgressType,
} from "./step-progresses.dto";
import { StepProgress } from "@prisma/client";

@Injectable()
export class StepProgressesRepo {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(q: Query) {
    return errorHandler(async () => {
      const page = Number(q.page) || 1;
      const limit = Number(q.limit) || 10;
      const skip = (page - 1) * limit;

      const where: any = {};

      for (const key in q) {
        if (!["q", "page", "limit", "sort", "include", "lessonId"].includes(key)) {
          where[key] = q[key];
        }
      }

      if (q.lessonId) {
        where.step = { lessonId: q.lessonId };
      }

      let include: any = undefined;
      if (q.include) {
        const includes = Array.isArray(q.include) ? q.include : q.include.split(",");
        include = includes.reduce((acc, field) => {
          acc[field] = true;
          return acc;
        }, {} as Record<string, boolean>);
      }

      let orderBy: any = undefined;
      if (q.sort) {
        const [field, direction = "asc"] = q.sort.split(":");
        orderBy = { [field]: direction };
      }

      const data = await this.prisma.stepProgress.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include,
      });

      let total = 0;
      if (q.lessonId) {
        total = await this.prisma.stepProgress.count({
          where: { userId: q.userId, step: { lessonId: q.lessonId } },
        });
      } else {
        total = await this.prisma.stepProgress.count({ where });
      }

      return {
        data,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  }

  async findOne<K extends keyof StepProgress>(key: K, value: StepProgress[K], q: Query = {}) {
    return errorHandler(async () => {
      let include: Record<string, boolean> | undefined;

      if (q.include) {
        const includes = Array.isArray(q.include) ? q.include : q.include.split(",");
        include = includes.reduce((acc, field) => {
          acc[field] = true;
          return acc;
        }, {} as Record<string, boolean>);
      }

      return await this.prisma.stepProgress.findFirst({
        where: { [key]: value },
        include,
      });
    });
  }

  async create(values: CreateStepProgressType) {
    return errorHandler(async () => {
      const data = validation(CreateStepProgressDto, values);

      if (Array.isArray(data)) {
        return await this.prisma.stepProgress.createMany({ data });
      }

      return await this.prisma.stepProgress.create({ data });
    });
  }

  async update(id: string, values: UpdateStepProgressType) {
    return errorHandler(async () => {
      const data = validation(UpdateStepProgressDto, values);

      return await this.prisma.stepProgress.update({
        where: { id },
        data,
      });
    });
  }

  async delete(id: string) {
    return errorHandler(async () => {
      return await this.prisma.stepProgress.delete({
        where: { id },
      });
    });
  }
}
