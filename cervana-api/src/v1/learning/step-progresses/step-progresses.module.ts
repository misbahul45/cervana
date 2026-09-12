import { Module } from '@nestjs/common';
import { StepProgressesService } from './step-progresses.service';
import { StepProgressesController } from './step-progresses.controller';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { StepProgressesRepo } from './step-progresses.repo';

@Module({
  imports:[PrismaModule],
  controllers: [StepProgressesController],
  providers: [StepProgressesService, StepProgressesRepo],
})
export class StepProgressesModule {}
