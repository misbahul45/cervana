import { Controller, Post, UseGuards, HttpCode } from '@nestjs/common';
import { Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { TopicMasteryBackfillService } from './topic-mastery-backfill.service';

@Controller('learner-model')
@UseGuards()
export class LearnerModelController {
  constructor(
    private readonly backfillService: TopicMasteryBackfillService,
  ) {}

  @Post('backfill/topic-mastery')
  @Roles(Role.ADMIN)
  @HttpCode(202)
  async runTopicMasteryBackfill() {
    return this.backfillService.runBackfill();
  }
}