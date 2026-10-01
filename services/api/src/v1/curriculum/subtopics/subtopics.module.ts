import { Module } from '@nestjs/common';
import { SubtopicsService } from './subtopics.service';
import { SubtopicsController } from './subtopics.controller';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { SubTopicsRepo } from './sub-topics.repo';
import { LessonsModule } from '../lessons/lessons.module';

@Module({
  controllers: [SubtopicsController],
  providers: [SubtopicsService, SubTopicsRepo],
  imports:[PrismaModule, LessonsModule],
  exports: [SubtopicsService, SubTopicsRepo]
})
export class SubtopicsModule {}
