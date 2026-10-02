import { Module } from '@nestjs/common';
import { MasteryModule } from './mastery/mastery.module';
import { MisconceptionModule } from './misconception/misconception.module';
import { MemoryModule } from './memory/memory.module';
import { AdaptivePolicyModule } from './policy/adaptive-policy.module';

@Module({
  imports: [MasteryModule, MisconceptionModule, MemoryModule, AdaptivePolicyModule],
  exports: [MasteryModule, MisconceptionModule, MemoryModule, AdaptivePolicyModule],
})
export class PersonalizationModule {}