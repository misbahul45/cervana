import { Module } from '@nestjs/common';
import { CommerceConfig } from './commerce.config';

@Module({
  providers: [CommerceConfig],
  exports: [CommerceConfig],
})
export class CommerceCoreModule {}
