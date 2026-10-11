import { Module } from '@nestjs/common';
import { CreatorEligibilityController } from './creator-eligibility.controller';
import { CreatorEligibilityService } from './creator-eligibility.service';
import { LearnerModelModule } from '@/v1/learner-model/learner-model.module';

@Module({
  imports: [LearnerModelModule],
  controllers: [CreatorEligibilityController],
  providers: [CreatorEligibilityService],
  exports: [CreatorEligibilityService],
})
export class CreatorEligibilityModule {}