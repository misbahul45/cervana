import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { AssessmentPayload } from '@/v1/learner-model/mastery/assessment-payload';
import { ConceptRegistryService } from '@/v1/learner-model/concepts/concept-registry.service';
import { LearnerEventsService } from '@/v1/learner-model/events/learner-events.service';
import { LearnerPolicyService } from '@/v1/learner-model/policy/learner-policy.service';
import { LearnerStateService } from '@/v1/learner-model/learner-state.service';
import { isCreatorEligible } from '@/v1/learner-model/mastery/topic-aggregate';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { REGISTRY_SUITE_LOCK, createPool, databaseUrl, describeDb, holdSuiteLock, insertUser } from '@/test-utils/pg-fixtures';

const payload = (): AssessmentPayload => ({
  attemptId: randomUUID(),
  quizId: 'quiz-1',
  score: 1,
  items: 5,
  hintsUsed: 0,
  share: 1,
  attemptNumber: 1,
});

describeDb('topic mastery over concept links (requires TEST_DATABASE_URL)', () => {
  let prisma: PrismaService;
  let pool: Pool;
  let registry: ConceptRegistryService;
  let events: LearnerEventsService;
  let state: LearnerStateService;
  let releaseLock: () => Promise<void>;

  const tag = randomUUID().slice(0, 8);
  const concept = (name: string) => `tm-${tag}-${name}`;
  const ids = {
    onSubTopic: concept('on-subtopic'),
    onLesson: concept('on-lesson'),
    onBoth: concept('on-both'),
    proposed: concept('proposed'),
    rejected: concept('rejected'),
    deprecated: concept('deprecated'),
    otherTopic: concept('other-topic'),
  };
  const users: string[] = [];
  let topicId: string;
  let otherTopicId: string;
  let emptyTopicId: string;
  let subTopicOne: string;
  let subTopicTwo: string;

  const link = (conceptId: string, target: { subTopicId?: string; lessonId?: string }, status: 'APPROVED' | 'PROPOSED' | 'REJECTED' = 'APPROVED') =>
    prisma.conceptCurriculumLink.create({ data: { id: randomUUID(), conceptId, status, ...target } });

  const evidence = async (userId: string, conceptId: string, times: number) => {
    let last = 0;
    for (let n = 0; n < times; n += 1) {
      const result = await events.append({ userId, conceptId, idempotencyKey: randomUUID(), payload: payload() });
      last = result.state.score;
    }
    return last;
  };

  beforeAll(async () => {
    releaseLock = await holdSuiteLock(REGISTRY_SUITE_LOCK);
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    pool = createPool();
    registry = new ConceptRegistryService(prisma);
    events = new LearnerEventsService(prisma);
    state = new LearnerStateService(prisma, registry, new LearnerPolicyService());

    for (const [index, id] of Object.values(ids).entries()) {
      await prisma.concept.create({
        data: { id, title: id, level: 1, sortOrder: index + 1, status: id === ids.deprecated ? 'DEPRECATED' : 'ACTIVE' },
      });
    }

    const topic = await prisma.topic.create({
      data: {
        title: 'Topic fixture',
        slug: `tm-${tag}`,
        image: {},
        price: 0,
        subTopics: {
          create: [
            { title: 'S1', lessons: { create: [{ title: 'L1' }, { title: 'L2' }] } },
            { title: 'S2', lessons: { create: [{ title: 'L3' }] } },
          ],
        },
      },
      include: { subTopics: { include: { lessons: true } } },
    });
    topicId = topic.id;
    const s1 = topic.subTopics.find((s) => s.title === 'S1')!;
    const s2 = topic.subTopics.find((s) => s.title === 'S2')!;
    const l1 = s1.lessons.find((l) => l.title === 'L1')!;
    const l2 = s1.lessons.find((l) => l.title === 'L2')!;
    const l3 = s2.lessons[0];
    subTopicOne = s1.id;
    subTopicTwo = s2.id;

    const other = await prisma.topic.create({
      data: { title: 'Other topic fixture', slug: `tm-other-${tag}`, image: {}, price: 0, subTopics: { create: [{ title: 'O1' }] } },
      include: { subTopics: true },
    });
    otherTopicId = other.id;
    emptyTopicId = (
      await prisma.topic.create({ data: { title: 'Empty topic fixture', slug: `tm-empty-${tag}`, image: {}, price: 0 } })
    ).id;

    await link(ids.onSubTopic, { subTopicId: s1.id });
    await link(ids.onLesson, { lessonId: l1.id });
    await link(ids.onBoth, { subTopicId: s2.id });
    await link(ids.onBoth, { lessonId: l3.id });
    await link(ids.proposed, { lessonId: l2.id }, 'PROPOSED');
    await link(ids.rejected, { subTopicId: s2.id }, 'REJECTED');
    await link(ids.deprecated, { lessonId: l3.id });
    await link(ids.otherTopic, { subTopicId: other.subTopics[0].id });
  }, 120_000);

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.conceptCurriculumLink.deleteMany({ where: { conceptId: { in: Object.values(ids) } } });
    await prisma.topic.deleteMany({ where: { id: { in: [topicId, otherTopicId, emptyTopicId] } } });
    await prisma.concept.deleteMany({ where: { id: { in: Object.values(ids) } } });
    await prisma.$disconnect();
    await pool.end();
    await releaseLock();
  });

  const newUser = async () => {
    const id = await insertUser(pool);
    users.push(id);
    return id;
  };

  describe('topicConceptIds', () => {
    it('is the distinct union of approved links on the sub-topics and on the lessons of the topic', async () => {
      expect(await registry.topicConceptIds(topicId)).toEqual([ids.onBoth, ids.onLesson, ids.onSubTopic].sort());
    });

    it('leaves out proposed and rejected links, deprecated concepts and concepts of another topic', async () => {
      const found = await registry.topicConceptIds(topicId);

      for (const excluded of [ids.proposed, ids.rejected, ids.deprecated, ids.otherTopic]) {
        expect(found).not.toContain(excluded);
      }
      expect(await registry.topicConceptIds(otherTopicId)).toEqual([ids.otherTopic]);
    });

    it('is empty for a topic without links and for an unknown topic', async () => {
      expect(await registry.topicConceptIds(emptyTopicId)).toEqual([]);
      expect(await registry.topicConceptIds(randomUUID())).toEqual([]);
    });
  });

  describe('subTopicConceptIds', () => {
    it('is the approved links of the sub-topic and of its lessons, distinct and sorted', async () => {
      expect(await registry.subTopicConceptIds(subTopicOne)).toEqual([ids.onLesson, ids.onSubTopic].sort());
      expect(await registry.subTopicConceptIds(subTopicTwo)).toEqual([ids.onBoth]);
    });

    it('leaves out proposed, rejected and deprecated links and is empty for an unknown sub-topic', async () => {
      const all = [...(await registry.subTopicConceptIds(subTopicOne)), ...(await registry.subTopicConceptIds(subTopicTwo))];

      for (const excluded of [ids.proposed, ids.rejected, ids.deprecated, ids.otherTopic]) {
        expect(all).not.toContain(excluded);
      }
      expect(await registry.subTopicConceptIds(randomUUID())).toEqual([]);
    });
  });

  describe('topicMastery', () => {
    it("averages the learner's real concept scores over the topic's concepts and counts untouched ones as zero", async () => {
      const user = await newUser();
      const first = await evidence(user, ids.onSubTopic, 3);
      const second = await evidence(user, ids.onLesson, 1);

      const aggregate = await state.topicMastery(user, topicId);

      expect(aggregate.totalConcepts).toBe(3);
      expect(aggregate.score).toBeCloseTo((first + second + 0) / 3, 10);
      expect(aggregate.evidenceCount).toBe(4);
      expect(aggregate.passedConcepts).toBe(1);
      expect(aggregate.lastEventAt).toBeInstanceOf(Date);
      expect(isCreatorEligible(aggregate)).toBe(false);
    });

    it('does not count the evidence of another learner or evidence on a concept outside the topic', async () => {
      const user = await newUser();
      const other = await newUser();
      await evidence(other, ids.onSubTopic, 3);
      await evidence(user, ids.otherTopic, 3);

      const aggregate = await state.topicMastery(user, topicId);

      expect(aggregate.score).toBe(0);
      expect(aggregate.evidenceCount).toBe(0);
    });

    it('has no score for a topic without approved concepts', async () => {
      const user = await newUser();

      expect(await state.topicMastery(user, emptyTopicId)).toMatchObject({ score: null, totalConcepts: 0 });
    });

    it('does not make a creator eligible after five perfect assessments on every concept (score 0.8198)', async () => {
      const user = await newUser();
      for (const conceptId of [ids.onSubTopic, ids.onLesson, ids.onBoth]) await evidence(user, conceptId, 5);

      const aggregate = await state.topicMastery(user, topicId);

      expect(aggregate.passedConcepts).toBe(3);
      expect(aggregate.score).toBeCloseTo(0.8198, 3);
      expect(isCreatorEligible(aggregate)).toBe(false);
    });

    it('makes a creator eligible after seven perfect assessments on every concept (score 0.8560)', async () => {
      const user = await newUser();
      for (const conceptId of [ids.onSubTopic, ids.onLesson, ids.onBoth]) await evidence(user, conceptId, 7);

      const aggregate = await state.topicMastery(user, topicId);

      expect(aggregate.score).toBeCloseTo(0.856, 3);
      expect(isCreatorEligible(aggregate)).toBe(true);
    });
  });
});
