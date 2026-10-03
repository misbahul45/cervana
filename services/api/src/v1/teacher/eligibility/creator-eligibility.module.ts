import { Module } from '@nestjs/common';
import { CreatorEligibilityController } from './creator-eligibility.controller';
import { CreatorEligibilityService } from './creator-eligibility.service';
import { MasteryModule } from '@/v1/personalization/mastery/mastery.module';

@Module({
  imports: [MasteryModule],
  controllers: [CreatorEligibilityController],
  providers: [CreatorEligibilityService],
  exports: [CreatorEligibilityService],
})
export class CreatorEligibilityModule {}