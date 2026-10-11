import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { createPool, databaseUrl, describeDb, insertTopic, insertUser } from '@/test-utils/pg-fixtures';
import { LessonsService } from '@/v1/curriculum/lessons/lessons.service';

describeDb('lesson neighbours on a real database (requires TEST_DATABASE_URL)', () => {
  let pool: Pool;
  let prisma: PrismaService;
  let service: LessonsService;

  beforeAll(() => {
    process.env.DATABASE_URL = databaseUrl;
    pool = createPool();
    prisma = new PrismaService();
    service = new LessonsService(undefined as never, undefined as never, prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  const course = async (titles: string[]) => {
    const topic = await insertTopic(pool, 0);
    const subTopicId = randomUUID();
    await pool.query(`INSERT INTO "SubTopic" (id, title, "topicId", "updatedAt") VALUES ($1, 'Bagian uji', $2, now())`, [subTopicId, topic]);
    const ids: string[] = [];
    for (const [index, title] of titles.entries()) {
      const id = randomUUID();
      ids.push(id);
      await pool.query(`INSERT INTO "Lesson" (id, title, "subTopicId", "sortOrder", "updatedAt") VALUES ($1, $2, $3, $4, now())`, [id, title, subTopicId, index]);
    }
    return ids;
  };

  const markDone = (userId: string, lessonId: string) =>
    pool.query(`INSERT INTO "LessonProgress" (id, "userId", "lessonId", "isDone", "updatedAt") VALUES ($1, $2, $3, true, now())`, [randomUUID(), userId, lessonId]);

  it('finds the lesson before and after in the same sub-topic order', async () => {
    const [first, second, third] = await course(['Satu', 'Dua', 'Tiga']);
    const user = await insertUser(pool);

    const result = (await service.neighbours(user, second!)).data;

    expect(result.current.id).toBe(second);
    expect(result.previous?.id).toBe(first);
    expect(result.next?.id).toBe(third);
  });

  it('has no previous lesson at the start and no next lesson at the end', async () => {
    const [first, , last] = await course(['Satu', 'Dua', 'Tiga']);
    const user = await insertUser(pool);

    expect((await service.neighbours(user, first!)).data.previous).toBeNull();
    expect((await service.neighbours(user, last!)).data.next).toBeNull();
  });

  it('unlocks the next lesson only for a learner who finished the current one', async () => {
    const [first, second] = await course(['Satu', 'Dua']);
    const user = await insertUser(pool);
    const other = await insertUser(pool);
    await markDone(user, first!);

    expect((await service.neighbours(user, first!)).data.next?.unlocked).toBe(true);
    expect((await service.neighbours(other, first!)).data.next?.unlocked).toBe(false);
    expect((await service.neighbours(user, second!)).data.previous?.completed).toBe(true);
    expect((await service.neighbours(other, second!)).data.previous?.completed).toBe(false);
  });

  it('answers 404 for a lesson that does not exist', async () => {
    const user = await insertUser(pool);

    await expect(service.neighbours(user, randomUUID())).rejects.toMatchObject({ statusCode: 404 });
  });
});
