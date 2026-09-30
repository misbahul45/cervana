import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { errorHandler } from '@/common/lib/utils';
import { ApplicationListQueryType, SubmitApplicationType, UpdateApplicationType } from './applications.dto';

@Injectable()
export class ApplicationsRepo {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return errorHandler(() =>
      this.prisma.teacherApplication.findUnique({
        where: { id },
        include: { experiences: true, certifications: true },
      }),
    );
  }

  findByUserId(userId: string) {
    return errorHandler(() => this.prisma.teacherApplication.findUnique({ where: { userId } }));
  }

  list(filter: Omit<ApplicationListQueryType, 'userId'> & { userId?: string }) {
    return errorHandler(async () => {
      const where: Prisma.TeacherApplicationWhereInput = {
        ...(filter.userId && { userId: filter.userId }),
        ...(filter.status && { status: filter.status }),
        ...(filter.q && {
          OR: [
            { fullName: { contains: filter.q, mode: 'insensitive' } },
            { expertise: { contains: filter.q, mode: 'insensitive' } },
          ],
        }),
      };
      const [data, total] = await Promise.all([
        this.prisma.teacherApplication.findMany({
          where,
          skip: (filter.page - 1) * filter.limit,
          take: filter.limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.teacherApplication.count({ where }),
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

  create(userId: string, values: SubmitApplicationType) {
    return errorHandler(() =>
      this.prisma.teacherApplication.create({ data: { ...values, userId, status: 'PENDING' } }),
    );
  }

  updateContent(id: string, values: UpdateApplicationType) {
    return errorHandler(() => this.prisma.teacherApplication.update({ where: { id }, data: values }));
  }
}
