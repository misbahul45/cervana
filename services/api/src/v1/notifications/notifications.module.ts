import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepo } from './notifications.repo';
import { PrismaModule } from '@/common/config/prisma/prisma.module';

@Module({
  imports:[PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsRepo],
  exports: [NotificationsService, NotificationsRepo],

})
export class NotificationsModule {}
