import { ScopeToUser } from '@/common/authz/access';
import { RequireOwnership } from '@/v1/common/guards/ownership.decorator';
import { GetUser, Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Query as QueryInterface } from '@/common/interfaces';
import { AuthUser } from '@/common/interfaces/auth.interface';
import { CreateNotificationType } from './notifications.dto';
import { parseNotificationUpdate } from './notification-update';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() createNotificationDto: CreateNotificationType) {
    return this.notificationsService.create(createNotificationDto);
  }

  @Get()
  @ScopeToUser()
  findAll(
    @Query() q: QueryInterface,
  ) {
    return this.notificationsService.findAll({
      ...q,
    });
  }

  @Get(':id')
  @RequireOwnership('notification', { allowUnownedRead: true })
  findOne(@Param('id') id: string, @Query() q: QueryInterface) {
    return this.notificationsService.findOne(id, q);
  }
  @Patch(':id')
  @RequireOwnership('notification')
  update(@Param('id') id: string, @Body() body: unknown, @GetUser() user: AuthUser) {
    const change = parseNotificationUpdate(user.role, body);
    return change.kind === 'read'
      ? this.notificationsService.markRead(id, change.readAt)
      : this.notificationsService.update(id, change.values);
  }

  @Delete(':id')
  @RequireOwnership('notification')
  remove(@Param('id') id: string) {
    return this.notificationsService.remove(id);
  }
}
