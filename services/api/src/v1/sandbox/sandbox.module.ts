import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { AccountingSandboxService } from './accounting-sandbox.service';
import { GoldenScenarioProvider, GOLDEN_GRAPH, GOLDEN_SCENARIOS } from './golden-scenarios.provider';
import { SandboxController } from './sandbox.controller';

@Module({
  imports: [PrismaModule, RouterModule.register([{ path: 'sandbox', children: [{ path: '', module: SandboxModule }] }])],
  controllers: [SandboxController],
  providers: [
    AccountingSandboxService,
    GoldenScenarioProvider,
    {
      provide: GOLDEN_SCENARIOS,
      useFactory: () => GoldenScenarioProvider,
    },
    {
      provide: GOLDEN_GRAPH,
      useFactory: () => GoldenScenarioProvider,
    },
  ],
  exports: [AccountingSandboxService, GoldenScenarioProvider],
})
export class SandboxModule {}