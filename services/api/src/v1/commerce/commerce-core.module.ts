import { Module } from '@nestjs/common';
import { CommerceConfig } from './commerce.config';
import { AnalyticsModule } from '@/v1/analytics/analytics.module';

@Module({
  imports: [AnalyticsModule],
  providers: [CommerceConfig],
  exports: [CommerceConfig],
})
export class CommerceCoreModule {}
