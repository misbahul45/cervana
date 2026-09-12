import { PrismaService } from "@/common/config/prisma/prisma.service";
import { Query } from "@/common/interfaces";
import { errorHandler, validation } from "@/common/lib/utils";
import { Injectable } from "@nestjs/common";
import {
  CreateLearningStyleProfileDto,
  CreateLearningStyleProfileType,
  UpdateLearningStyleProfileDto,
  UpdateLearningStyleProfileType,
} from "./learning-styles.dto";
import { NotificationsRepo } from "@/v1/notifications/notifications.repo";
import { LearningStyleProfile, NotificationType } from "@prisma/client";

@Injectable()
export class LearningStylesRepo {
  constructor(private readonly prisma: PrismaService, private readonly notificationsrepo:NotificationsRepo) {}

  async findOne<K extends keyof LearningStyleProfile>(
    key: K,
    value: LearningStyleProfile[K],
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

      return await this.prisma.learningStyleProfile.findFirst({
        where: { [key]: value },
        include,
      });
    });
  }

  async findAll(userId: string, q: Query = {}) {
    return errorHandler(async () => {
      const page = Number(q.page) || 1;
      const limit = Number(q.limit) || 10;
      const skip = (page - 1) * limit;

      const where: any = { userId };

      // Tambahkan filter selain q, page, limit, sort, include
      for (const key in q) {
        if (!['q', 'page', 'limit', 'sort', 'include'].includes(key)) {
          where[key] = q[key];
        }
      }

      // Sorting
      let orderBy: any = undefined;
      if (q.sort) {
        const [field, direction = 'asc'] = q.sort.split(':');
        orderBy = { [field]: direction };
      }

      // Include relations
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
        this.prisma.learningStyleProfile.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include,
        }),
        this.prisma.learningStyleProfile.count({ where }),
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


  async create(values: CreateLearningStyleProfileType) {
    return errorHandler(async () => {
      console.log(values)
      const data = validation(CreateLearningStyleProfileDto, values);
      const userTopicId = Array.isArray(data) ? data[0].userTopicId : data.userTopicId;

      return await this.prisma.$transaction(async (tx) => {
        let result;

        if (Array.isArray(data)) {
          result = await tx.learningStyleProfile.createMany({
            data,
          });
        } else {
          result = await tx.learningStyleProfile.create({
            data,
          });
        }

        const userTopic=await tx.userTopic.update({
          where: { id: userTopicId },
          data: {
            status: 'IN_PROGRESS',
          },
          select:{
            userId:true,
            topic:{
              select:{
                title:true
              }
            }
          }
        });
        await this.notificationsrepo.create({
          userId:userTopic.userId || '',
          title:"Gaya belajar yang keren",
          body:`Kamu baru saja memulai perjalanan belajar baru! Gaya belajar kamu telah disesuaikan untuk pengalaman terbaik pada topic ${userTopic.topic.title}`,
          type:NotificationType.SYSTEM,
          isGlobal:false
        })

        return result;
      });
    });
  }


  async update(id: string, values: UpdateLearningStyleProfileType) {
    return errorHandler(async () => {
      const data = validation(UpdateLearningStyleProfileDto, values);

      return await this.prisma.learningStyleProfile.update({
        where: { id },
        data,
      });
    });
  }

  async delete(id: string) {
    return errorHandler(async () => {
      return await this.prisma.learningStyleProfile.delete({
        where: { id },
      });
    });
  }
}
