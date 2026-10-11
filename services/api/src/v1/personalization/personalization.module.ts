import { Module } from '@nestjs/common';
import { MisconceptionModule } from './misconception/misconception.module';
import { MemoryModule } from './memory/memory.module';

@Module({
  imports: [MisconceptionModule, MemoryModule],
  exports: [MisconceptionModule, MemoryModule],
})
export class PersonalizationModule {}
