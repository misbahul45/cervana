import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { AdaptivePolicyController } from './adaptive-policy.controller';
import { AdaptivePolicyRepo } from './adaptive-policy.repo';
import { AdaptivePolicyService } from './adaptive-policy.service';
import { MasteryRepo } from '../mastery/mastery.repo';
import { MisconceptionRepo } from '../misconception/misconception.repo';

const FALLBACK_GRAPH = {
  levels: [
    { id: 1, title: 'L1', topics: [{ id: 'l1-t01-accounting-equation', title: 'Equation', prerequisites: [] }] },
  ],
};

@Module({
  imports: [PrismaModule],
  controllers: [AdaptivePolicyController],
  providers: [
    AdaptivePolicyService,
    AdaptivePolicyRepo,
    MasteryRepo,
    MisconceptionRepo,
    {
      provide: 'GOLDEN_GRAPH',
      useFactory: () => {
        try {
          const fs = require('fs');
          const path = require('path');
          const candidates = [
            path.join(process.cwd(), 'prisma', 'seed-data', 'golden-accounting-graph.json'),
            path.join(__dirname, '..', '..', '..', 'prisma', 'seed-data', 'golden-accounting-graph.json'),
          ];
          for (const file of candidates) {
            if (fs.existsSync(file)) {
              return JSON.parse(fs.readFileSync(file, 'utf-8'));
            }
          }
        } catch {
          // ignore and fall back
        }
        return FALLBACK_GRAPH;
      },
    },
  ],
  exports: [AdaptivePolicyService],
})
export class AdaptivePolicyModule {}