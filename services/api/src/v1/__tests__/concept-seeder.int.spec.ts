import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import {
  AliasEntry,
  LinkFile,
  parseAliases,
  parseGoldenGraph,
} from '@/v1/learner-model/concepts/concept-seed';
import { ConceptSeeder } from '@/v1/learner-model/concepts/concept-seeder';
import { REGISTRY_SUITE_LOCK, databaseUrl, describeDb, holdSuiteLock } from '@/test-utils/pg-fixtures';

const seedDir = path.resolve(__dirname, '../../../prisma/seed-data');
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(seedDir, name), 'utf8'));

describeDb('concept seeder (requires TEST_DATABASE_URL)', () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
  const graph = parseGoldenGraph(read('golden-accounting-graph.json'));
  const aliases = (): AliasEntry[] => parseAliases(read('concept-aliases.json'));
  const slug = `seeder-${randomUUID().slice(0, 8)}`;
  let topicId: string;
  let releaseLock: () => Promise<void>;

  const links = (overrides: Partial<LinkFile> = {}): LinkFile => ({
    topicSlug: slug,
    subTopics: [{ title: 'S1', status: 'APPROVED', conceptIds: ['l1-t01-accounting-equation'] }],
    lessons: [{ subTopicTitle: 'S1', title: 'L1', status: 'PROPOSED', conceptIds: ['l1-t02-debits-credits'] }],
    ...overrides,
  });

  const cleanRegistry = async () => {
    await prisma.conceptCurriculumLink.deleteMany();
    await prisma.conceptAlias.deleteMany();
    await prisma.conceptPrerequisite.deleteMany();
    await prisma.concept.deleteMany({ where: { id: { startsWith: 'l' }, events: { none: {} }, masteries: { none: {} } } });
  };

  beforeAll(async () => {
    releaseLock = await holdSuiteLock(REGISTRY_SUITE_LOCK);
    const topic = await prisma.topic.create({
      data: {
        title: 'Seeder fixture',
        slug,
        image: {},
        price: 0,
        subTopics: { create: [{ title: 'S1', lessons: { create: [{ title: 'L1' }] } }] },
      },
    });
    topicId = topic.id;
  }, 120_000);

  beforeEach(cleanRegistry);

  afterAll(async () => {
    await cleanRegistry();
    await prisma.topic.delete({ where: { id: topicId } });
    await prisma.$disconnect();
    await releaseLock();
  });

  it('writes the registry and writing it again changes nothing', async () => {
    const seeder = new ConceptSeeder(prisma);

    const first = await seeder.run({ graph, aliases: aliases(), links: links() });
    const second = await seeder.run({ graph, aliases: aliases(), links: links() });

    expect(first).toEqual({ concepts: 65, prerequisites: expect.any(Number), aliases: 13, subTopicLinks: 1, lessonLinks: 1 });
    expect(second).toEqual(first);
    expect(await prisma.concept.count()).toBe(65);
    expect(await prisma.conceptPrerequisite.count()).toBe(first.prerequisites);
    expect(await prisma.conceptAlias.count()).toBe(13);
    expect(await prisma.conceptCurriculumLink.count()).toBe(2);
  });

  it('stores review status, kind and the umbrella targets of an alias', async () => {
    await new ConceptSeeder(prisma).run({ graph, aliases: aliases(), links: links() });

    const umbrella = await prisma.conceptAlias.findMany({ where: { alias: 'financial_statements' }, orderBy: { conceptId: 'asc' } });
    const unmatched = await prisma.conceptAlias.findFirstOrThrow({ where: { alias: 'contra_account' } });

    expect(umbrella.map((a) => [a.conceptId, a.kind, a.status])).toEqual([
      ['l2-t01-balance-sheet', 'UMBRELLA', 'PROPOSED'],
      ['l2-t02-income-statement', 'UMBRELLA', 'PROPOSED'],
      ['l2-t03-cash-flow-statement', 'UMBRELLA', 'PROPOSED'],
      ['l2-t04-statement-of-changes-equity', 'UMBRELLA', 'PROPOSED'],
    ]);
    expect(unmatched).toMatchObject({ conceptId: null, kind: 'UNMATCHED', status: 'PROPOSED' });
  });

  it('removes a link and an alias that the data files no longer list, and applies a status change', async () => {
    const seeder = new ConceptSeeder(prisma);
    await seeder.run({ graph, aliases: aliases(), links: links() });

    await seeder.run({
      graph,
      aliases: aliases().filter((a) => a.alias !== 'contra_account'),
      links: links({ lessons: [], subTopics: [{ title: 'S1', status: 'PROPOSED', conceptIds: ['l1-t01-accounting-equation'] }] }),
    });

    expect(await prisma.conceptAlias.count({ where: { alias: 'contra_account' } })).toBe(0);
    const remaining = await prisma.conceptCurriculumLink.findMany();
    expect(remaining.map((l) => [l.lessonId, l.status])).toEqual([[null, 'PROPOSED']]);
  });

  it('keeps a concept deprecated by hand deprecated', async () => {
    const seeder = new ConceptSeeder(prisma);
    await seeder.run({ graph, aliases: aliases(), links: links() });
    await prisma.concept.update({ where: { id: 'l1-t01-accounting-equation' }, data: { status: 'DEPRECATED' } });

    await seeder.run({ graph, aliases: aliases(), links: links() });

    expect((await prisma.concept.findUniqueOrThrow({ where: { id: 'l1-t01-accounting-equation' } })).status).toBe('DEPRECATED');
  });

  it('refuses a link to a sub-topic or lesson that does not exist and writes nothing', async () => {
    const seeder = new ConceptSeeder(prisma);

    await expect(
      seeder.run({ graph, aliases: aliases(), links: links({ subTopics: [{ title: 'No such sub-topic', status: 'APPROVED', conceptIds: ['l1-t01-accounting-equation'] }] }) }),
    ).rejects.toThrow('sub-topic "No such sub-topic" not found');
    await expect(
      seeder.run({ graph, aliases: aliases(), links: links({ lessons: [{ subTopicTitle: 'S1', title: 'No such lesson', status: 'APPROVED', conceptIds: ['l1-t01-accounting-equation'] }] }) }),
    ).rejects.toThrow('lesson "S1 / No such lesson" not found');
    expect(await prisma.concept.count()).toBe(0);
  });

  it('refuses an inconsistent seed and reports every issue', async () => {
    const bad = aliases();
    bad[0] = { ...bad[0], targets: ['nope'] };

    await expect(new ConceptSeeder(prisma).run({ graph, aliases: bad, links: links() })).rejects.toThrow(/alias accounting_equation targets unknown concept nope/);
    expect(await prisma.concept.count()).toBe(0);
  });

  it('refuses a topic that is not seeded yet with the instruction to seed it', async () => {
    await expect(
      new ConceptSeeder(prisma).run({ graph, aliases: aliases(), links: links({ topicSlug: 'not-seeded' }) }),
    ).rejects.toThrow('run seed:golden-graph first');
  });
});
