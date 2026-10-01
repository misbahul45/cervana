import { Module } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { LessonsRepo } from './lessons.repo';
import { StepsModule } from '../steps/steps.module';

@Module({
  controllers: [LessonsController],
  providers: [LessonsService, LessonsRepo],
  imports:[PrismaModule, StepsModule],
  exports: [LessonsService, LessonsRepo]
})
export class LessonsModule {}
