import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/config/prisma/prisma.service';
import { Query } from '@/common/interfaces';
import { errorHandler, validation } from '@/common/lib/utils';
import {
  CreateTeacherApplicationDto,
  CreateTeacherApplicationType,
  UpdateTeacherApplicationDto,
  UpdateTeacherApplicationType,
} from './applications.dto';
import { TeacherApplication } from '@prisma/client';

@Injectable()
export class ApplicationsRepo {
  constructor(private readonly prisma: PrismaService) {}

  async findOne<K extends keyof TeacherApplication>(
    key: K,
    value: TeacherApplication[K],
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

      return await this.prisma.teacherApplication.findFirst({
        where: { [key]: value },
        include,
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
          { fullName: { contains: q.q, mode: 'insensitive' } },
          { bio: { contains: q.q, mode: 'insensitive' } },
          { expertise: { contains: q.q, mode: 'insensitive' } },
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

      const [data, total] = await Promise.all([
        this.prisma.teacherApplication.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include,
        }),
        this.prisma.teacherApplication.count({ where }),
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

  async create(values: CreateTeacherApplicationType) {
    return errorHandler(async () => {
      const data = validation(CreateTeacherApplicationDto, values);
      if (Array.isArray(data)) {
        return await this.prisma.teacherApplication.createMany({
          data,
          skipDuplicates: true,
        });
      }
      return await this.prisma.teacherApplication.create({ data });
    });
  }

  async update(id: string, values: UpdateTeacherApplicationType) {
    return errorHandler(async () => {
      const data = validation(UpdateTeacherApplicationDto, values);
      return await this.prisma.teacherApplication.update({
        where: { id },
        data,
      });
    });
  }

  async delete(id: string) {
    return errorHandler(async () => {
      return await this.prisma.teacherApplication.delete({
        where: { id },
      });
    });
  }
}
