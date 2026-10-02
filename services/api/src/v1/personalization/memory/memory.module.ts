import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { MemoryController } from './memory.controller';
import { MemoryRepo } from './memory.repo';
import { MemoryService } from './memory.service';

@Module({
  imports: [PrismaModule],
  controllers: [MemoryController],
  providers: [MemoryService, MemoryRepo],
  exports: [MemoryService, MemoryRepo],
})
export class MemoryModule {}