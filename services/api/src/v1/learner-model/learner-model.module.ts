import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { TopicMasteryBackfillService } from './topic-mastery-backfill.service';
import { LearnerModelController } from './learner-model.controller';

@Module({
  imports: [PrismaModule],
  controllers: [LearnerModelController],
  providers: [TopicMasteryBackfillService],
  exports: [TopicMasteryBackfillService],
})
export class LearnerModelModule {}