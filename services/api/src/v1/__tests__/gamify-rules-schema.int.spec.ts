import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { createPool, describeDb, expectViolation, insertUser, withRollback } from '@/test-utils/pg-fixtures';

describeDb('gamify rules schema (requires TEST_DATABASE_URL)', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = createPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  const ledger = `INSERT INTO "GamificationLedger" (id, "userId", "ruleId", "ruleVersion", points, "idempotencyKey", "sourceType", "reversalOf", reason, "actorId", kind)
                  VALUES ($1, $2, 'R', 1, $3, $4, 'X', $5, $6, $7, $8::"RewardKind")`;

  const rule = (code: string, version: number, extra = '') =>
    `INSERT INTO "RewardRule" (id, code, version, "eventType", "rewardKind", amount ${extra ? ', ' + extra.split('=')[0] : ''})
     VALUES ('${randomUUID()}', '${code}', ${version}, 'ASSESSMENT', 'XP', 10 ${extra ? ', ' + extra.split('=')[1] : ''})`;

  describe('ledger kinds', () => {
    it('defaults an entry to XP and accepts STAR', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        await c.query(`INSERT INTO "GamificationLedger" (id, "userId", "ruleId", "ruleVersion", points, "idempotencyKey", "sourceType") VALUES ($1, $2, 'R', 1, 5, $3, 'X')`, [randomUUID(), user, `k-${randomUUID()}`]);
        const star = randomUUID();
        await c.query(ledger, [star, user, 1, `k-${randomUUID()}`, null, null, null, 'STAR']);

        const { rows } = await c.query(`SELECT kind FROM "GamificationLedger" WHERE "userId" = $1 ORDER BY kind`, [user]);
        expect(rows.map((r) => r.kind)).toEqual(['XP', 'STAR']);
      }));

    it('refuses a reversal of another kind than the entry it reverses', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const original = randomUUID();
        await c.query(ledger, [original, user, 10, `k-${randomUUID()}`, null, null, null, 'XP']);

        const error = await expectViolation(c, ledger, [randomUUID(), user, -10, `k-${randomUUID()}`, original, 'why', 'admin', 'STAR']);
        expect(error.message).toMatch(/reversal/i);
        await c.query(ledger, [randomUUID(), user, -10, `k-${randomUUID()}`, original, 'why', 'admin', 'XP']);
      }));
  });

  describe('reward rule rows', () => {
    it('keeps a code and version once and needs a positive version and a non negative amount', () =>
      withRollback(pool, async (c) => {
        await c.query(rule('RULE_A', 1));
        expect((await expectViolation(c, rule('RULE_A', 1))).constraint).toBe('RewardRule_code_version_key');
        await c.query(rule('RULE_A', 2));
        expect((await expectViolation(c, rule('RULE_B', 0))).constraint).toBe('RewardRule_version_positive');
        expect((await expectViolation(c, `INSERT INTO "RewardRule" (id, code, version, "eventType", "rewardKind", amount) VALUES ('${randomUUID()}', 'RULE_C', 1, 'E', 'XP', -1)`)).constraint).toBe('RewardRule_amount_non_negative');
        expect((await expectViolation(c, `INSERT INTO "RewardRule" (id, code, version, "eventType", "rewardKind", amount, "dailyCap") VALUES ('${randomUUID()}', 'RULE_D', 1, 'E', 'XP', 1, 0)`)).constraint).toBe('RewardRule_daily_cap_positive');
      }));

    it('lets a rule be switched off but never edited: a changed number is a new version', () =>
      withRollback(pool, async (c) => {
        await c.query(rule('RULE_E', 1));

        await c.query(`UPDATE "RewardRule" SET active = false WHERE code = 'RULE_E'`);
        for (const column of ['amount = 99', `"eventType" = 'OTHER'`, `"rewardKind" = 'STAR'`, `params = '{"x":1}'::jsonb`, '"dailyCap" = 3', `code = 'RULE_F'`, 'version = 2']) {
          const error = await expectViolation(c, `UPDATE "RewardRule" SET ${column} WHERE code = 'RULE_E'`);
          expect(error.message).toMatch(/new version/i);
        }
      }));
  });

  describe('level thresholds', () => {
    it('is one row per level with a distinct non negative xp', () =>
      withRollback(pool, async (c) => {
        await c.query(`INSERT INTO "LevelThreshold" (level, xp) VALUES (9001, 5000)`);
        expect((await expectViolation(c, `INSERT INTO "LevelThreshold" (level, xp) VALUES (9001, 6000)`)).constraint).toBe('LevelThreshold_pkey');
        expect((await expectViolation(c, `INSERT INTO "LevelThreshold" (level, xp) VALUES (9002, 5000)`)).constraint).toBe('LevelThreshold_xp_key');
        expect((await expectViolation(c, `INSERT INTO "LevelThreshold" (level, xp) VALUES (0, 1)`)).constraint).toBe('LevelThreshold_level_positive');
        expect((await expectViolation(c, `INSERT INTO "LevelThreshold" (level, xp) VALUES (9003, -1)`)).constraint).toBe('LevelThreshold_xp_non_negative');
      }));
  });

  describe('achievement catalog', () => {
    it('has a unique code and an optional typed rule and icon name', () =>
      withRollback(pool, async (c) => {
        const insert = `INSERT INTO "Achievement" (id, title, type, code, rule, "iconName", "sortOrder", active) VALUES ($1, 'T', 'STREAK', $2, $3::jsonb, $4, 1, true)`;
        await c.query(insert, [randomUUID(), 'streak-3', JSON.stringify({ metric: 'STREAK_DAYS', op: '>=', value: 3 }), 'streak']);
        expect((await expectViolation(c, insert, [randomUUID(), 'streak-3', null, null])).constraint).toBe('Achievement_code_key');
      }));
  });

  describe('learner columns', () => {
    it('defaults the time zone to Asia/Jakarta, the freezes to 0 and the board opt-in to off', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const { rows } = await c.query(`SELECT timezone, "streakFreezes", "leaderboardOptIn", "leaderboardHandle" FROM "User" WHERE id = $1`, [user]);
        expect(rows[0]).toEqual({ timezone: 'Asia/Jakarta', streakFreezes: 0, leaderboardOptIn: false, leaderboardHandle: null });
      }));

    it('keeps freezes at 0 or more and handles unique, lowercase and 3 to 20 characters', () =>
      withRollback(pool, async (c) => {
        const a = await insertUser(c);
        const b = await insertUser(c);

        expect((await expectViolation(c, `UPDATE "User" SET "streakFreezes" = -1 WHERE id = $1`, [a])).constraint).toBe('User_streakFreezes_non_negative');
        await c.query(`UPDATE "User" SET "leaderboardHandle" = 'budi_01' WHERE id = $1`, [a]);
        expect((await expectViolation(c, `UPDATE "User" SET "leaderboardHandle" = 'budi_01' WHERE id = $1`, [b])).constraint).toBe('User_leaderboardHandle_key');
        for (const bad of ['ab', 'Budi_01', 'budi 01', 'a'.repeat(21), 'budi-01']) {
          const error = await expectViolation(c, `UPDATE "User" SET "leaderboardHandle" = $2 WHERE id = $1`, [b, bad]);
          expect(error.constraint).toBe('User_leaderboardHandle_format');
        }
      }));

    it('refuses an opt-in without a handle', () =>
      withRollback(pool, async (c) => {
        const a = await insertUser(c);
        expect((await expectViolation(c, `UPDATE "User" SET "leaderboardOptIn" = true WHERE id = $1`, [a])).constraint).toBe('User_leaderboard_opt_in_needs_handle');
      }));
  });
});
