import { Role, TenantRole } from '@prisma/client';
import { Pool } from 'pg';
import {
  createPool,
  databaseUrl,
  describeDb,
  insertMembership,
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

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describeDb('refunds on a real database (requires TEST_DATABASE_URL)', () => {
  let pool: Pool;
  let s: CommerceStack;

  const student = (id: string) => ({ id, role: Role.STUDENT });
  const admin = (id: string) => ({ id, role: Role.ADMIN });
  const one = async (sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows[0];
  const count = async (sql: string, params: unknown[] = []) => Number((await one(sql, params)).count);

  const purchased = async (price = '100000.00') => {
    const buyer = await insertUser(pool);
    const reviewer = await insertUser(pool, 'ADMIN');
    const creator = await insertUser(pool, 'TEACHER');
    const tenant = await insertTenant(pool, creator);
    const article = await insertPublishedArticle(pool, tenant, creator, price);
    const order = (await s.orders.create(student(buyer), { items: [{ type: 'ARTICLE', id: article }] }, 't')).data;
    const submitted = await s.manual.submit(student(buyer), order.payment!.id, { paymentMethod: 'BANK_TRANSFER', proof: proofFor(buyer) }, 't');
    await s.manual.approve(admin(reviewer), submitted.data.submission.id, 'verified', 't');
    const wallet = await one(`SELECT id FROM "Wallet" WHERE "ownerId" = $1 AND "tenantId" = $2`, [creator, tenant]);
    return { buyer, reviewer, creator, tenant, article, orderId: order.id as string, intentId: order.payment!.id as string, walletId: wallet.id as string };
  };

  const netOfPlatform = async (orderId: string) =>
    (
      await one(
        `SELECT COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN amount ELSE -amount END), 0)::text AS net FROM "LedgerTransaction" WHERE "orderId" = $1 AND "walletId" IS NULL`,
        [orderId],
      )
    ).net as string;

  const run = async (w: Awaited<ReturnType<typeof purchased>>) => {
    const requested = await s.refunds.request(student(w.buyer), w.orderId, 'Saya membeli dua kali', 't');
    const id = requested.data.id as string;
    await s.refunds.approve(admin(w.reviewer), id, 't');
    await s.refunds.process(admin(w.reviewer), id, { evidence: proofFor(w.reviewer), note: 'Transfer balik BCA' }, 't');
    return id;
  };

  beforeAll(() => {
    process.env.DATABASE_URL = databaseUrl;
    pool = createPool();
    s = buildCommerceStack({ env: { PAYOUT_MIN_AMOUNT: '1000' } });
  });

  afterAll(async () => {
    await s.prisma.$disconnect();
    await pool.end();
  });

  describe('the whole path', () => {
    it('reverses payment, order, access, earning and ledger exactly, and leaves every wallet at zero', async () => {
      const w = await purchased();
      expect(await walletBalance(pool, w.walletId)).toBe('90000.00');

      const requested = await s.refunds.request(student(w.buyer), w.orderId, 'Saya membeli dua kali', 'trace-r');
      const id = requested.data.id;
      expect(requested.data).toMatchObject({ status: 'REQUESTED', orderId: w.orderId, paymentIntentId: w.intentId });
      expect(requested.data.amount.toString()).toBe('100000');
      expect((await one(`SELECT status::text FROM "Order" WHERE id = $1`, [w.orderId])).status).toBe('REFUND_PENDING');
      expect((await one(`SELECT status::text FROM "PaymentIntent" WHERE id = $1`, [w.intentId])).status).toBe('REFUND_PENDING');
      expect((await s.marketplaceArticles.access(student(w.buyer), w.article)).data.accessible).toBe(true);

      await s.refunds.approve(admin(w.reviewer), id, 't');
      const processed = await s.refunds.process(admin(w.reviewer), id, { evidence: proofFor(w.reviewer), note: 'Transfer balik BCA' }, 't');
      expect(processed.data).toMatchObject({ status: 'PROCESSED', changed: true });

      expect((await one(`SELECT status::text FROM "Order" WHERE id = $1`, [w.orderId])).status).toBe('REFUNDED');
      expect((await one(`SELECT status::text FROM "PaymentIntent" WHERE id = $1`, [w.intentId])).status).toBe('REFUNDED');
      const refundTx = await one(`SELECT type::text, status::text, amount::text FROM "PaymentTransaction" WHERE "paymentIntentId" = $1 AND type = 'REFUND'`, [w.intentId]);
      expect(refundTx).toEqual({ type: 'REFUND', status: 'SUCCEEDED', amount: '100000.00' });
      expect((await one(`SELECT status::text FROM "Entitlement" WHERE "userId" = $1 AND "articleId" = $2`, [w.buyer, w.article])).status).toBe('REVOKED');
      await expect(s.marketplaceArticles.content(student(w.buyer), w.article)).rejects.toMatchObject({ code: 'ENTITLEMENT_REQUIRED' });
      expect((await one(`SELECT status::text FROM "CreatorEarning" WHERE "orderId" = $1`, [w.orderId])).status).toBe('REVERSED');

      expect(await walletBalance(pool, w.walletId)).toBe('0.00');
      expect(await ledgerSum(pool, w.walletId)).toBe('0.00');
      expect(await netOfPlatform(w.orderId)).toBe('0.00');
      expect(await count(`SELECT count(*) FROM "LedgerTransaction" WHERE "orderId" = $1`, [w.orderId])).toBe(8);
      expect(await count(`SELECT count(*) FROM "LedgerTransaction" WHERE "orderId" = $1 AND "reversalOfId" IS NOT NULL`, [w.orderId])).toBe(3);

      for (const type of ['RefundRequested', 'RefundApproved', 'RefundCompleted']) {
        expect(await count(`SELECT count(*) FROM "DomainEvent" WHERE type = $1 AND "aggregateId" = $2`, [type, id])).toBe(1);
      }
      const actions = (await pool.query(`SELECT DISTINCT action FROM "AuditLog" WHERE "entityId" = ANY($1)`, [[id, w.orderId, w.intentId]])).rows.map((r) => r.action);
      expect(actions).toEqual(expect.arrayContaining(['REFUND_REQUESTED', 'REFUND_APPROVED', 'REFUND_PROCESSED', 'ORDER_REFUNDED', 'PAYMENT_INTENT_REFUNDED']));
    });

    it('is idempotent, also when processed by several administrators at once', async () => {
      const w = await purchased();
      const first = await s.refunds.request(student(w.buyer), w.orderId, 'Duplicate purchase', 't');
      const second = await s.refunds.request(student(w.buyer), w.orderId, 'Duplicate purchase', 't');
      expect(second.data.id).toBe(first.data.id);
      const id = first.data.id;

      const approvals = await Promise.all(Array.from({ length: 4 }, () => s.refunds.approve(admin(w.reviewer), id, 't')));
      expect(approvals.filter((a) => a.data.changed)).toHaveLength(1);

      const processing = await Promise.allSettled(
        Array.from({ length: 5 }, () => s.refunds.process(admin(w.reviewer), id, { evidence: proofFor(w.reviewer) }, 't')),
      );
      expect(processing.every((p) => p.status === 'fulfilled')).toBe(true);
      expect(processing.filter((p) => p.status === 'fulfilled' && p.value.data.changed)).toHaveLength(1);

      expect(await count(`SELECT count(*) FROM "Refund" WHERE "orderId" = $1`, [w.orderId])).toBe(1);
      expect(await count(`SELECT count(*) FROM "PaymentTransaction" WHERE "paymentIntentId" = $1 AND type = 'REFUND'`, [w.intentId])).toBe(1);
      expect(await count(`SELECT count(*) FROM "LedgerTransaction" WHERE "orderId" = $1`, [w.orderId])).toBe(8);
      expect(await walletBalance(pool, w.walletId)).toBe('0.00');
      expect(await netOfPlatform(w.orderId)).toBe('0.00');
    });
  });

  describe('who may do what', () => {
    it('lets only the buyer or an administrator open a refund, and only an administrator decide it', async () => {
      const w = await purchased();
      const stranger = await insertUser(pool);
      await expect(s.refunds.request(student(stranger), w.orderId, 'Not my order', 't')).rejects.toMatchObject({ statusCode: 404 });

      const requested = await s.refunds.request(student(w.buyer), w.orderId, 'Saya membeli dua kali', 't');
      const id = requested.data.id;
      await expect(s.refunds.approve(student(w.buyer), id, 't')).rejects.toMatchObject({ status: 403 });
      await expect(s.refunds.process(student(w.buyer), id, { evidence: proofFor(w.buyer) }, 't')).rejects.toBeDefined();
      await expect(s.refunds.reject(student(w.buyer), id, 'I refuse', 't')).rejects.toMatchObject({ status: 403 });
      await expect(s.refunds.queue(student(w.buyer), { page: 1, limit: 20 })).rejects.toMatchObject({ status: 403 });

      expect((await s.refunds.listMine(student(w.buyer), { page: 1, limit: 20 })).data.data.map((r) => r.id)).toEqual([id]);
      expect((await s.refunds.listMine(student(stranger), { page: 1, limit: 20 })).data.data).toHaveLength(0);
      expect((await s.refunds.queue(admin(w.reviewer), { page: 1, limit: 100 })).data.data.map((r) => r.id)).toContain(id);
    });

    it('applies the refund window to buyers only', async () => {
      const w = await purchased();
      await pool.query(`UPDATE "PaymentIntent" SET "paidAt" = now() - interval '30 days' WHERE id = $1`, [w.intentId]);
      await expect(s.refunds.request(student(w.buyer), w.orderId, 'Too late for me', 't')).rejects.toMatchObject({ statusCode: 409, code: 'INVALID_ORDER_STATE' });
      const byAdmin = await s.refunds.request(admin(w.reviewer), w.orderId, 'Goodwill refund approved by support', 't');
      expect(byAdmin.data.status).toBe('REQUESTED');
    });

    it('will not refund an order that is unpaid, already refunded, or has no verified payment', async () => {
      const w = await purchased();
      const buyer2 = await insertUser(pool);
      const article2 = await insertPublishedArticle(pool, w.tenant, w.creator, '5000.00');
      const pending = (await s.orders.create(student(buyer2), { items: [{ type: 'ARTICLE', id: article2 }] }, 't')).data;
      await expect(s.refunds.request(student(buyer2), pending.id, 'Nothing was paid', 't')).rejects.toMatchObject({ statusCode: 409, code: 'INVALID_ORDER_STATE' });

      await run(w);
      await expect(s.refunds.request(student(w.buyer), w.orderId, 'Again please', 't')).rejects.toMatchObject({ statusCode: 409 });

      const legacyBuyer = await insertUser(pool);
      const legacy = await one(
        `INSERT INTO "Order" (id, "userId", amount, currency, status, "expiredAt", "updatedAt", subtotal, total) VALUES (gen_random_uuid(), $1, 100, 'IDR', 'FULFILLED', now(), now(), 100, 100) RETURNING id`,
        [legacyBuyer],
      );
      await expect(s.refunds.request(student(legacyBuyer), legacy.id, 'Legacy order without a payment', 't')).rejects.toMatchObject({ statusCode: 409, code: 'INVALID_PAYMENT_STATE' });
    });
  });

  describe('rejection', () => {
    it('restores order and payment so access and earnings stay untouched', async () => {
      const w = await purchased();
      const id = (await s.refunds.request(student(w.buyer), w.orderId, 'Changed my mind', 't')).data.id;
      const rejected = await s.refunds.reject(admin(w.reviewer), id, 'Outside our policy', 't');
      expect(rejected.data).toMatchObject({ status: 'REJECTED', changed: true });
      expect((await s.refunds.reject(admin(w.reviewer), id, 'Outside our policy', 't')).data.changed).toBe(false);

      expect((await one(`SELECT status::text FROM "Order" WHERE id = $1`, [w.orderId])).status).toBe('FULFILLED');
      expect((await one(`SELECT status::text FROM "PaymentIntent" WHERE id = $1`, [w.intentId])).status).toBe('PAID');
      expect((await one(`SELECT "rejectionReason" FROM "Refund" WHERE id = $1`, [id])).rejectionReason).toBe('Outside our policy');
      expect((await s.marketplaceArticles.access(student(w.buyer), w.article)).data.accessible).toBe(true);
      expect(await walletBalance(pool, w.walletId)).toBe('90000.00');
      await expect(s.refunds.approve(admin(w.reviewer), id, 't')).rejects.toMatchObject({ statusCode: 409 });

      const again = await s.refunds.request(student(w.buyer), w.orderId, 'Second request with new facts', 't');
      expect(again.data.id).not.toBe(id);
    });
  });

  describe('money that has already left', () => {
    it('is refused until the creator balance can cover it, and nothing changes meanwhile', async () => {
      const w = await purchased();
      const id = (await s.refunds.request(student(w.buyer), w.orderId, 'Duplicate purchase', 't')).data.id;
      await s.refunds.approve(admin(w.reviewer), id, 't');

      const payout = await s.payouts.request({ id: w.creator, role: Role.TEACHER }, { amount: 80000, destination: { bankName: 'BCA', accountNumber: '123456', accountName: 'Creator' } }, 't');
      await expect(s.refunds.process(admin(w.reviewer), id, { evidence: proofFor(w.reviewer) }, 't')).rejects.toMatchObject({ statusCode: 409, code: 'REFUND_EXCEEDS_BALANCE' });

      expect((await one(`SELECT status::text FROM "Refund" WHERE id = $1`, [id])).status).toBe('APPROVED');
      expect((await one(`SELECT status::text FROM "PaymentIntent" WHERE id = $1`, [w.intentId])).status).toBe('REFUND_PENDING');
      expect((await one(`SELECT status::text FROM "Order" WHERE id = $1`, [w.orderId])).status).toBe('REFUND_PENDING');
      expect((await one(`SELECT status::text FROM "CreatorEarning" WHERE "orderId" = $1`, [w.orderId])).status).toBe('AVAILABLE');
      expect(await count(`SELECT count(*) FROM "PaymentTransaction" WHERE "paymentIntentId" = $1 AND type = 'REFUND'`, [w.intentId])).toBe(0);
      expect(await walletBalance(pool, w.walletId)).toBe('10000.00');

      await s.payouts.reject(admin(w.reviewer), payout.data.id, 'Held for a refund', 't');
      await s.refunds.process(admin(w.reviewer), id, { evidence: proofFor(w.reviewer) }, 't');
      expect(await walletBalance(pool, w.walletId)).toBe('0.00');
      expect(await ledgerSum(pool, w.walletId)).toBe('0.00');
      expect(await netOfPlatform(w.orderId)).toBe('0.00');
    });
  });

  describe('classes', () => {
    const classWorld = async () => {
      const owner = await insertUser(pool, 'TEACHER');
      const tenant = await insertTenant(pool, owner);
      await insertMembership(pool, tenant, owner, 'OWNER');
      const reviewer = await insertUser(pool, 'ADMIN');
      const ctx = { userId: owner, tenantId: tenant, tenantRole: TenantRole.OWNER, isPlatformAdmin: false };
      const teacher = { id: owner, role: Role.TEACHER };
      const created = (await s.classAuthoring.create(teacher, ctx, { title: 'Kelas berbayar', accessType: 'PAID', price: 200000, format: 'LIVE', difficulty: 'BEGINNER', capacity: 1 } as never, 't')).data;
      await s.classAuthoring.addSession(teacher, ctx, created.id, { startsAt: new Date(Date.now() + DAY), endsAt: new Date(Date.now() + DAY + HOUR), meetingUrl: 'https://meet.example.test/r' } as never, 't');
      await s.classAuthoring.submitReview(teacher, ctx, created.id, 't');
      await s.classModeration.approve(admin(reviewer), created.id, 'ok', 't');
      const buyer = await insertUser(pool);
      const order = (await s.orders.create(student(buyer), { items: [{ type: 'CLASS', id: created.id }] }, 't')).data;
      const submitted = await s.manual.submit(student(buyer), order.payment!.id, { paymentMethod: 'BANK_TRANSFER', proof: proofFor(buyer) }, 't');
      await s.manual.approve(admin(reviewer), submitted.data.submission.id, 'ok', 't');
      return { classId: created.id as string, buyer, reviewer, orderId: order.id as string, owner, tenant };
    };

    it('frees the seat and the access when a class purchase is refunded', async () => {
      const c = await classWorld();
      const other = await insertUser(pool);
      await expect(s.classEnrollments.enrollFree(student(other), c.classId, 't')).rejects.toBeDefined();

      const id = (await s.refunds.request(student(c.buyer), c.orderId, 'Cannot attend anymore', 't')).data.id;
      await s.refunds.approve(admin(c.reviewer), id, 't');
      await s.refunds.process(admin(c.reviewer), id, { evidence: proofFor(c.reviewer) }, 't');

      expect((await one(`SELECT status::text FROM "ClassEnrollment" WHERE "classProductId" = $1 AND "userId" = $2`, [c.classId, c.buyer])).status).toBe('CANCELLED');
      expect((await one(`SELECT status::text FROM "Entitlement" WHERE "userId" = $1 AND "classId" = $2`, [c.buyer, c.classId])).status).toBe('REVOKED');
      await expect(s.marketplaceClasses.materials(student(c.buyer), c.classId)).rejects.toMatchObject({ code: 'ENTITLEMENT_REQUIRED' });
      expect((await s.marketplaceClasses.findOne(c.classId)).data.seatsLeft).toBe(1);
    });

    it('refuses to refund a class the learner already completed', async () => {
      const c = await classWorld();
      const [sess] = await s.prisma.classSession.findMany({ where: { classProductId: c.classId } });
      const after = new Date(sess.endsAt.getTime() + HOUR);
      await s.classEnrollments.attend(student(c.buyer), c.classId, sess.id, new Date(sess.startsAt.getTime() + 60000), 't');
      await s.classEnrollments.complete(student(c.buyer), c.classId, after, 't');
      await expect(s.refunds.request(student(c.buyer), c.orderId, 'After finishing, I want my money back', 't')).rejects.toMatchObject({ statusCode: 409 });
      expect((await one(`SELECT status::text FROM "Order" WHERE id = $1`, [c.orderId])).status).toBe('FULFILLED');
    });
  });
});
