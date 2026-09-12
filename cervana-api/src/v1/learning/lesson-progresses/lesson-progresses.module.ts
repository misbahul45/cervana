import { Module } from '@nestjs/common';
import { LessonProgressesService } from './lesson-progresses.service';
import { LessonProgressesController } from './lesson-progresses.controller';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { LessonProgressesRepo } from './lesson-progresses.repo';

@Module({
  imports:[PrismaModule],
  controllers: [LessonProgressesController],
  providers: [LessonProgressesService,LessonProgressesRepo],
  exports: [LessonProgressesService, LessonProgressesRepo]
})
export class LessonProgressModule {}
