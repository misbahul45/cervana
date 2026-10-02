import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { MisconceptionController } from './misconception.controller';
import { MisconceptionRepo } from './misconception.repo';
import { MisconceptionService } from './misconception.service';

@Module({
  imports: [PrismaModule],
  controllers: [MisconceptionController],
  providers: [MisconceptionService, MisconceptionRepo],
  exports: [MisconceptionService, MisconceptionRepo],
})
export class MisconceptionModule {}