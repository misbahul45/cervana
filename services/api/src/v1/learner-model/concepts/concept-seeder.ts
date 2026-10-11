import { PrismaClient } from '@prisma/client';
import {
  ConceptSeedInput,
  ReviewStatusValue,
  aliasRows,
  conceptRows,
  prerequisiteRows,
  validateConceptSeed,
} from './concept-seed';

export interface ConceptSeedReport {
  concepts: number;
  prerequisites: number;
  aliases: number;
  subTopicLinks: number;
  lessonLinks: number;
}

export class ConceptSeedError extends Error {
  constructor(readonly issues: string[]) {
    super(issues.join('\n'));
    this.name = 'ConceptSeedError';
  }
}

interface LinkRow {
  id: string;
  conceptId: string;
  subTopicId: string | null;
  lessonId: string | null;
  status: ReviewStatusValue;
}

export class ConceptSeeder {
  constructor(private readonly prisma: PrismaClient) {}

  async run(input: ConceptSeedInput): Promise<ConceptSeedReport> {
    const issues = validateConceptSeed(input);
    if (issues.length > 0) throw new ConceptSeedError(issues);

    const links = await this.resolveLinks(input);
    const concepts = conceptRows(input.graph);
    const prerequisites = prerequisiteRows(input.graph);
    const aliases = aliasRows(input.aliases);

    await this.prisma.$transaction(async (tx) => {
      for (const concept of concepts) {
        const { id, ...values } = concept;
        await tx.concept.upsert({ where: { id }, create: concept, update: values });
      }

      await tx.conceptPrerequisite.deleteMany();
      await tx.conceptPrerequisite.createMany({ data: prerequisites });

      for (const alias of aliases) {
        const { id, ...values } = alias;
        await tx.conceptAlias.upsert({ where: { id }, create: alias, update: values });
      }
      await tx.conceptAlias.deleteMany({ where: { id: { notIn: aliases.map((a) => a.id) } } });

      for (const link of links) {
        const { id, ...values } = link;
        await tx.conceptCurriculumLink.upsert({ where: { id }, create: link, update: values });
      }
      await tx.conceptCurriculumLink.deleteMany({ where: { id: { notIn: links.map((l) => l.id) } } });
    });

    return {
      concepts: concepts.length,
      prerequisites: prerequisites.length,
      aliases: aliases.length,
      subTopicLinks: links.filter((l) => l.subTopicId !== null).length,
      lessonLinks: links.filter((l) => l.lessonId !== null).length,
    };
  }

  private async resolveLinks({ links }: ConceptSeedInput): Promise<LinkRow[]> {
    const topic = await this.prisma.topic.findUnique({
      where: { slug: links.topicSlug },
      include: { subTopics: { include: { lessons: true } } },
    });
    if (!topic) {
      throw new ConceptSeedError([`topic ${links.topicSlug} not found; run seed:golden-graph first`]);
    }

    const missing: string[] = [];
    const rows: LinkRow[] = [];

    for (const link of links.subTopics) {
      const subTopic = topic.subTopics.find((s) => s.title === link.title);
      if (!subTopic) {
        missing.push(`sub-topic "${link.title}" not found in topic ${links.topicSlug}`);
        continue;
      }
      for (const conceptId of link.conceptIds) {
        rows.push({ id: `concept-link:subtopic:${subTopic.id}:${conceptId}`, conceptId, subTopicId: subTopic.id, lessonId: null, status: link.status });
      }
    }

    for (const link of links.lessons) {
      const subTopic = topic.subTopics.find((s) => s.title === link.subTopicTitle);
      const lesson = subTopic?.lessons.find((l) => l.title === link.title);
      if (!lesson) {
        missing.push(`lesson "${link.subTopicTitle} / ${link.title}" not found in topic ${links.topicSlug}`);
        continue;
      }
      for (const conceptId of link.conceptIds) {
        rows.push({ id: `concept-link:lesson:${lesson.id}:${conceptId}`, conceptId, subTopicId: null, lessonId: lesson.id, status: link.status });
      }
    }

    if (missing.length > 0) throw new ConceptSeedError(missing);
    return rows;
  }
}
