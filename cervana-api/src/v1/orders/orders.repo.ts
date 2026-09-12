import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Query } from '@/common/interfaces';
import { errorHandler, validation } from '@/common/lib/utils';
import {
  CreateOrderDto,
  CreateOrderDtoType,
  UpdateOrderDto,
  UpdateOrderDtoType,
} from './orders.dto';
import { UserTopicsRepo } from '../learning/user-topics/user-topics.repo';
import { TopicsRepo } from '../curriculum/topics/topics.repo';
import { AppError } from '@/common/lib/error';
import { Order } from '@prisma/client';

@Injectable()
export class OrdersRepo {
  constructor(
    private readonly prisma: PrismaService, 
    private readonly userTopicsRepo:UserTopicsRepo,
    private readonly topicsRepo:TopicsRepo
  ) {}

  async findOne<K extends keyof Order>(
    key: K,
    value: Order[K],
    q: Query = {}
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

      return await this.prisma.order.findFirst({
        where: { [key]: value },
        include,
      });
    });
  }
  async updateByUserTopic(userId: string, topicId: string, data: any) {
    return errorHandler(async()=>{
        const topic = await this.topicsRepo.findOne('id', topicId);
        if (!topic) {
          throw new AppError('Topic not found');
        }

        if (topic.topicDuration == null) {
          throw new AppError('Topic duration not set');
        }

        await this.userTopicsRepo.create({
          topicId,
          userId,
          accessType: 'PURCHASED',
          status: 'NOT_STARTED',
          progressPercent: 0,
          expiredAt: new Date(Date.now() + topic.topicDuration * 60 * 60 * 1000),
        });

        return this.prisma.order.updateMany({
          where: { userId, topicId, status: 'PENDING' },
          data,
        });
    })
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
          { gateway: { contains: q.q, mode: 'insensitive' } },
          { currency: { contains: q.q, mode: 'insensitive' } },
        ];
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

      for (const key in q) {
        if (!['q', 'page', 'limit', 'sort', 'include', 'type'].includes(key)) {
          where[key] = q[key];
        }
      }

      const [data, total] = await Promise.all([
        this.prisma.order.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include,
        }),
        this.prisma.order.count({ where }),
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

  async create(values: CreateOrderDtoType, extra?: { paidAt?: Date }) {
    return errorHandler(async () => {
      const data = validation(CreateOrderDto, values);

      if (Array.isArray(data)) {
        const withExtra = data.map((item) => ({
          ...item,
          ...(extra?.paidAt && { paidAt: extra.paidAt }),
        }));
        return await this.prisma.order.createMany({
          data: withExtra,
          skipDuplicates: true,
        });
      }

      const mergedData = {
        ...data,
        ...(extra?.paidAt && { paidAt: extra.paidAt }),
      };

      return await this.prisma.order.create({ data: mergedData });
    });
  }


  async update(id: string, values: UpdateOrderDtoType) {
    return errorHandler(async () => {
      const data = validation(UpdateOrderDto, values);
      return await this.prisma.order.update({
        where: { id },
        data,
      });
    });
  }

  async delete(id: string) {
    return errorHandler(async () => {
      return await this.prisma.order.delete({
        where: { id },
      });
    });
  }
}
