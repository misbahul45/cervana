import { PrismaService } from "@/common/config/prisma/prisma.service";
import { Query } from "@/common/interfaces";
import { errorHandler, validation } from "@/common/lib/utils";
import { Injectable } from "@nestjs/common";
import {
  CreateNotificationDto,
  CreateNotificationType,
  UpdateNotificationDto,
  UpdateNotificationType,
} from "./notifications.dto";
import { Notification } from "@prisma/client";

@Injectable()
export class NotificationsRepo {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(q: Query) {
    return errorHandler(async () => {
      const page = Number(q.page) || 1;
      const limit = Number(q.limit) || 10;
      const skip = (page - 1) * limit;

      const where: any = {
        OR: [
          { userId: q.userId },
          { isGlobal: true },
        ],
      };

      if (q.userId) {
        where.userId = q.userId;
      }

      if (q.isGlobal !== undefined) {
        where.isGlobal = q.isGlobal === "true" || q.isGlobal === true;
      }

      if (q.readAt) {
        where.readAt = q.readAt;
      }

      if (q.type) {
        where.type = q.type;
      }

      if (q.q) {
        where.OR.push(
          { title: { contains: q.q, mode: "insensitive" } },
          { body: { contains: q.q, mode: "insensitive" } }
        );
      }

      let orderBy: any = undefined;
      if (q.sort) {
        const [field, direction = "desc"] = q.sort.split(":");
        orderBy = { [field]: direction };
      }

      let include: any = undefined;
      if (q.include) {
        const includes = Array.isArray(q.include)
          ? q.include
          : q.include.split(",");
        include = includes.reduce((acc, field) => {
          acc[field] = true;
          return acc;
        }, {} as Record<string, boolean>);
      }

      const [data, total] = await Promise.all([
        this.prisma.notification.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include,
        }),
        this.prisma.notification.count({ where }),
      ]);

      return {
        data,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  }


  async findOne<K extends keyof Notification>(
    key: K,
    value: Notification[K],
    q: Query = {},
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

      return await this.prisma.notification.findFirst({
        where: { [key]: value },
        include,
      });
    });
  }

  async create(values: CreateNotificationType) {
    return errorHandler(async () => {
      const data = validation(CreateNotificationDto, values);

      if (Array.isArray(data)) {
        return await this.prisma.notification.createMany({
          data,
        });
      }

      return await this.prisma.notification.create({ data });
    });
  }

  async update(id: string, values: UpdateNotificationType) {
    return errorHandler(async () => {
      const data = validation(UpdateNotificationDto, values);

      return await this.prisma.notification.update({
        where: { id },
        data,
      });
    });
  }

  async delete(id: string) {
    return errorHandler(async () => {
      return await this.prisma.notification.delete({
        where: { id },
      });
    });
  }
}
