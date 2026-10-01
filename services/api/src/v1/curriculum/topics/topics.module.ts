import { Module } from '@nestjs/common';
import { TopicsService } from './topics.service';
import { TopicsController } from './topics.controller';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { TopicsRepo } from './topics.repo';
import { SubtopicsModule } from '../subtopics/subtopics.module';

@Module({
  controllers: [TopicsController],
  providers: [TopicsService, TopicsRepo],
  imports:[PrismaModule, SubtopicsModule],
  exports: [TopicsService, TopicsRepo]
})
export class TopicsModule { }
