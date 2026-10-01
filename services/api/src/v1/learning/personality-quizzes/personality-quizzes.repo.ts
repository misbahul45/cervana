import { PrismaService } from "@/common/config/prisma/prisma.service";
import { Query } from "@/common/interfaces";
import { errorHandler, validation } from "@/common/lib/utils";
import { Injectable } from "@nestjs/common";
import {
  CreatePersonalityQuizDto,
  CreatePersonalityQuizType,
  UpdatePersonalityQuizDto,
  UpdatePersonalityQuizType,
} from "./personality-quizzes.dto";
import { NotificationsRepo } from "@/v1/notifications/notifications.repo";
import { NotificationType, PersonalityQuiz } from "@prisma/client";

@Injectable()
export class PersonalityQuizzesRepo {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsRepo: NotificationsRepo
  ) {}
  async findAll(userId: string, q: Query = {}) {
    return errorHandler(async () => {
      const page = Number(q.page) || 1;
      const limit = Number(q.limit) || 10;
      const skip = (page - 1) * limit;

      const where: any = { userId };

      for (const key in q) {
        if (!['q', 'page', 'limit', 'sort', 'include'].includes(key)) {
          where[key] = q[key];
        }
      }

      let orderBy: any = undefined;
      if (q.sort) {
        const [field, direction = 'asc'] = q.sort.split(':');
        orderBy = { [field]: direction };
      }

      let include: any = undefined;
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
        this.prisma.personalityQuiz.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include,
        }),
        this.prisma.personalityQuiz.count({ where }),
      ]);

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

  async findOne<K extends keyof PersonalityQuiz>(
    key: K,
    value: PersonalityQuiz[K],
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

      return await this.prisma.personalityQuiz.findFirst({
        where: { [key]: value },
        include,
      });
    });
  }

  async create(values: CreatePersonalityQuizType) {
    return errorHandler(async () => {
      const data = validation(CreatePersonalityQuizDto, values);

      return await this.prisma.$transaction(async (tx) => {
        const result = await tx.personalityQuiz.create({
          data,
        });

        const getLesson = await tx.lesson.findFirst({
          where: { id: data.lessonId },
          select: { title: true },
        });

        await this.notificationsRepo.create({
          userId: data.userId,
          title: "Kamu memulai Tes Kepribadian Baru",
          body: `Tes kepribadian untuk pelajaran "${getLesson?.title}" telah dibuat.`,
          type: NotificationType.SYSTEM,
          isGlobal: false,
        });

        return result;
      });
    });
  }

  async update(id: string, values: UpdatePersonalityQuizType) {
    return errorHandler(async () => {
      const data = validation(UpdatePersonalityQuizDto, values);

      return await this.prisma.personalityQuiz.update({
        where: { id },
        data,
      });
    });
  }

  async delete(id: string) {
    return errorHandler(async () => {
      return await this.prisma.personalityQuiz.delete({
        where: { id },
      });
    });
  }
}
