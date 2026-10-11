import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { buildConceptGraph } from './concept-graph';
import { ConceptView, CurriculumConcepts, CurriculumReference } from './concept.types';

const conceptSelect = {
  id: true,
  title: true,
  description: true,
  level: true,
  sortOrder: true,
  estimatedMinutes: true,
  prerequisites: { select: { requiresId: true } },
} as const;

interface ConceptRecord {
  id: string;
  title: string;
  description: string | null;
  level: number;
  sortOrder: number;
  estimatedMinutes: number | null;
  prerequisites: Array<{ requiresId: string }>;
}

const toView = (record: ConceptRecord): ConceptView => ({
  id: record.id,
  title: record.title,
  description: record.description,
  level: record.level,
  sortOrder: record.sortOrder,
  estimatedMinutes: record.estimatedMinutes,
  prerequisiteIds: record.prerequisites.map((p) => p.requiresId).sort(),
});

@Injectable()
export class ConceptRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(): Promise<ConceptView[]> {
    const records = await this.prisma.concept.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
      select: conceptSelect,
    });
    return records.map(toView);
  }

  async get(id: string): Promise<ConceptView | null> {
    const record = await this.prisma.concept.findUnique({ where: { id }, select: conceptSelect });
    return record ? toView(record) : null;
  }

  async prerequisiteClosure(id: string): Promise<string[]> {
    return buildConceptGraph(await this.listActive()).closureOf(id);
  }

  async resolveAlias(scheme: string, alias: string): Promise<string[]> {
    const rows = await this.prisma.conceptAlias.findMany({
      where: { scheme, alias, status: 'APPROVED', concept: { status: 'ACTIVE' } },
      select: { conceptId: true },
    });
    return rows.flatMap((row) => (row.conceptId ? [row.conceptId] : [])).sort();
  }

  async approvedAliases(scheme: string): Promise<Record<string, string[]>> {
    const rows = await this.prisma.conceptAlias.findMany({
      where: { scheme, status: 'APPROVED', concept: { status: 'ACTIVE' } },
      select: { alias: true, conceptId: true },
      orderBy: [{ alias: 'asc' }, { conceptId: 'asc' }],
    });
    const aliases: Record<string, string[]> = {};
    for (const row of rows) {
      if (row.conceptId) (aliases[row.alias] ??= []).push(row.conceptId);
    }
    return aliases;
  }

  async conceptsForCurriculum({ lessonId, subTopicId }: CurriculumReference): Promise<CurriculumConcepts> {
    if (lessonId) {
      const conceptIds = await this.approvedLinkTargets({ lessonId });
      if (conceptIds.length > 0) return { source: 'LESSON', conceptIds };
    }
    if (subTopicId) {
      const conceptIds = await this.approvedLinkTargets({ subTopicId });
      if (conceptIds.length > 0) return { source: 'SUBTOPIC', conceptIds };
    }
    return { source: 'NONE', conceptIds: [] };
  }

  async conceptsForLesson(lessonId: string): Promise<CurriculumConcepts> {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId }, select: { subTopicId: true } });
    if (!lesson) return { source: 'NONE', conceptIds: [] };
    return this.conceptsForCurriculum({ lessonId, subTopicId: lesson.subTopicId });
  }

  async topicConceptIds(topicId: string): Promise<string[]> {
    const rows = await this.prisma.conceptCurriculumLink.findMany({
      where: {
        status: 'APPROVED',
        concept: { status: 'ACTIVE' },
        OR: [{ subTopic: { topicId } }, { lesson: { subTopic: { topicId } } }],
      },
      select: { conceptId: true },
    });
    return [...new Set(rows.map((row) => row.conceptId))].sort();
  }

  async subTopicConceptIds(subTopicId: string): Promise<string[]> {
    const rows = await this.prisma.conceptCurriculumLink.findMany({
      where: {
        status: 'APPROVED',
        concept: { status: 'ACTIVE' },
        OR: [{ subTopicId }, { lesson: { subTopicId } }],
      },
      select: { conceptId: true },
    });
    return [...new Set(rows.map((row) => row.conceptId))].sort();
  }

  private async approvedLinkTargets(target: { lessonId: string } | { subTopicId: string }): Promise<string[]> {
    const rows = await this.prisma.conceptCurriculumLink.findMany({
      where: { ...target, status: 'APPROVED', concept: { status: 'ACTIVE' } },
      select: { conceptId: true },
      orderBy: { conceptId: 'asc' },
    });
    return rows.map((row) => row.conceptId);
  }
}
