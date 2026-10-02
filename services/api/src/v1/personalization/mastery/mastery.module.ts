import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { MasteryController } from './mastery.controller';
import { MasteryRepo } from './mastery.repo';
import { MasteryService } from './mastery.service';

@Module({
  imports: [PrismaModule],
  controllers: [MasteryController],
  providers: [MasteryService, MasteryRepo],
  exports: [MasteryService, MasteryRepo],
})
export class MasteryModule {}