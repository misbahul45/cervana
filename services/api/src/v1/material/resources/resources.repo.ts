import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/config/prisma/prisma.service';
import { Query } from '@/common/interfaces';
import { errorHandler, validation } from '@/common/lib/utils';
import { CreateResourceDto, CreateResourceType, UpdateResourceDto, UpdateResourceType } from './resources.dto';
import { QueueService } from '@/v1/queue/queue.service';
import { Resource } from '@prisma/client';

@Injectable()
export class ResourcesRepo {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async findOne<K extends keyof Resource>(
    key: K,
    value: Resource[K],
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

      return await this.prisma.resource.findFirst({
        where: { [key]: value },
        include: include as any,
      });
    });
  }

    async findAll(q: Query) {
        return errorHandler(async () => {
            const page = Number(q.page) || 1;
            const limit = Number(q.limit) || 10;
            const skip = (page - 1) * limit;

            const where: any = {};
            for (const key in q) {
                if (!['q', 'page', 'limit', 'sort', 'include'].includes(key)) {
                    where[key] = q[key];
                }
            }

            if (q.q) {
            where.OR = [
                { title: { contains: q.q, mode: 'insensitive' } },
                { content: { contains: q.q, mode: 'insensitive' } },
            ];
            }

            if (q.topicId) where.topicId = q.topicId;
            if (q.subTopicId) where.subTopicId = q.subTopicId;
            if (q.lessonId) where.lessonId = q.lessonId;
            if (q.type) where.type = q.type;
            if (q.jobStatus) where.jobStatus = q.jobStatus;

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
            this.prisma.resource.findMany({
                where,
                skip,
                take: limit,
                orderBy,
                include,
            }),
            this.prisma.resource.count({ where }),
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


  async create(values: CreateResourceType, token:string) {
    return errorHandler(async () => {
      const data = validation(CreateResourceDto, values);

      const created = await this.prisma.resource.create({ data });
      await this.queueService.addKnowledgeJob({ resourceId: created.id, token });

      return created;
    });
  }

  update(id:string, values:UpdateResourceType){
    return errorHandler(async()=>{
      const data=validation(UpdateResourceDto, values)
      return await this.prisma.resource.update({
        where:{
          id
        },
        data
      })
    })
  }

  async delete(id: string) {
    return errorHandler(async () => {
      return await this.prisma.resource.delete({ where: { id } });
    });
  }
}
