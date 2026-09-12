import { Module } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { QuestionsController } from './questions.controller';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { QuestionsRepo } from './questions.repo';

@Module({
  controllers: [QuestionsController],
  providers: [QuestionsService, QuestionsRepo],
  imports:[PrismaModule],
  exports: [QuestionsService, QuestionsRepo]
})
export class QuestionsModule {}
