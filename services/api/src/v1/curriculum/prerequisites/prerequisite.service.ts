import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

export interface CycleResult {
  hasCycle: boolean;
  cycle: string[];
}

@Injectable()
export class PrerequisiteService {
  constructor(private readonly prisma: PrismaService) {}

  async detectCycle(subTopicId: string): Promise<CycleResult> {
    const visited = new Set<string>();
    const onStack = new Set<string>();
    const path: string[] = [];

    const visit = async (id: string): Promise<string[] | null> => {
      if (onStack.has(id)) {
        const cycleStart = path.indexOf(id);
        return cycleStart >= 0 ? [...path.slice(cycleStart), id] : [id, id];
      }
      if (visited.has(id)) return null;
      visited.add(id);
      onStack.add(id);
      path.push(id);

      const requires = await this.prisma.subTopicPrerequisite.findMany({
        where: { subTopicId: id },
        select: { requiresId: true },
      });
      for (const r of requires) {
        const cycle = await visit(r.requiresId);
        if (cycle) return cycle;
      }

      onStack.delete(id);
      path.pop();
      return null;
    };

    const cycle = await visit(subTopicId);
    return { hasCycle: cycle !== null, cycle: cycle ?? [] };
  }

  async addPrerequisite(subTopicId: string, requiresId: string) {
    if (subTopicId === requiresId) {
      throw new Error('A SubTopic cannot be its own prerequisite');
    }

    const existing = await this.prisma.subTopicPrerequisite.findUnique({
      where: { subTopicId_requiresId: { subTopicId, requiresId } },
    });
    if (existing) {
      throw new Error('Prerequisite already exists');
    }

    const cycle = await this.detectCycle(requiresId);
    if (cycle.hasCycle && cycle.cycle.includes(subTopicId)) {
      throw new Error(`Adding this prerequisite would create a cycle: ${cycle.cycle.join(' -> ')}`);
    }

    return await this.prisma.subTopicPrerequisite.create({
      data: { subTopicId, requiresId },
    });
  }

  async getPrerequisites(subTopicId: string) {
    return await this.prisma.subTopicPrerequisite.findMany({
      where: { subTopicId },
      include: { requires: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }
}
