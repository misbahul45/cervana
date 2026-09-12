import { Injectable } from '@nestjs/common';
import { NotificationsRepo } from './notifications.repo';
import { errorHandler } from '@/common/lib/utils';
import { CreateNotificationType, UpdateNotificationType } from './notifications.dto';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { Query } from '@/common/interfaces';

@Injectable()
export class NotificationsService {
  constructor(private readonly notificationsRepo: NotificationsRepo) {}

  create(values: CreateNotificationType) {
    return errorHandler(async () => {
      const newNotification = await this.notificationsRepo.create(values);

      return {
        message: 'Successfully created new notification',
        data: newNotification,
      };
    });
  }

  findAll(q: Query) {
    return errorHandler(async () => {
      const result = await this.notificationsRepo.findAll(q);

      return {
        message: 'Successfully retrieved notifications',
        data: {
          data: result.data,
          pagination: {
            page: result.meta.page,
            limit: result.meta.limit,
            total: result.meta.total,
            totalPages: result.meta.totalPages,
          },
        },
      };
    });
  }

  findOne(id: string, q: Query) {
    return errorHandler(async () => {
      const notification = await this.notificationsRepo.findOne('id', id, q);

      if (!notification) {
        throw new AppError('Notification not found', 404, AppErrorCode.NOT_FOUND);
      }

      return {
        message: 'Successfully retrieved notification',
        data: notification,
      };
    });
  }

  update(id: string, values: UpdateNotificationType) {
    return errorHandler(async () => {
      const existingNotification = await this.notificationsRepo.findOne('id', id);

      if (!existingNotification) {
        throw new AppError('Notification not found', 404, AppErrorCode.NOT_FOUND);
      }

      await this.notificationsRepo.update(id, values);

      return {
        message: 'Successfully updated notification',
        data: null,
      };
    });
  }

  remove(id: string) {
    return errorHandler(async () => {
      const existingNotification = await this.notificationsRepo.findOne('id', id);

      if (!existingNotification) {
        throw new AppError('Notification not found', 404, AppErrorCode.NOT_FOUND);
      }

      await this.notificationsRepo.delete(id);

      return {
        message: 'Successfully deleted notification',
        data: null,
      };
    });
  }
}
