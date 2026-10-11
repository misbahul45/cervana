import { randomUUID } from 'crypto';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { DEFAULT_ACHIEVEMENTS } from '@/v1/gamify/seed/default-catalog';
import { GamifySeeder } from '@/v1/gamify/seed/gamify-seeder';
import { DEFAULT_LEVELS } from '@/v1/gamify/me/level-progress';
import { DEFAULT_REWARD_RULE_ROWS, DEFAULT_RULE_SET, buildRuleSet } from '@/v1/gamify/rewards/reward-rules';
import { REGISTRY_SUITE_LOCK, databaseUrl, describeDb, holdSuiteLock } from '@/test-utils/pg-fixtures';

describeDb('gamify seeder (requires TEST_DATABASE_URL)', () => {
  let prisma: PrismaService;
  let seeder: GamifySeeder;
  let releaseLock: () => Promise<void>;

  const snapshot = async () => ({
    rules: await prisma.rewardRule.count(),
    levels: await prisma.levelThreshold.count(),
    achievements: await prisma.achievement.count({ where: { code: { in: DEFAULT_ACHIEVEMENTS.map((a) => a.code) } } }),
  });

  const restoreDefaultRules = () =>
    prisma.rewardRule.updateMany({
      where: { OR: DEFAULT_REWARD_RULE_ROWS.map((row) => ({ code: row.code, version: row.version })) },
      data: { active: true },
    });

  beforeAll(async () => {
    releaseLock = await holdSuiteLock(REGISTRY_SUITE_LOCK);
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    seeder = new GamifySeeder(prisma);
    await prisma.levelThreshold.deleteMany();
    await prisma.rewardRule.updateMany({ data: { active: false } });
    await restoreDefaultRules();
    await prisma.achievement.deleteMany({ where: { code: { in: DEFAULT_ACHIEVEMENTS.map((a) => a.code) } } });
  });

  afterAll(async () => {
    await prisma.levelThreshold.deleteMany();
    await restoreDefaultRules();
    await prisma.achievement.deleteMany({ where: { code: { in: DEFAULT_ACHIEVEMENTS.map((a) => a.code) } } });
    await prisma.$disconnect();
    await releaseLock();
  });

  it('writes the default reward rules, the level thresholds and the achievement catalog', async () => {
    const report = await seeder.run();

    expect(report).toEqual({ rules: DEFAULT_REWARD_RULE_ROWS.length, levels: DEFAULT_LEVELS.length, achievements: DEFAULT_ACHIEVEMENTS.length });
    const levels = await prisma.levelThreshold.findMany({ orderBy: { level: 'asc' } });
    expect(levels.map((l) => [l.level, l.xp])).toEqual(DEFAULT_LEVELS.map((l) => [l.level, l.xp]));
    const rows = await prisma.rewardRule.findMany({ where: { code: { in: DEFAULT_REWARD_RULE_ROWS.map((r) => r.code) }, version: 1 } });
    expect(rows).toHaveLength(DEFAULT_REWARD_RULE_ROWS.length);
    expect(rows.every((r) => r.active)).toBe(true);
    const catalog = await prisma.achievement.findMany({ where: { code: { in: DEFAULT_ACHIEVEMENTS.map((a) => a.code) } }, orderBy: { sortOrder: 'asc' } });
    expect(catalog.map((a) => a.code)).toEqual([...DEFAULT_ACHIEVEMENTS].sort((a, b) => a.sortOrder - b.sortOrder).map((a) => a.code));
    expect(catalog[0]).toMatchObject({ active: true, iconName: DEFAULT_ACHIEVEMENTS[0].iconName });
  });

  it('seeds rule rows that give exactly the default rule set', async () => {
    const rows = await prisma.rewardRule.findMany({ where: { active: true } });

    const set = buildRuleSet(rows.map((r) => ({ code: r.code, version: r.version, eventType: r.eventType, rewardKind: r.rewardKind, amount: r.amount, dailyCap: r.dailyCap, params: r.params, active: r.active })));

    expect(set).toEqual(DEFAULT_RULE_SET);
  });

  it('is idempotent: a second run changes no count', async () => {
    const before = await snapshot();

    await seeder.run();

    expect(await snapshot()).toEqual(before);
  });

  it('never overwrites what an admin changed: a tuned achievement, a stored threshold and a switched off rule stay', async () => {
    const code = DEFAULT_ACHIEVEMENTS[0].code;
    await prisma.achievement.update({ where: { code }, data: { title: 'Judul admin', active: false } });
    await prisma.levelThreshold.update({ where: { level: 2 }, data: { xp: 111 } });
    await prisma.rewardRule.update({ where: { code_version: { code: 'CONCEPT_PASSED', version: 1 } }, data: { active: false } });

    await seeder.run();

    expect(await prisma.achievement.findUniqueOrThrow({ where: { code } })).toMatchObject({ title: 'Judul admin', active: false });
    expect((await prisma.levelThreshold.findUniqueOrThrow({ where: { level: 2 } })).xp).toBe(111);
    expect((await prisma.rewardRule.findUniqueOrThrow({ where: { code_version: { code: 'CONCEPT_PASSED', version: 1 } } })).active).toBe(false);
  });

  it('adds a missing catalog entry without touching the others', async () => {
    const code = DEFAULT_ACHIEVEMENTS[1].code;
    await prisma.achievement.delete({ where: { code } });

    await seeder.run();

    expect(await prisma.achievement.count({ where: { code } })).toBe(1);
    expect(await prisma.achievement.findUniqueOrThrow({ where: { code: DEFAULT_ACHIEVEMENTS[0].code } })).toMatchObject({ title: 'Judul admin' });
  });
});
