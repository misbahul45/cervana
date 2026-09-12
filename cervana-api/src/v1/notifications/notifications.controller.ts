import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Query as QueryInterface } from '@/common/interfaces';
import { CreateNotificationType, UpdateNotificationType } from './notifications.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  create(@Body() createNotificationDto: CreateNotificationType) {
    return this.notificationsService.create(createNotificationDto);
  }

  @Get()
  findAll(
    @Query() q: QueryInterface,
  ) {
    return this.notificationsService.findAll({
      ...q,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query() q: QueryInterface) {
    return this.notificationsService.findOne(id, q);
  }
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateNotificationDto: UpdateNotificationType) {
    return this.notificationsService.update(id, updateNotificationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.notificationsService.remove(id);
  }
}
