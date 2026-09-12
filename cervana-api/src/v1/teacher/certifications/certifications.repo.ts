import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/config/prisma/prisma.service';
import { Query } from '@/common/interfaces';
import { errorHandler, validation } from '@/common/lib/utils';
import {
  CreateCertificationDto,
  CreateCertificationType,
  UpdateCertificationDto,
  UpdateCertificationType,
} from './certifications.dto';
import { Certification } from '@prisma/client';

@Injectable()
export class CertificationsRepo {
  constructor(private readonly prisma: PrismaService) {}

  async findOne<K extends keyof Certification>(
    key: K,
    value: Certification[K],
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

      return await this.prisma.certification.findFirst({
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
          { name: { contains: q.q, mode: 'insensitive' } },
          { issuer: { contains: q.q, mode: 'insensitive' } },
          { credentialId: { contains: q.q, mode: 'insensitive' } },
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
        this.prisma.certification.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include,
        }),
        this.prisma.certification.count({ where }),
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

  async create(values: CreateCertificationType) {
    return errorHandler(async () => {
      const data = validation(CreateCertificationDto, values);
      if (Array.isArray(data)) {
        return await this.prisma.certification.createMany({
          data,
          skipDuplicates: true,
        });
      }
      return await this.prisma.certification.create({ data });
    });
  }

  async update(id: string, values: UpdateCertificationType) {
    return errorHandler(async () => {
      const data = validation(UpdateCertificationDto, values);
      return await this.prisma.certification.update({
        where: { id },
        data,
      });
    });
  }

  async delete(id: string) {
    return errorHandler(async () => {
      return await this.prisma.certification.delete({
        where: { id },
      });
    });
  }
}
