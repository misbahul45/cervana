import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/config/prisma/prisma.service';;
import { Query } from '@/common/interfaces';
import { errorHandler, validation } from '@/common/lib/utils';
import {
  CreateTeacherExperienceDto,
  CreateTeacherExperienceType,
  UpdateTeacherExperienceDto,
  UpdateTeacherExperienceType,
} from './experiences.dto';
import { TeacherExperience } from '@prisma/client';

@Injectable()
export class ExperiencesRepo {
  constructor(private readonly prisma: PrismaService) {}

  async findOne<K extends keyof TeacherExperience>(
    key: K,
    value: TeacherExperience[K],
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

      return await this.prisma.teacherExperience.findFirst({
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
          { title: { contains: q.q, mode: 'insensitive' } },
          { institution: { contains: q.q, mode: 'insensitive' } },
          { description: { contains: q.q, mode: 'insensitive' } },
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
        this.prisma.teacherExperience.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include,
        }),
        this.prisma.teacherExperience.count({ where }),
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

  async create(values: CreateTeacherExperienceType) {
    return errorHandler(async () => {
      const data = validation(CreateTeacherExperienceDto, values);
      if (Array.isArray(data)) {
        return await this.prisma.teacherExperience.createMany({
          data,
          skipDuplicates: true,
        });
      }
      return await this.prisma.teacherExperience.create({ data });
    });
  }

  async update(id: string, values: UpdateTeacherExperienceType) {
    return errorHandler(async () => {
      const data = validation(UpdateTeacherExperienceDto, values);
      return await this.prisma.teacherExperience.update({
        where: { id },
        data,
      });
    });
  }

  async delete(id: string) {
    return errorHandler(async () => {
      return await this.prisma.teacherExperience.delete({
        where: { id },
      });
    });
  }
}
