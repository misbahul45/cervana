import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { DecisionTraceController } from './decision-trace.controller';
import { DecisionTraceService } from './decision-trace.service';

@Module({
  imports: [PrismaModule],
  controllers: [DecisionTraceController],
  providers: [DecisionTraceService],
  exports: [DecisionTraceService],
})
export class DecisionTraceModule {}