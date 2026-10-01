import { Module } from '@nestjs/common';
import { CreatorAnalyticsService } from './creator-analytics.service';
import { CreatorAnalyticsController } from './creator-analytics.controller';

@Module({
  controllers: [CreatorAnalyticsController],
  providers: [CreatorAnalyticsService],
  exports: [CreatorAnalyticsService],
})
export class CreatorAnalyticsModule {}
