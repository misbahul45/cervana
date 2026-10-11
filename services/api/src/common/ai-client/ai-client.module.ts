import { Module } from '@nestjs/common';
import { AiServiceClient } from './ai-service.client';

@Module({
  providers: [AiServiceClient],
  exports: [AiServiceClient],
})
export class AiClientModule {}
