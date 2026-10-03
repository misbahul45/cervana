import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { SkillNodeController } from './skill-node.controller';
import { SkillNodeRepo } from './skill-node.repo';
import { SkillNodeService } from './skill-node.service';
import { MasteryRepo } from '../mastery/mastery.repo';

const fs = require('fs');
const path = require('path');

function loadGoldenGraph() {
  try {
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
    // ignore
  }
  return { levels: [] };
}

@Module({
  imports: [PrismaModule],
  controllers: [SkillNodeController],
  providers: [
    SkillNodeService,
    SkillNodeRepo,
    MasteryRepo,
    { provide: 'GOLDEN_GRAPH', useFactory: () => loadGoldenGraph() },
  ],
  exports: [SkillNodeService, SkillNodeRepo, 'GOLDEN_GRAPH'],
})
export class SkillNodeModule {}