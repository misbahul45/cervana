import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/config/prisma/prisma.service';
import { Query } from '@/common/interfaces';
import { errorHandler, validation } from '@/common/lib/utils';
import { CreateTopicDto, CreateTopicType, UpdateTopicDto, UpdateTopicType } from './topics.dto';
import { randomBytes } from 'crypto';
import { Topic } from '@prisma/client';

@Injectable()
export class TopicsRepo {
  constructor(private readonly prisma: PrismaService) {}

async findOne<K extends keyof Topic>(key: K, value: Topic[K], q: Query = {}) {
  return errorHandler(async () => {
    let include: any = {};
    if (q.include) {
      const includes = Array.isArray(q.include) ? q.include : q.include.split(',');
      include = includes.reduce((acc, curr) => {
        acc[curr] = true;
        return acc;
      }, {} as Record<string, boolean>);
    }

    include.teacher = { select: { id: true, name: true, image: true } };
    include.categories = { select: { id: true, name: true } };

    if (include.subTopics) {
      include.subTopics = { include: { theme: true } };
    }

    const topic = await this.prisma.topic.findFirst({
      where: { [key]: value },
      include,
    });

    if (!topic) return null;

    const [ordersCount, userTopicsCount] = await Promise.all([
      this.prisma.userTopic.count({ where: { topicId: topic.id } }),
      this.prisma.order.count({ where: { topicId: topic.id } }),
    ]);

    let subTopics = ((topic.subTopics as any[]) || []).sort(
      (a, b) => a.sortOrder - b.sortOrder
    );

    const subTopicIds = subTopics.map((st) => st.id);

    const progresses = await this.prisma.subTopicProgress.findMany({
      where: { subTopicId: { in: subTopicIds } },
    });

    const progressMap = progresses.reduce((acc: any, p) => {
      acc[p.subTopicId] = p;
      return acc;
    }, {});

    const lastCompletedOrder = progresses
      .filter((p) => p.status === "COMPLETED")
      .map((p) => {
        const st = subTopics.find((s) => s.id === p.subTopicId);
        return st ? st.sortOrder : 0;
      })
      .reduce((a, b) => Math.max(a, b), 0);

    const computedSubTopics = subTopics.map((st) => {
      const progress = progressMap[st.id];
      const isUnlocked =
        progress?.isUnlocked ||
        (!progress && st.sortOrder === 1) ||
        st.sortOrder === lastCompletedOrder + 1;

      return {
        ...st,
        progress: progress || null,
        isUnlocked,
      };
    });

    return {
      ...topic,
      ordersCount,
      userTopicsCount,
      subTopics: computedSubTopics,
    };
  });
}



  async findAll(q: Query) {
    return errorHandler(async () => {
      const page = Number(q.page) || 1;
      const limit = Number(q.limit) || 10;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (q.q) {
        where.OR = [
          { title: { contains: q.q, mode: 'insensitive' } },
          { slug: { contains: q.q, mode: 'insensitive' } },
          { description: { contains: q.q, mode: 'insensitive' } },
          { category: { name: { contains: q.q, mode: 'insensitive' } } },
        ];
      }

      for (const key in q) {
        if (!['q', 'page', 'limit', 'sort', 'include', 'type'].includes(key)) {
          where[key] = q[key];
        }
      }

      let orderBy: any = undefined;
      if (q.sort) {
        const [field, direction = 'asc'] = q.sort.split(':');
        orderBy = { [field]: direction };
      }

      let include: any = {};
      if (q.include) {
        const includes = Array.isArray(q.include) ? q.include : q.include.split(',');
        include = includes.reduce((acc, field) => {
          acc[field] = true;
          return acc;
        }, {} as Record<string, boolean>);
      }
        include.teacher = { select: { id: true, name: true, image: true } };
        include.categories = { select: { id: true, name: true, } };

      if (q.createdBy) {
        where.createdBy = q.createdBy;
      }

    if (include.subTopics) {
        include.subTopics = { 
          include: { 
            theme: true, 
          }
        };
      }

      const [data, total] = await Promise.all([
        this.prisma.topic.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include,
        }),
        this.prisma.topic.count({ where }),
      ]);

      const ids = data.map((item) => item.id);

      const [userTopics, orders] = await Promise.all([
        this.prisma.userTopic.groupBy({
          by: ['topicId'],
          _count: { topicId: true },
          where: { topicId: { in: ids } },
        }),
        this.prisma.order.groupBy({
          by: ['topicId'],
          _count: { topicId: true },
          where: { topicId: { in: ids } },
        }),
      ]);

      const userTopicsMap = Object.fromEntries(
        userTopics.map((u) => [u.topicId, u._count.topicId])
      );
      const ordersMap = Object.fromEntries(
        orders.map((o) => [o.topicId, o._count.topicId])
      );

      let result = data.map((item) => ({
        ...item,
        userTopicsCount: userTopicsMap[item.id] || 0,
        ordersCount: ordersMap[item.id] || 0,
      }));

      if (q.type === 'populer') {
        result = result.sort((a, b) => b.userTopicsCount - a.userTopicsCount);
      }

      return {
        data: result,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  }

  async create(values: CreateTopicType) {
    return errorHandler(async () => {
      const data = validation(CreateTopicDto, values);
      const { categoryIds, ...rest } = data;
      let finalSlug = rest.slug;
      let counter = 1;
      while (await this.prisma.topic.findUnique({ where: { slug: finalSlug } })) {
        const shortId = randomBytes(2).toString('hex');
        finalSlug = `${rest.slug}-${shortId}`;
        counter++;
        if (counter > 5) break;
      }
      return await this.prisma.topic.create({
        data: {
          ...rest,
          slug: finalSlug!,
          categories: categoryIds?.length
            ? { connect: categoryIds.map((id) => ({ id })) }
            : undefined,
        },
      });
    });
  }

  async update(id: string, values: UpdateTopicType) {
    return errorHandler(async () => {
      const data = validation(UpdateTopicDto, values);
      return await this.prisma.topic.update({
        where: { id },
        data,
      });
    });
  }

  async delete(id: string) {
    return errorHandler(async () => {
      return await this.prisma.topic.delete({ where: { id } });
    });
  }
}
