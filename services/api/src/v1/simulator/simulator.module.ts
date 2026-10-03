import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { SimulatorEngineService } from './simulator-engine.service';
import { SimulatorController } from './simulator.controller';
import { SimulatorService } from './simulator.service';

@Module({
  imports: [PrismaModule],
  controllers: [SimulatorController],
  providers: [SimulatorService, SimulatorEngineService],
  exports: [SimulatorService, SimulatorEngineService],
})
export class SimulatorModule {}