import { randomUUID } from 'crypto';
import { Pool, PoolClient } from 'pg';
import { createPool, describeDb, expectViolation, insertUser, withRollback } from '@/test-utils/pg-fixtures';

const insertEntry = (
  client: PoolClient,
  values: { userId: string; points?: number; key?: string; reversalOf?: string | null; reason?: string | null; actorId?: string | null; id?: string },
) => {
  const id = values.id ?? randomUUID();
  return client
    .query(
      `INSERT INTO "GamificationLedger" (id, "userId", "ruleId", "ruleVersion", points, "idempotencyKey", "sourceType", "reversalOf", reason, "actorId")
       VALUES ($1, $2, 'MASTERY_PROGRESS', 1, $3, $4, 'LEARNING_EVENT', $5, $6, $7)`,
      [id, values.userId, values.points ?? 10, values.key ?? `k-${randomUUID()}`, values.reversalOf ?? null, values.reason ?? null, values.actorId ?? null],
    )
    .then(() => id);
};

describeDb('reward ledger schema (requires TEST_DATABASE_URL)', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = createPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  const insertSql = `INSERT INTO "GamificationLedger" (id, "userId", "ruleId", "ruleVersion", points, "idempotencyKey", "sourceType", "reversalOf", reason, "actorId")
                     VALUES (gen_random_uuid(), $1, 'R', 1, $2, $3, 'X', $4, $5, $6)`;

  it('refuses a zero amount, a negative grant and a positive reversal', () =>
    withRollback(pool, async (c) => {
      const user = await insertUser(c);
      const original = await insertEntry(c, { userId: user, points: 10 });

      expect((await expectViolation(c, insertSql, [user, 0, 'k1', null, null, null])).constraint).toBe('GamificationLedger_points_nonzero');
      expect((await expectViolation(c, insertSql, [user, -5, 'k2', null, null, null])).constraint).toBe('GamificationLedger_sign_matches_kind');
      expect((await expectViolation(c, insertSql, [user, 10, 'k3', original, 'why', 'admin'])).message).toMatch(/reversal/i);
    }));

  it('needs a reason and an actor for a reversal', () =>
    withRollback(pool, async (c) => {
      const user = await insertUser(c);
      const original = await insertEntry(c, { userId: user, points: 10 });

      expect((await expectViolation(c, insertSql, [user, -10, 'k1', original, null, 'admin'])).constraint).toBe('GamificationLedger_reversal_needs_reason_and_actor');
      expect((await expectViolation(c, insertSql, [user, -10, 'k2', original, 'why', null])).constraint).toBe('GamificationLedger_reversal_needs_reason_and_actor');
    }));

  it('refuses a duplicate idempotency key', () =>
    withRollback(pool, async (c) => {
      const user = await insertUser(c);
      await insertEntry(c, { userId: user, key: 'same' });

      expect((await expectViolation(c, insertSql, [user, 5, 'same', null, null, null])).constraint).toBe('GamificationLedger_idempotencyKey_key');
    }));

  it('never lets a stored entry be updated', () =>
    withRollback(pool, async (c) => {
      const user = await insertUser(c);
      const id = await insertEntry(c, { userId: user });

      const error = await expectViolation(c, `UPDATE "GamificationLedger" SET points = 99 WHERE id = $1`, [id]);

      expect(error.message).toMatch(/append-only/i);
    }));

  describe('reversals', () => {
    it('accept the exact opposite of an entry of the same learner', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const original = await insertEntry(c, { userId: user, points: 12 });

        await insertEntry(c, { userId: user, points: -12, reversalOf: original, reason: 'abuse', actorId: 'admin' });

        const { rows } = await c.query(`SELECT sum(points)::int AS total FROM "GamificationLedger" WHERE "userId" = $1`, [user]);
        expect(rows[0].total).toBe(0);
      }));

    it('refuse another amount, another learner, an unknown original and a reversal of a reversal', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const other = await insertUser(c);
        const forAmount = await insertEntry(c, { userId: user, points: 12 });
        const forLearner = await insertEntry(c, { userId: user, points: 12 });
        const reversed = await insertEntry(c, { userId: user, points: 12 });
        const reversal = await insertEntry(c, { userId: user, points: -12, reversalOf: reversed, reason: 'abuse', actorId: 'admin' });
        const mismatch = /reversal must equal minus an original entry of the same learner/;

        expect((await expectViolation(c, insertSql, [user, -5, 'a', forAmount, 'r', 'admin'])).message).toMatch(mismatch);
        expect((await expectViolation(c, insertSql, [other, -12, 'b', forLearner, 'r', 'admin'])).message).toMatch(mismatch);
        expect((await expectViolation(c, insertSql, [user, -12, 'c', randomUUID(), 'r', 'admin'])).message).toMatch(/unknown ledger entry/);
        expect((await expectViolation(c, insertSql, [user, 12, 'd', reversal, 'r', 'admin'])).message).toMatch(mismatch);
      }));

    it('can exist once per entry', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const original = await insertEntry(c, { userId: user, points: 12 });
        await insertEntry(c, { userId: user, points: -12, reversalOf: original, reason: 'abuse', actorId: 'admin' });

        const error = await expectViolation(c, insertSql, [user, -12, 'again', original, 'r', 'admin']);

        expect(error.constraint).toBe('GamificationLedger_reversalOf_key');
      }));
  });

  it('is erased with the learner, so deleting an account is not blocked', () =>
    withRollback(pool, async (c) => {
      const user = await insertUser(c);
      const original = await insertEntry(c, { userId: user, points: 12 });
      await insertEntry(c, { userId: user, points: -12, reversalOf: original, reason: 'abuse', actorId: 'admin' });

      await c.query(`DELETE FROM "User" WHERE id = $1`, [user]);

      const { rows } = await c.query(`SELECT count(*)::int AS n FROM "GamificationLedger" WHERE "userId" = $1`, [user]);
      expect(rows[0].n).toBe(0);
    }));
});
