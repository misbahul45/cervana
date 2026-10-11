import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { parseAliases, parseGoldenGraph } from '@/v1/learner-model/concepts/concept-seed';
import { ConceptSeeder } from '@/v1/learner-model/concepts/concept-seeder';
import { ConceptRegistryService } from '@/v1/learner-model/concepts/concept-registry.service';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { REGISTRY_SUITE_LOCK, databaseUrl, describeDb, holdSuiteLock } from '@/test-utils/pg-fixtures';

const seedDir = path.resolve(__dirname, '../../../prisma/seed-data');
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(seedDir, name), 'utf8'));

const EQUATION = 'l1-t01-accounting-equation';
const DEBITS = 'l1-t02-debits-credits';
const JOURNAL = 'l1-t03-journal-entries';
const LEDGER = 'l1-t04-ledger-accounts';
const TRIAL = 'l1-t05-trial-balance';

describeDb('concept registry service (requires TEST_DATABASE_URL)', () => {
  let prisma: PrismaService;
  let registry: ConceptRegistryService;
  let subTopicId: string;
  let lessonOne: string;
  let lessonTwo: string;
  let bareSubTopic: string;
  let proposedSubTopic: string;
  let topicId: string;
  let releaseLock: () => Promise<void>;

  beforeAll(async () => {
    releaseLock = await holdSuiteLock(REGISTRY_SUITE_LOCK);
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    registry = new ConceptRegistryService(prisma);

    const slug = `registry-${randomUUID().slice(0, 8)}`;
    const topic = await prisma.topic.create({
      data: {
        title: 'Registry fixture',
        slug,
        image: {},
        price: 0,
        subTopics: {
          create: [
            { title: 'S1', lessons: { create: [{ title: 'L1' }, { title: 'L2' }] } },
            { title: 'Bare' },
            { title: 'Proposed' },
          ],
        },
      },
      include: { subTopics: { include: { lessons: true } } },
    });
    topicId = topic.id;
    const s1 = topic.subTopics.find((s) => s.title === 'S1')!;
    subTopicId = s1.id;
    lessonOne = s1.lessons.find((l) => l.title === 'L1')!.id;
    lessonTwo = s1.lessons.find((l) => l.title === 'L2')!.id;
    bareSubTopic = topic.subTopics.find((s) => s.title === 'Bare')!.id;
    proposedSubTopic = topic.subTopics.find((s) => s.title === 'Proposed')!.id;

    await new ConceptSeeder(prisma).run({
      graph: parseGoldenGraph(read('golden-accounting-graph.json')),
      aliases: parseAliases(read('concept-aliases.json')),
      links: {
        topicSlug: slug,
        subTopics: [
          { title: 'S1', status: 'APPROVED', conceptIds: [EQUATION, DEBITS] },
          { title: 'Proposed', status: 'PROPOSED', conceptIds: [EQUATION] },
        ],
        lessons: [
          { subTopicTitle: 'S1', title: 'L1', status: 'APPROVED', conceptIds: [JOURNAL] },
          { subTopicTitle: 'S1', title: 'L2', status: 'PROPOSED', conceptIds: [LEDGER] },
        ],
      },
    });
  }, 120_000);

  afterAll(async () => {
    await prisma.conceptCurriculumLink.deleteMany();
    await prisma.topic.delete({ where: { id: topicId } });
    await prisma.$disconnect();
    await releaseLock();
  });

  it('lists the active concepts in teaching order with their prerequisites', async () => {
    const concepts = await registry.listActive();

    expect(concepts).toHaveLength(65);
    expect(concepts[0]).toMatchObject({ id: EQUATION, level: 1, sortOrder: 1, prerequisiteIds: [] });
    expect(concepts.find((c) => c.id === TRIAL)?.prerequisiteIds).toEqual([LEDGER]);
    const levels = concepts.map((c) => c.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });

  it('leaves a deprecated concept out of the list and still returns it by id', async () => {
    await prisma.concept.update({ where: { id: LEDGER }, data: { status: 'DEPRECATED' } });
    try {
      expect((await registry.listActive()).some((c) => c.id === LEDGER)).toBe(false);
      expect(await registry.get(LEDGER)).toMatchObject({ id: LEDGER });
    } finally {
      await prisma.concept.update({ where: { id: LEDGER }, data: { status: 'ACTIVE' } });
    }
  });

  it('returns null for an unknown concept', async () => {
    expect(await registry.get('nope')).toBeNull();
  });

  it('returns the whole chain of prerequisites of a concept in teaching order', async () => {
    expect(await registry.prerequisiteClosure(TRIAL)).toEqual([EQUATION, DEBITS, JOURNAL, LEDGER]);
  });

  it('resolves only approved aliases of active concepts', async () => {
    expect(await registry.resolveAlias('PYTHON_DOMAIN', 'accounting_equation')).toEqual([EQUATION]);
    expect(await registry.resolveAlias('PYTHON_DOMAIN', 'normal_balance')).toEqual([]);
    expect(await registry.resolveAlias('PYTHON_DOMAIN', 'financial_statements')).toEqual([]);
    expect(await registry.resolveAlias('PYTHON_DOMAIN', 'contra_account')).toEqual([]);
    expect(await registry.resolveAlias('PYTHON_DOMAIN', 'unknown_id')).toEqual([]);
    expect(await registry.resolveAlias('OTHER_SCHEME', 'accounting_equation')).toEqual([]);
  });

  it('lists the approved aliases of a scheme for the catalog', async () => {
    const aliases = await registry.approvedAliases('PYTHON_DOMAIN');

    expect(Object.keys(aliases).sort()).toEqual([
      'accounting_equation',
      'accrual_vs_cash',
      'adjusting_entry',
      'double_entry',
      'journal_entry',
      'revenue_recognition',
      'trial_balance',
    ]);
    expect(aliases.double_entry).toEqual(['l1-t13-double-entry-logic']);
  });

  describe('concepts of a quiz location', () => {
    it('prefers the approved links of the lesson', async () => {
      expect(await registry.conceptsForCurriculum({ lessonId: lessonOne, subTopicId })).toEqual({ source: 'LESSON', conceptIds: [JOURNAL] });
    });

    it('falls back to the sub-topic when the lesson has no approved link', async () => {
      expect(await registry.conceptsForCurriculum({ lessonId: lessonTwo, subTopicId })).toEqual({ source: 'SUBTOPIC', conceptIds: [EQUATION, DEBITS] });
    });

    it('uses the sub-topic when there is no lesson', async () => {
      expect(await registry.conceptsForCurriculum({ lessonId: null, subTopicId })).toEqual({ source: 'SUBTOPIC', conceptIds: [EQUATION, DEBITS] });
    });

    it('returns nothing when no approved link exists', async () => {
      expect(await registry.conceptsForCurriculum({ lessonId: null, subTopicId: bareSubTopic })).toEqual({ source: 'NONE', conceptIds: [] });
      expect(await registry.conceptsForCurriculum({ lessonId: null, subTopicId: proposedSubTopic })).toEqual({ source: 'NONE', conceptIds: [] });
      expect(await registry.conceptsForCurriculum({ lessonId: null, subTopicId: null })).toEqual({ source: 'NONE', conceptIds: [] });
    });

    it('resolves a lesson id to its concepts through the lesson and then its sub-topic', async () => {
      expect(await registry.conceptsForLesson(lessonOne)).toEqual({ source: 'LESSON', conceptIds: [JOURNAL] });
      expect(await registry.conceptsForLesson(lessonTwo)).toEqual({ source: 'SUBTOPIC', conceptIds: [EQUATION, DEBITS] });
    });

    it('returns nothing for a lesson id that does not exist', async () => {
      expect(await registry.conceptsForLesson(randomUUID())).toEqual({ source: 'NONE', conceptIds: [] });
    });

    it('ignores links to a deprecated concept', async () => {
      await prisma.concept.update({ where: { id: JOURNAL }, data: { status: 'DEPRECATED' } });
      try {
        expect(await registry.conceptsForCurriculum({ lessonId: lessonOne, subTopicId })).toEqual({ source: 'SUBTOPIC', conceptIds: [EQUATION, DEBITS] });
      } finally {
        await prisma.concept.update({ where: { id: JOURNAL }, data: { status: 'ACTIVE' } });
      }
    });
  });
});
