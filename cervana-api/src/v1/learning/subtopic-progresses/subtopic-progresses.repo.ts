import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/common/config/prisma/prisma.service";
import { Query } from "@/common/interfaces";
import { errorHandler, validation } from "@/common/lib/utils";
import {
  CreateSubTopicProgressDto,
  CreateSubTopicProgressType,
  UpdateSubTopicProgressDto,
  UpdateSubTopicProgressType,
} from "./subtopic-progresses.dto";
import { SubTopicProgress } from "@prisma/client";

@Injectable()
export class SubtopicProgressesRepo {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(q: Query) {
    return errorHandler(async () => {
      const page = Number(q.page) || 1;
      const limit = Number(q.limit) || 10;
      const skip = (page - 1) * limit;

      const where: any = {};

      for (const key in q) {
        if (!['q', 'page', 'limit', 'sort', 'include', 'topicId'].includes(key)) {
          where[key] = q[key];
        }
      }

      if (q.topicId) {
        where.subTopic = { topicId: q.topicId };
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

      const data = await this.prisma.subTopicProgress.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include,
      });

      let total = 0;
      if (q.topicId) {
        total = await this.prisma.subTopicProgress.count({
          where: { userId: q.userId, subTopic: { topicId: q.topicId } },
        });
      } else {
        total = await this.prisma.subTopicProgress.count({ where });
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


  async findOne<K extends keyof SubTopicProgress>(
    key: K,
    value: SubTopicProgress[K],
    q: Query = {}
  ) {
    return errorHandler(async () => {
      let include: Record<string, boolean> | undefined;

      if (q.include) {
        const includes = Array.isArray(q.include)
          ? q.include
          : q.include.split(",");
        include = includes.reduce((acc, curr) => {
          acc[curr] = true;
          return acc;
        }, {} as Record<string, boolean>);
      }

      return await this.prisma.subTopicProgress.findFirst({
        where: { [key]: value },
        include,
      });
    });
  }

  async create(values: CreateSubTopicProgressType) {
    return errorHandler(async () => {
      const data = validation(CreateSubTopicProgressDto, values);

      if (Array.isArray(data)) {
        return await this.prisma.subTopicProgress.createMany({ data });
      }

      return await this.prisma.subTopicProgress.create({ data });
    });
  }

  async update(id: string, values: UpdateSubTopicProgressType) {
    return errorHandler(async () => {
      const data = validation(UpdateSubTopicProgressDto, values);

      return await this.prisma.subTopicProgress.update({
        where: { id },
        data,
      });
    });
  }

  async delete(id: string) {
    return errorHandler(async () => {
      return await this.prisma.subTopicProgress.delete({
        where: { id },
      });
    });
  }
}