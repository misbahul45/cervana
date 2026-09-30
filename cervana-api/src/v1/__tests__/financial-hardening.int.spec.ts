import { randomUUID } from 'crypto';
import { Pool, PoolClient } from 'pg';
import {
  createPool,
  describeDb,
  expectViolation,
  insertArticle,
  insertEarning,
  insertIntent,
  insertLedger,
  insertOrder,
  insertOrderItem,
  insertPayout,
  insertTenant,
  insertUser,
  insertWallet,
  walletBalance,
  withRollback,
} from '@/test-utils/pg-fixtures';

describeDb('financial hardening (requires TEST_DATABASE_URL)', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = createPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  const seller = async (c: PoolClient) => {
    const creator = await insertUser(c, 'TEACHER');
    const buyer = await insertUser(c);
    const tenant = await insertTenant(c, creator);
    const article = await insertArticle(c, tenant, creator, { accessType: 'PAID', price: '100.00' });
    const order = await insertOrder(c, buyer);
    const item = await insertOrderItem(c, order, { tenantId: tenant, articleId: article, price: '100.00', fee: '10.00' });
    const earning = await insertEarning(c, { tenantId: tenant, creatorId: creator, orderId: order, orderItemId: item, gross: '100.00', fee: '10.00', creator: '90.00' });
    return { creator, buyer, tenant, article, order, item, earning };
  };

  describe('ledger rules', () => {
    it('fixes the direction and the wallet for each category', () =>
      withRollback(pool, async (c) => {
        const { creator, order, tenant, earning } = await seller(c);
        const wallet = await insertWallet(c, creator, tenant, '0');
        const direction = 'LedgerTransaction_direction_rules';

        const cases: Array<[string, Parameters<typeof insertLedger>[1]]> = [
          ['ORDER_PAYMENT cannot be a debit', { category: 'ORDER_PAYMENT', direction: 'DEBIT', amount: 10, orderId: order }],
          ['ORDER_PAYMENT cannot touch a wallet', { category: 'ORDER_PAYMENT', direction: 'CREDIT', amount: 10, orderId: order, walletId: wallet }],
          ['CREATOR_EARNING accrues on the platform, not a wallet', { category: 'CREATOR_EARNING', direction: 'CREDIT', amount: 10, orderId: order, earningId: earning, walletId: wallet }],
          ['WALLET_CREDIT must name a wallet', { category: 'WALLET_CREDIT', direction: 'CREDIT', amount: 10, earningId: earning }],
          ['WALLET_CREDIT cannot be a debit', { category: 'WALLET_CREDIT', direction: 'DEBIT', amount: 10, earningId: earning, walletId: wallet }],
        ];
        for (const [label, entry] of cases) {
          const error = await expectViolation(
            c,
            `INSERT INTO "LedgerTransaction" (id, category, direction, amount, currency, "walletId", "orderId", "earningId", "idempotencyKey") VALUES (gen_random_uuid(), $1::"LedgerCategory", $2::"LedgerDirection", $3, 'IDR', $4, $5, $6, $7)`,
            [entry.category, entry.direction, entry.amount, entry.walletId ?? null, entry.orderId ?? null, entry.earningId ?? null, `rule-${randomUUID()}`],
          );
          expect({ label, constraint: error.constraint }).toEqual({ label, constraint: direction });
        }
      }));

    it('requires the reference each category is about, and the reference must exist', () =>
      withRollback(pool, async (c) => {
        const { creator, tenant } = await seller(c);
        const wallet = await insertWallet(c, creator, tenant, '100.00');
        const refs = 'LedgerTransaction_reference_rules';
        const raw = (category: string, direction: string, walletId: string | null, extra: Record<string, string | null>) =>
          expectViolation(
            c,
            `INSERT INTO "LedgerTransaction" (id, category, direction, amount, currency, "walletId", "payoutId", "refundId", "earningId", "orderId", "idempotencyKey") VALUES (gen_random_uuid(), $1::"LedgerCategory", $2::"LedgerDirection", 10, 'IDR', $3, $4, $5, $6, $7, $8)`,
            [category, direction, walletId, extra.payoutId ?? null, extra.refundId ?? null, extra.earningId ?? null, extra.orderId ?? null, `ref-${randomUUID()}`],
          );

        expect((await raw('PAYOUT', 'DEBIT', wallet, {})).constraint).toBe(refs);
        expect((await raw('REFUND', 'DEBIT', null, {})).constraint).toBe(refs);
        expect((await raw('PLATFORM_FEE', 'CREDIT', null, { orderId: randomUUID() })).constraint).toBe(refs);
        expect((await raw('PAYOUT', 'DEBIT', wallet, { payoutId: randomUUID() })).constraint).toBe('LedgerTransaction_payoutId_fkey');
        expect((await raw('REFUND', 'DEBIT', null, { refundId: randomUUID() })).constraint).toBe('LedgerTransaction_refundId_fkey');
        expect((await raw('WALLET_CREDIT', 'CREDIT', wallet, { earningId: randomUUID() })).constraint).toBe('LedgerTransaction_earningId_fkey');
      }));

    it('a reversal mirrors its original exactly and can happen only once', () =>
      withRollback(pool, async (c) => {
        const { creator, tenant, earning, order } = await seller(c);
        const wallet = await insertWallet(c, creator, tenant, '0');
        const credit = await insertLedger(c, { category: 'WALLET_CREDIT', direction: 'CREDIT', amount: 90, walletId: wallet, earningId: earning, orderId: order });
        expect(await walletBalance(c, wallet)).toBe('90.00');

        const attempt = (overrides: Partial<Record<string, string | number>>) =>
          expectViolation(
            c,
            `INSERT INTO "LedgerTransaction" (id, category, direction, amount, currency, "walletId", "earningId", "reversalOfId", "idempotencyKey")
             VALUES (gen_random_uuid(), $1::"LedgerCategory", $2::"LedgerDirection", $3, 'IDR', $4, $5, $6, $7)`,
            [
              overrides.category ?? 'WALLET_CREDIT',
              overrides.direction ?? 'DEBIT',
              overrides.amount ?? 90,
              overrides.walletId ?? wallet,
              earning,
              overrides.reversalOfId ?? credit,
              `rev-${randomUUID()}`,
            ],
          );

        expect((await attempt({ direction: 'CREDIT' })).message).toMatch(/mirror the original/);
        expect((await attempt({ amount: 80 })).message).toMatch(/mirror the original/);
        expect((await attempt({ reversalOfId: randomUUID() })).message).toMatch(/original ledger entry/);

        const reversal = await insertLedger(c, { category: 'WALLET_CREDIT', direction: 'DEBIT', amount: 90, walletId: wallet, earningId: earning, orderId: order, reversalOfId: credit });
        expect(await walletBalance(c, wallet)).toBe('0.00');

        expect((await attempt({})).constraint).toBe('LedgerTransaction_reversalOfId_key');
        expect((await attempt({ direction: 'CREDIT', reversalOfId: reversal })).message).toMatch(/original ledger entry/);
      }));
  });

  describe('order history', () => {
    it('freezes the pricing snapshot and refuses deletion', () =>
      withRollback(pool, async (c) => {
        const { order, item } = await seller(c);
        for (const sql of [
          `UPDATE "Order" SET total = 1 WHERE id = $1`,
          `UPDATE "Order" SET subtotal = 1 WHERE id = $1`,
          `UPDATE "Order" SET "platformFee" = 5 WHERE id = $1`,
          `UPDATE "Order" SET currency = 'USD' WHERE id = $1`,
        ]) {
          expect((await expectViolation(c, sql, [order])).message).toMatch(/pricing snapshot is immutable/);
        }
        expect((await expectViolation(c, `DELETE FROM "Order" WHERE id = $1`, [order])).message).toMatch(/cannot be deleted/);
        await c.query(`UPDATE "Order" SET status = 'FAILED', "updatedAt" = now() WHERE id = $1`, [order]);

        for (const sql of [
          `UPDATE "OrderItem" SET "unitPrice" = 1, "totalPrice" = 1 WHERE id = $1`,
          `UPDATE "OrderItem" SET "platformFee" = 0 WHERE id = $1`,
          `UPDATE "OrderItem" SET quantity = 2, "totalPrice" = 200 WHERE id = $1`,
        ]) {
          expect((await expectViolation(c, sql, [item])).message).toMatch(/snapshot is immutable/);
        }
        expect((await expectViolation(c, `DELETE FROM "OrderItem" WHERE id = $1`, [item])).message).toMatch(/cannot be deleted/);
      }));

    it('rejects money that does not add up', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const insert = `INSERT INTO "Order" (id, "userId", amount, currency, status, subtotal, "platformFee", total, "expiredAt", "updatedAt") VALUES (gen_random_uuid(), $1, 0, 'IDR', 'PENDING', $2, $3, $4, now(), now())`;
        expect((await expectViolation(c, insert, [user, 100, 200, 100])).constraint).toBe('Order_money_valid');
        expect((await expectViolation(c, insert, [user, -1, 0, 0])).constraint).toBe('Order_money_valid');
      }));

    it('a user with orders cannot be deleted', () =>
      withRollback(pool, async (c) => {
        const { buyer } = await seller(c);
        const error = await expectViolation(c, `DELETE FROM "User" WHERE id = $1`, [buyer]);
        expect(error.constraint).toBe('Order_userId_fkey');
      }));
  });

  describe('creator earnings', () => {
    it('amounts are frozen, deletion is refused and a reversed earning stays reversed', () =>
      withRollback(pool, async (c) => {
        const { earning } = await seller(c);
        expect((await expectViolation(c, `UPDATE "CreatorEarning" SET "creatorAmount" = 95, "platformFee" = 5 WHERE id = $1`, [earning])).message).toMatch(/amounts are immutable/);
        expect((await expectViolation(c, `DELETE FROM "CreatorEarning" WHERE id = $1`, [earning])).message).toMatch(/cannot be deleted/);
        expect((await expectViolation(c, `UPDATE "CreatorEarning" SET status = 'AVAILABLE' WHERE id = $1`, [earning])).constraint).toBe('CreatorEarning_release_rules');
        await c.query(`UPDATE "CreatorEarning" SET status = 'AVAILABLE', "releasedAt" = now() WHERE id = $1`, [earning]);
        await c.query(`UPDATE "CreatorEarning" SET status = 'REVERSED' WHERE id = $1`, [earning]);
        expect((await expectViolation(c, `UPDATE "CreatorEarning" SET status = 'AVAILABLE', "releasedAt" = now() WHERE id = $1`, [earning])).message).toMatch(/cannot be reopened/);
      }));
  });

  describe('payouts', () => {
    it('draw only on the creator wallet of the same tenant', () =>
      withRollback(pool, async (c) => {
        const { creator, tenant } = await seller(c);
        const stranger = await insertUser(c, 'TEACHER');
        const otherTenant = await insertTenant(c, stranger);
        const own = await insertWallet(c, creator, tenant, '100.00');
        const foreign = await insertWallet(c, stranger, otherTenant, '100.00');

        await insertPayout(c, { creatorId: creator, tenantId: tenant, walletId: own, amount: '50.00' });
        expect((await expectViolation(c, `INSERT INTO "PayoutRequest" (id, "creatorId", "tenantId", "walletId", amount, "destinationInfo") VALUES (gen_random_uuid(), $1, $2, $3, 10, '{}'::jsonb)`, [creator, tenant, foreign])).message).toMatch(/creator wallet of the same tenant/);
        expect((await expectViolation(c, `INSERT INTO "PayoutRequest" (id, "creatorId", "tenantId", "walletId", amount, "destinationInfo") VALUES (gen_random_uuid(), $1, $2, $3, 10, '{}'::jsonb)`, [stranger, tenant, own])).message).toMatch(/creator wallet of the same tenant/);
        expect((await expectViolation(c, `INSERT INTO "PayoutRequest" (id, "creatorId", "tenantId", "walletId", amount, "destinationInfo") VALUES (gen_random_uuid(), $1, $2, $3, 0, '{}'::jsonb)`, [creator, tenant, own])).constraint).toBe('PayoutRequest_amount_positive');
      }));

    it('keep their terms, record their review, and close for good', () =>
      withRollback(pool, async (c) => {
        const { creator, tenant } = await seller(c);
        const admin = await insertUser(c, 'ADMIN');
        const wallet = await insertWallet(c, creator, tenant, '100.00');
        const payout = await insertPayout(c, { creatorId: creator, tenantId: tenant, walletId: wallet, amount: '40.00' });

        expect((await expectViolation(c, `UPDATE "PayoutRequest" SET amount = 90 WHERE id = $1`, [payout])).message).toMatch(/terms are immutable/);
        expect((await expectViolation(c, `UPDATE "PayoutRequest" SET status = 'APPROVED' WHERE id = $1`, [payout])).constraint).toBe('PayoutRequest_review_recorded');
        expect((await expectViolation(c, `UPDATE "PayoutRequest" SET status = 'PAID', "reviewedById" = $2, "reviewedAt" = now() WHERE id = $1`, [payout, admin])).constraint).toBe('PayoutRequest_paid_at_matches_status');
        expect((await expectViolation(c, `UPDATE "PayoutRequest" SET status = 'REJECTED', "reviewedById" = $2, "reviewedAt" = now() WHERE id = $1`, [payout, admin])).constraint).toBe('PayoutRequest_rejection_reason');

        await c.query(`UPDATE "PayoutRequest" SET status = 'APPROVED', "reviewedById" = $2, "reviewedAt" = now() WHERE id = $1`, [payout, admin]);
        await c.query(`UPDATE "PayoutRequest" SET status = 'PAID', "paidAt" = now() WHERE id = $1`, [payout]);
        expect((await expectViolation(c, `UPDATE "PayoutRequest" SET status = 'REQUESTED', "paidAt" = NULL WHERE id = $1`, [payout])).message).toMatch(/closed payout request is immutable/);
        expect((await expectViolation(c, `DELETE FROM "PayoutRequest" WHERE id = $1`, [payout])).message).toMatch(/cannot be deleted/);
      }));
  });

  describe('refunds', () => {
    const refund = (c: PoolClient, order: string, intent: string, requester: string, amount: number, status = 'REQUESTED') =>
      c.query(
        `INSERT INTO "Refund" (id, "orderId", "paymentIntentId", amount, reason, status, "requestedById") VALUES (gen_random_uuid(), $1, $2, $3, 'reason', $5::"RefundStatus", $4) RETURNING id`,
        [order, intent, amount, requester, status],
      );

    it('can only be asked for a paid payment, for the right order', () =>
      withRollback(pool, async (c) => {
        const { buyer, order } = await seller(c);
        const other = await insertOrder(c, buyer);
        const unpaid = await insertIntent(c, order, 'PENDING');
        expect((await expectViolation(c, `INSERT INTO "Refund" (id, "orderId", "paymentIntentId", amount, reason, "requestedById") VALUES (gen_random_uuid(), $1, $2, 10, 'r', $3)`, [order, unpaid, buyer])).message).toMatch(/only a paid payment/);

        await c.query(`UPDATE "PaymentIntent" SET status = 'PAID', "paidAt" = now() WHERE id = $1`, [unpaid]);
        expect((await expectViolation(c, `INSERT INTO "Refund" (id, "orderId", "paymentIntentId", amount, reason, "requestedById") VALUES (gen_random_uuid(), $1, $2, 10, 'r', $3)`, [other, unpaid, buyer])).message).toMatch(/payment of its order/);
        await refund(c, order, unpaid, buyer, 10);
      }));

    it('allow one open refund per payment and never add up to more than the captured amount', () =>
      withRollback(pool, async (c) => {
        const { buyer, order } = await seller(c);
        const admin = await insertUser(c, 'ADMIN');
        const intent = await insertIntent(c, order, 'PAID');

        const first = (await refund(c, order, intent, buyer, 60)).rows[0].id;
        const second = await expectViolation(c, `INSERT INTO "Refund" (id, "orderId", "paymentIntentId", amount, reason, "requestedById") VALUES (gen_random_uuid(), $1, $2, 10, 'r', $3)`, [order, intent, buyer]);
        expect(second.constraint).toBe('Refund_one_open_per_payment');

        await c.query(
          `UPDATE "Refund" SET status = 'PROCESSED', "approvedById" = $2, "approvedAt" = now(), "processedAt" = now(), "evidenceUrl" = '{"url":"https://example.test/e.png"}'::jsonb WHERE id = $1`,
          [first, admin],
        );
        const tooMuch = await expectViolation(c, `INSERT INTO "Refund" (id, "orderId", "paymentIntentId", amount, reason, "requestedById") VALUES (gen_random_uuid(), $1, $2, 60, 'r', $3)`, [order, intent, buyer]);
        expect(tooMuch.message).toMatch(/exceed the captured amount/);

        const rest = (await refund(c, order, intent, buyer, 40)).rows[0].id;
        await c.query(`UPDATE "Refund" SET status = 'REJECTED', "rejectionReason" = 'not eligible' WHERE id = $1`, [rest]);
        await refund(c, order, intent, buyer, 40);
        expect((await expectViolation(c, `UPDATE "Refund" SET status = 'APPROVED', "approvedById" = $2, "approvedAt" = now() WHERE id = $1`, [first, admin])).message).toMatch(/closed refund is immutable/);
      }));

    it('keep their terms, need evidence to be processed, and are never deleted', () =>
      withRollback(pool, async (c) => {
        const { buyer, order } = await seller(c);
        const admin = await insertUser(c, 'ADMIN');
        const intent = await insertIntent(c, order, 'PAID');
        const id = (await refund(c, order, intent, buyer, 100)).rows[0].id;

        expect((await expectViolation(c, `UPDATE "Refund" SET amount = 50 WHERE id = $1`, [id])).message).toMatch(/terms are immutable/);
        expect((await expectViolation(c, `UPDATE "Refund" SET status = 'PROCESSED', "approvedById" = $2, "approvedAt" = now(), "processedAt" = now() WHERE id = $1`, [id, admin])).constraint).toBe('Refund_evidence_when_processed');
        expect((await expectViolation(c, `UPDATE "Refund" SET status = 'REJECTED' WHERE id = $1`, [id])).constraint).toBe('Refund_rejection_reason');
        expect((await expectViolation(c, `DELETE FROM "Refund" WHERE id = $1`, [id])).message).toMatch(/cannot be deleted/);

        await c.query(
          `UPDATE "Refund" SET status = 'PROCESSED', "approvedById" = $2, "approvedAt" = now(), "processedAt" = now(), "evidenceUrl" = '{"url":"https://example.test/e.png"}'::jsonb WHERE id = $1`,
          [id, admin],
        );
      }));
  });

  describe('articles', () => {
    it('only publish a published version of the same article', () =>
      withRollback(pool, async (c) => {
        const { creator, tenant } = await seller(c);
        const a = await insertArticle(c, tenant, creator);
        const b = await insertArticle(c, tenant, creator);
        const version = async (article: string, published: boolean) => {
          const id = randomUUID();
          await c.query(
            `INSERT INTO "ArticleVersion" (id, "articleId", "versionNumber", title, content, "createdById", "publishedAt") VALUES ($1, $2, 1, 't', 'body', $3, $4)`,
            [id, article, creator, published ? new Date() : null],
          );
          return id;
        };
        const foreign = await version(b, true);
        const draft = await version(a, false);
        const good = randomUUID();
        await c.query(`INSERT INTO "ArticleVersion" (id, "articleId", "versionNumber", title, content, "createdById", "publishedAt") VALUES ($1, $2, 2, 't', 'body', $3, now())`, [good, a, creator]);

        const publish = (versionId: string | null) =>
          expectViolation(c, `UPDATE "Article" SET status = 'PUBLISHED', "publishedVersionId" = $2, "publishedAt" = now() WHERE id = $1`, [a, versionId]);

        expect((await publish(foreign)).message).toMatch(/published version of the same article/);
        expect((await publish(draft)).message).toMatch(/published version of the same article/);
        expect((await publish(randomUUID())).message).toMatch(/published version of the same article/);
        expect((await publish(null)).constraint).toBe('Article_published_has_version');

        await c.query(`UPDATE "Article" SET status = 'PUBLISHED', "publishedVersionId" = $2, "publishedAt" = now() WHERE id = $1`, [a, good]);
        expect((await expectViolation(c, `UPDATE "ArticleVersion" SET content = 'edited after publishing' WHERE id = $1`, [good])).message).toMatch(/immutable/);
      }));

    it('a version needs a real author', () =>
      withRollback(pool, async (c) => {
        const { creator, tenant } = await seller(c);
        const article = await insertArticle(c, tenant, creator);
        const error = await expectViolation(
          c,
          `INSERT INTO "ArticleVersion" (id, "articleId", "versionNumber", title, content, "createdById") VALUES (gen_random_uuid(), $1, 1, 't', 'b', $2)`,
          [article, randomUUID()],
        );
        expect(error.constraint).toBe('ArticleVersion_createdById_fkey');
      }));
  });
});
