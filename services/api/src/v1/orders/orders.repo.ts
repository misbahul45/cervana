import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { errorHandler } from '@/common/lib/utils';
import { OrderListQueryDtoType } from './orders.dto';

const itemSelect = {
  id: true,
  quantity: true,
  unitPrice: true,
  totalPrice: true,
  articleId: true,
  classId: true,
  topicId: true,
  article: { select: { title: true } },
  classProduct: { select: { title: true } },
  topic: { select: { title: true } },
} satisfies Prisma.OrderItemSelect;

@Injectable()
export class OrdersRepo {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string, include?: 'topic') {
    return errorHandler(() =>
      this.prisma.order.findUnique({
        where: { id },
        include: { items: { select: itemSelect }, ...(include && { topic: true }) },
      }),
    );
  }

  list(filter: Omit<OrderListQueryDtoType, 'userId'> & { userId?: string }) {
    return errorHandler(async () => {
      const where: Prisma.OrderWhereInput = {
        ...(filter.userId && { userId: filter.userId }),
        ...(filter.topicId && { topicId: filter.topicId }),
        ...(filter.status && { status: filter.status }),
      };
      const [field, direction] = (filter.sort ?? 'createdAt:desc').split(':');
      const [data, total] = await Promise.all([
        this.prisma.order.findMany({
          where,
          skip: (filter.page - 1) * filter.limit,
          take: filter.limit,
          orderBy: { [field]: direction },
          include: { items: { select: itemSelect }, ...(filter.include && { topic: true }) },
        }),
        this.prisma.order.count({ where }),
      ]);
      return {
        data,
        meta: {
          page: filter.page,
          limit: filter.limit,
          total,
          totalPages: Math.ceil(total / filter.limit),
        },
      };
    });
  }
}
