import { Module } from '@nestjs/common';
import { SubtopicProgressesController } from './subtopic-progresses.controller';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { SubtopicProgressesService } from './subtopic-progresses.service';
import { SubtopicProgressesRepo } from './subtopic-progresses.repo';

@Module({
  imports:[PrismaModule],
  controllers: [SubtopicProgressesController],
  providers: [SubtopicProgressesService, SubtopicProgressesRepo]
})
export class SubtopicProgressesModule {}