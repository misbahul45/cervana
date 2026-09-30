import { Role } from '@prisma/client';
import { Pool } from 'pg';
import {
  createPool,
  databaseUrl,
  describeDb,
  insertPublishedArticle,
  insertTenant,
  insertUser,
  ledgerSum,
  walletBalance,
} from '@/test-utils/pg-fixtures';
import { buildCommerceStack, CommerceStack } from '@/test-utils/commerce-harness';

const proofFor = (userId: string) => ({
  url: `https://res.cloudinary.com/demo/image/upload/images/${userId}-proof.png`,
  fileId: `images/${userId}-proof`,
});

const destination = { bankName: 'BCA', accountNumber: '1234567890', accountName: 'Nama Kreator' };

describeDb('payouts on a real database (requires TEST_DATABASE_URL)', () => {
  let pool: Pool;
  let s: CommerceStack;

  const creatorActor = (id: string) => ({ id, role: Role.TEACHER });
  const admin = (id: string) => ({ id, role: Role.ADMIN });
  const one = async (sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows[0];
  const count = async (sql: string, params: unknown[] = []) => Number((await one(sql, params)).count);

  const earner = async (price = '100000.00') => {
    const buyer = await insertUser(pool);
    const reviewer = await insertUser(pool, 'ADMIN');
    const creator = await insertUser(pool, 'TEACHER');
    const tenant = await insertTenant(pool, creator);
    const article = await insertPublishedArticle(pool, tenant, creator, price);
    const order = (await s.orders.create({ id: buyer, role: Role.STUDENT }, { items: [{ type: 'ARTICLE', id: article }] }, 't')).data;
    const submitted = await s.manual.submit({ id: buyer, role: Role.STUDENT }, order.payment!.id, { paymentMethod: 'BANK_TRANSFER', proof: proofFor(buyer) }, 't');
    await s.manual.approve(admin(reviewer), submitted.data.submission.id, 'verified', 't');
    const wallet = await one(`SELECT id FROM "Wallet" WHERE "ownerId" = $1 AND "tenantId" = $2`, [creator, tenant]);
    return { creator, tenant, reviewer, walletId: wallet.id as string };
  };

  const expectConsistent = async (walletId: string) => {
    expect(await ledgerSum(pool, walletId)).toBe(await walletBalance(pool, walletId));
  };

  beforeAll(() => {
    process.env.DATABASE_URL = databaseUrl;
    pool = createPool();
    s = buildCommerceStack({ env: { PAYOUT_MIN_AMOUNT: '10000' } });
  });

  afterAll(async () => {
    await s.prisma.$disconnect();
    await pool.end();
  });

  describe('requesting', () => {
    it('holds the funds at once and records the request', async () => {
      const w = await earner();
      expect(await walletBalance(pool, w.walletId)).toBe('90000.00');

      const { data } = await s.payouts.request(creatorActor(w.creator), { amount: 60000, destination }, 'trace-1');
      expect(data).toMatchObject({ status: 'REQUESTED', walletId: w.walletId, tenantId: w.tenant });
      expect(data.amount.toString()).toBe('60000');
      expect(await walletBalance(pool, w.walletId)).toBe('30000.00');
      await expectConsistent(w.walletId);

      const entry = await one(`SELECT category::text, direction::text, amount::text, "payoutId" FROM "LedgerTransaction" WHERE "payoutId" = $1`, [data.id]);
      expect(entry).toEqual({ category: 'PAYOUT', direction: 'DEBIT', amount: '60000.00', payoutId: data.id });
      expect(await count(`SELECT count(*) FROM "AuditLog" WHERE action = 'PAYOUT_REQUESTED' AND "entityId" = $1`, [data.id])).toBe(1);
      expect(await count(`SELECT count(*) FROM "DomainEvent" WHERE type = 'PayoutRequested' AND "aggregateId" = $1`, [data.id])).toBe(1);
    });

    it('refuses more than the balance, less than the minimum, and a second open request', async () => {
      const w = await earner();
      await expect(s.payouts.request(creatorActor(w.creator), { amount: 90000.01, destination }, 't')).rejects.toMatchObject({ statusCode: 409, code: 'PAYOUT_EXCEEDS_BALANCE' });
      await expect(s.payouts.request(creatorActor(w.creator), { amount: 5000, destination }, 't')).rejects.toMatchObject({ statusCode: 422 });
      await s.payouts.request(creatorActor(w.creator), { amount: 20000, destination }, 't');
      await expect(s.payouts.request(creatorActor(w.creator), { amount: 20000, destination }, 't')).rejects.toMatchObject({ statusCode: 409 });
      expect(await walletBalance(pool, w.walletId)).toBe('70000.00');
      await expectConsistent(w.walletId);
    });

    it('cannot draw on somebody else wallet, or a wallet that does not exist', async () => {
      const w = await earner();
      const other = await earner();
      const nobody = await insertUser(pool, 'TEACHER');
      await expect(s.payouts.request(creatorActor(other.creator), { walletId: w.walletId, amount: 20000, destination }, 't')).rejects.toMatchObject({ statusCode: 404 });
      await expect(s.payouts.request(creatorActor(nobody), { amount: 20000, destination }, 't')).rejects.toMatchObject({ statusCode: 404 });
      expect(await walletBalance(pool, w.walletId)).toBe('90000.00');
    });

    it('is blocked while the tenant is not active', async () => {
      const w = await earner();
      await pool.query(`UPDATE "Tenant" SET status = 'SUSPENDED' WHERE id = $1`, [w.tenant]);
      await expect(s.payouts.request(creatorActor(w.creator), { amount: 20000, destination }, 't')).rejects.toMatchObject({ statusCode: 409 });
      expect(await walletBalance(pool, w.walletId)).toBe('90000.00');
    });

    it('lets only one of many simultaneous requests through and never overdraws', async () => {
      const w = await earner();
      const attempts = await Promise.allSettled(
        Array.from({ length: 6 }, () => s.payouts.request(creatorActor(w.creator), { amount: 80000, destination }, 't')),
      );
      expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(1);
      expect(await walletBalance(pool, w.walletId)).toBe('10000.00');
      expect(await count(`SELECT count(*) FROM "PayoutRequest" WHERE "walletId" = $1`, [w.walletId])).toBe(1);
      await expectConsistent(w.walletId);
    });
  });

  describe('review', () => {
    it('runs the whole path to PAID with evidence, and every step is idempotent', async () => {
      const w = await earner();
      const { data: payout } = await s.payouts.request(creatorActor(w.creator), { amount: 50000, destination }, 't');
      const reviewer = admin(w.reviewer);

      await expect(s.payouts.approve(creatorActor(w.creator), payout.id, 't')).rejects.toMatchObject({ status: 403 });
      await s.payouts.startReview(reviewer, payout.id, 't');
      const results = await Promise.all(Array.from({ length: 5 }, () => s.payouts.approve(reviewer, payout.id, 't')));
      expect(results.filter((r) => r.message === 'Payout updated')).toHaveLength(1);

      await expect(s.payouts.markPaid(reviewer, payout.id, { evidence: { url: 'http://bad.test/e.png', fileId: 'images/e' } } as never, 't')).rejects.toBeDefined();
      const paid = await s.payouts.markPaid(reviewer, payout.id, { evidence: proofFor(w.reviewer), note: 'Transfer BCA ref 123' }, 't');
      expect(paid.data).toMatchObject({ status: 'PAID' });
      expect(paid.data.paidAt).not.toBeNull();
      expect((await s.payouts.markPaid(reviewer, payout.id, { evidence: proofFor(w.reviewer) }, 't')).message).toMatch(/already/);

      expect(await walletBalance(pool, w.walletId)).toBe('40000.00');
      await expectConsistent(w.walletId);
      await expect(s.payouts.reject(reviewer, payout.id, 'Too late to reject', 't')).rejects.toMatchObject({ statusCode: 409 });
      await expect(s.payouts.cancel(creatorActor(w.creator), payout.id, 't')).rejects.toMatchObject({ statusCode: 409 });
      expect(await count(`SELECT count(*) FROM "DomainEvent" WHERE "aggregateId" = $1`, [payout.id])).toBe(3);
      expect(await count(`SELECT count(*) FROM "AuditLog" WHERE "entityId" = $1`, [payout.id])).toBe(4);

      const next = await s.payouts.request(creatorActor(w.creator), { amount: 30000, destination }, 't');
      expect(next.data.status).toBe('REQUESTED');
    });

    it('returns the money exactly once when a payout is rejected', async () => {
      const w = await earner();
      const { data: payout } = await s.payouts.request(creatorActor(w.creator), { amount: 50000, destination }, 't');
      const reviewer = admin(w.reviewer);

      await expect(s.payouts.reject(reviewer, payout.id, 'ab', 't')).resolves.toBeDefined();
      await s.payouts.reject(reviewer, payout.id, 'ab', 't');
      const rejected = await one(`SELECT status::text, "rejectionReason", "reviewedById" FROM "PayoutRequest" WHERE id = $1`, [payout.id]);
      expect(rejected).toEqual({ status: 'REJECTED', rejectionReason: 'ab', reviewedById: w.reviewer });
      expect(await walletBalance(pool, w.walletId)).toBe('90000.00');
      expect(await count(`SELECT count(*) FROM "LedgerTransaction" WHERE "payoutId" = $1`, [payout.id])).toBe(2);
      await expectConsistent(w.walletId);
      await expect(s.payouts.approve(reviewer, payout.id, 't')).rejects.toMatchObject({ statusCode: 409 });
    });

    it('lets the creator cancel before review, but nobody else', async () => {
      const w = await earner();
      const other = await earner();
      const { data: payout } = await s.payouts.request(creatorActor(w.creator), { amount: 40000, destination }, 't');

      await expect(s.payouts.cancel(creatorActor(other.creator), payout.id, 't')).rejects.toMatchObject({ statusCode: 404 });
      await expect(s.payouts.cancel(admin(w.reviewer), payout.id, 't')).rejects.toMatchObject({ statusCode: 404 });
      await s.payouts.cancel(creatorActor(w.creator), payout.id, 't');
      await s.payouts.cancel(creatorActor(w.creator), payout.id, 't');
      expect(await walletBalance(pool, w.walletId)).toBe('90000.00');
      await expectConsistent(w.walletId);

      const second = await s.payouts.request(creatorActor(w.creator), { amount: 40000, destination }, 't');
      await s.payouts.startReview(admin(w.reviewer), second.data.id, 't');
      await expect(s.payouts.cancel(creatorActor(w.creator), second.data.id, 't')).rejects.toMatchObject({ statusCode: 409 });
    });

    it('never lets a reviewer approve their own payout', async () => {
      const w = await earner();
      const { data: payout } = await s.payouts.request(creatorActor(w.creator), { amount: 40000, destination }, 't');
      await expect(s.payouts.approve({ id: w.creator, role: Role.ADMIN }, payout.id, 't')).rejects.toMatchObject({ statusCode: 403, code: 'OWNERSHIP_DENIED' });
      await expect(s.payouts.approve(creatorActor(w.creator), payout.id, 't')).rejects.toMatchObject({ status: 403 });
    });

    it('settles a concurrent reject and mark-paid on one consistent outcome', async () => {
      const w = await earner();
      const { data: payout } = await s.payouts.request(creatorActor(w.creator), { amount: 50000, destination }, 't');
      const reviewer = admin(w.reviewer);
      await s.payouts.approve(reviewer, payout.id, 't');

      const outcomes = await Promise.allSettled([
        s.payouts.markPaid(reviewer, payout.id, { evidence: proofFor(w.reviewer) }, 't'),
        s.payouts.reject(reviewer, payout.id, 'bank rejected the account', 't'),
      ]);
      expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
      const status = (await one(`SELECT status::text FROM "PayoutRequest" WHERE id = $1`, [payout.id])).status;
      expect(await walletBalance(pool, w.walletId)).toBe(status === 'PAID' ? '40000.00' : '90000.00');
      await expectConsistent(w.walletId);
    });
  });

  describe('reading', () => {
    it('shows creators their own payouts and admins the queue with contact details', async () => {
      const w = await earner();
      const other = await earner();
      const { data: payout } = await s.payouts.request(creatorActor(w.creator), { amount: 30000, destination }, 't');

      expect((await s.payouts.listMine(creatorActor(w.creator), { page: 1, limit: 20 })).data.data.map((p) => p.id)).toEqual([payout.id]);
      expect((await s.payouts.listMine(creatorActor(other.creator), { page: 1, limit: 20 })).data.data).toHaveLength(0);
      await expect(s.payouts.findMine(creatorActor(other.creator), payout.id)).rejects.toMatchObject({ statusCode: 404 });

      const queue = await s.payouts.queue(admin(w.reviewer), { page: 1, limit: 100, tenantId: w.tenant });
      expect(queue.data.data.map((p) => p.id)).toEqual([payout.id]);
      await expect(s.payouts.queue(creatorActor(w.creator), { page: 1, limit: 20 })).rejects.toMatchObject({ status: 403 });
      const detail = await s.payouts.findOne(admin(w.reviewer), payout.id);
      expect(detail.data.wallet.balance.toString()).toBe('60000');
    });
  });
});
