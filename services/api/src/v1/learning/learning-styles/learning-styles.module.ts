import { Module } from '@nestjs/common';
import { LearningStylesService } from './learning-styles.service';
import { LearningStylesController } from './learning-styles.controller';
import { LearningStylesRepo } from './learning-styles.repo';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { NotificationsModule } from '@/v1/notifications/notifications.module';

@Module({
  imports:[PrismaModule, NotificationsModule],
  controllers: [LearningStylesController],
  providers: [LearningStylesService, LearningStylesRepo],
})
export class LearningStylesModule {}
