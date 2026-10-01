import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import {
  createPool,
  describeDb,
  expectViolation,
  insertArticle,
  insertIntent,
  insertLedger,
  insertOrder,
  insertPayment,
  insertTenant,
  insertUser,
  insertWallet,
  ledgerSum,
  walletBalance,
  withRollback,
} from '@/test-utils/pg-fixtures';

describeDb('database invariants (requires TEST_DATABASE_URL)', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = createPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('order items and entitlements reference exactly one product', () => {
    it('rejects an order item with no product or with two products', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const tenant = await insertTenant(c, user);
        const article = await insertArticle(c, tenant, user);
        const order = await insertOrder(c, user);
        const insert = `INSERT INTO "OrderItem" (id, "orderId", "articleId", "topicId", quantity, "unitPrice", "totalPrice") VALUES (gen_random_uuid(), $1, $2, $3, 1, 10, 10)`;
        expect((await expectViolation(c, insert, [order, null, null])).constraint).toBe('OrderItem_exactly_one_product');
        const topic = randomUUID();
        expect((await expectViolation(c, insert, [order, article, topic])).code).toMatch(/23514|23503/);
      }));

    it('rejects inconsistent line totals', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const tenant = await insertTenant(c, user);
        const article = await insertArticle(c, tenant, user);
        const order = await insertOrder(c, user);
        const error = await expectViolation(
          c,
          `INSERT INTO "OrderItem" (id, "orderId", "articleId", quantity, "unitPrice", "totalPrice") VALUES (gen_random_uuid(), $1, $2, 2, 10, 15)`,
          [order, article],
        );
        expect(error.constraint).toBe('OrderItem_amounts_valid');
      }));

    it('rejects an entitlement whose type does not match its resource, and duplicates', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const tenant = await insertTenant(c, user);
        const article = await insertArticle(c, tenant, user);
        const mismatch = await expectViolation(
          c,
          `INSERT INTO "Entitlement" (id, "userId", "resourceType", "articleId") VALUES (gen_random_uuid(), $1, 'CLASS', $2)`,
          [user, article],
        );
        expect(mismatch.constraint).toBe('Entitlement_type_matches_resource');
        await c.query(`INSERT INTO "Entitlement" (id, "userId", "resourceType", "articleId") VALUES (gen_random_uuid(), $1, 'ARTICLE', $2)`, [user, article]);
        const duplicate = await expectViolation(
          c,
          `INSERT INTO "Entitlement" (id, "userId", "resourceType", "articleId") VALUES (gen_random_uuid(), $1, 'ARTICLE', $2)`,
          [user, article],
        );
        expect(duplicate.constraint).toBe('Entitlement_userId_articleId_key');
      }));
  });

  describe('pricing', () => {
    it('a paid article must have a positive price and a free one may not need one', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const tenant = await insertTenant(c, user);
        const error = await expectViolation(
          c,
          `INSERT INTO "Article" (id, "tenantId", "authorId", title, slug, "accessType", price, "updatedAt") VALUES (gen_random_uuid(), $1, $2, 't', 's-paid', 'PAID', NULL, now())`,
          [tenant, user],
        );
        expect(error.constraint).toBe('Article_paid_requires_price');
        await insertArticle(c, tenant, user, { accessType: 'PAID', price: '25000.00' });
        await insertArticle(c, tenant, user, { accessType: 'FREE', price: null });
      }));
  });

  describe('payments', () => {
    it('a payment amount must be positive', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const order = await insertOrder(c, user);
        const intent = await insertIntent(c, order);
        const error = await expectViolation(
          c,
          `INSERT INTO "ManualPaymentSubmission" (id, "orderId", "paymentIntentId", "payerId", "paymentMethod", amount, "proofUrl") VALUES (gen_random_uuid(), $1, $3, $2, 'BANK', 0, '{}'::jsonb)`,
          [order, user, intent],
        );
        expect(error.constraint).toBe('ManualPaymentSubmission_amount_positive');
      }));

    it('an order can have many submissions but only one APPROVED', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const order = await insertOrder(c, user);
        await insertPayment(c, order, user, 'REJECTED');
        await insertPayment(c, order, user, 'REJECTED');
        await insertPayment(c, order, user, 'APPROVED');
        const intent = (await c.query(`SELECT id FROM "PaymentIntent" WHERE "orderId" = $1`, [order])).rows[0].id;
        const error = await expectViolation(
          c,
          `INSERT INTO "ManualPaymentSubmission" (id, "orderId", "paymentIntentId", "payerId", "paymentMethod", amount, "proofUrl", status) VALUES (gen_random_uuid(), $1, $3, $2, 'BANK', 100, '{}'::jsonb, 'APPROVED')`,
          [order, user, intent],
        );
        expect(error.constraint).toBe('ManualPaymentSubmission_one_approved_per_order');
      }));

    it('two concurrent approvals of the same order produce exactly one APPROVED row', async () => {
      const user = await insertUser(pool);
      const order = await insertOrder(pool, user);
      await insertIntent(pool, order);
      const attempt = async () => {
        const client = await pool.connect();
        try {
          await insertPayment(client, order, user, 'APPROVED');
          return 'ok';
        } catch (error) {
          return (error as { constraint?: string }).constraint ?? 'error';
        } finally {
          client.release();
        }
      };
      const results = await Promise.all([attempt(), attempt(), attempt(), attempt()]);
      expect(results.filter((r) => r === 'ok')).toHaveLength(1);
      expect(results.filter((r) => r === 'ManualPaymentSubmission_one_approved_per_order')).toHaveLength(3);
      const { rows } = await pool.query(`SELECT count(*)::int AS n FROM "ManualPaymentSubmission" WHERE "orderId" = $1 AND status = 'APPROVED'`, [order]);
      expect(rows[0].n).toBe(1);
    });
  });

  describe('creator earnings and wallets', () => {
    it('earnings must add up and only one may exist per order item', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const buyer = await insertUser(c);
        const tenant = await insertTenant(c, user);
        const article = await insertArticle(c, tenant, user, { accessType: 'PAID', price: '100.00' });
        const order = await insertOrder(c, buyer);
        const item = randomUUID();
        await c.query(
          `INSERT INTO "OrderItem" (id, "orderId", "tenantId", "articleId", quantity, "unitPrice", "totalPrice") VALUES ($1, $2, $3, $4, 1, 100, 100)`,
          [item, order, tenant, article],
        );
        const insert = `INSERT INTO "CreatorEarning" (id, "tenantId", "creatorId", "orderId", "orderItemId", "grossAmount", "platformFee", "creatorAmount") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)`;
        const bad = await expectViolation(c, insert, [tenant, user, order, item, '100.00', '10.00', '95.00']);
        expect(bad.constraint).toBe('CreatorEarning_amounts_consistent');
        await c.query(insert, [tenant, user, order, item, '100.00', '10.00', '90.00']);
        const duplicate = await expectViolation(c, insert, [tenant, user, order, item, '100.00', '10.00', '90.00']);
        expect(duplicate.constraint).toBe('CreatorEarning_orderItemId_key');
      }));

    it('a wallet balance is derived from the ledger and cannot be edited directly', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const tenant = await insertTenant(c, user);
        const wallet = await insertWallet(c, user, tenant, '50.00');
        expect(await walletBalance(c, wallet)).toBe('50.00');
        for (const sql of [
          `UPDATE "Wallet" SET balance = balance + 1000 WHERE id = $1`,
          `UPDATE "Wallet" SET balance = balance - 10 WHERE id = $1`,
        ]) {
          expect((await expectViolation(c, sql, [wallet])).message).toMatch(/only change through the ledger/);
        }
        expect(await walletBalance(c, wallet)).toBe('50.00');
      }));

    it('a wallet balance can never go negative through the ledger', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const tenant = await insertTenant(c, user);
        const wallet = await insertWallet(c, user, tenant, '50.00');
        const error = await expectViolation(
          c,
          `INSERT INTO "LedgerTransaction" (id, category, direction, amount, currency, "walletId", "idempotencyKey") VALUES (gen_random_uuid(), 'ADJUSTMENT', 'DEBIT', 80, 'IDR', $1, 'overdraw')`,
          [wallet],
        );
        expect(error.constraint).toBe('Wallet_balance_non_negative');
        expect(await walletBalance(c, wallet)).toBe('50.00');
      }));

    it('two concurrent ledger debits cannot overdraw a wallet', async () => {
      const user = await insertUser(pool);
      const tenant = await insertTenant(pool, user);
      const wallet = await insertWallet(pool, user, tenant, '100.00');
      const debit = async () => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await insertLedger(client, { category: 'ADJUSTMENT', direction: 'DEBIT', amount: 80, walletId: wallet });
          await client.query('COMMIT');
          return 'ok';
        } catch {
          await client.query('ROLLBACK');
          return 'rejected';
        } finally {
          client.release();
        }
      };
      const results = await Promise.all([debit(), debit(), debit()]);
      expect(results.filter((r) => r === 'ok')).toHaveLength(1);
      expect(await walletBalance(pool, wallet)).toBe('20.00');
      expect(await ledgerSum(pool, wallet)).toBe('20.00');
    });

    it('one tenant can hold a wallet per creator, but never two for the same creator and currency', () =>
      withRollback(pool, async (c) => {
        const owner = await insertUser(c);
        const teacherA = await insertUser(c);
        const teacherB = await insertUser(c);
        const tenant = await insertTenant(c, owner);
        await insertWallet(c, teacherA, tenant, '0');
        await insertWallet(c, teacherB, tenant, '0');
        const duplicate = await expectViolation(
          c,
          `INSERT INTO "Wallet" (id, "ownerId", "tenantId", currency, "updatedAt") VALUES (gen_random_uuid(), $1, $2, 'IDR', now())`,
          [teacherA, tenant],
        );
        expect(duplicate.constraint).toBe('Wallet_ownerId_tenantId_currency_key');
        await c.query(`INSERT INTO "Wallet" (id, "ownerId", "tenantId", currency, "updatedAt") VALUES (gen_random_uuid(), $1, $2, 'USD', now())`, [teacherA, tenant]);
      }));

    it('a wallet cannot start with a balance, change owner, or accept a foreign currency', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const other = await insertUser(c);
        const tenant = await insertTenant(c, user);
        const funded = await expectViolation(
          c,
          `INSERT INTO "Wallet" (id, "ownerId", "tenantId", balance, currency, "updatedAt") VALUES (gen_random_uuid(), $1, $2, 10, 'IDR', now())`,
          [user, tenant],
        );
        expect(funded.message).toMatch(/starts empty/);
        const wallet = await insertWallet(c, user, tenant, '10.00');
        expect((await expectViolation(c, `UPDATE "Wallet" SET "ownerId" = $2 WHERE id = $1`, [wallet, other])).message).toMatch(/ownership is immutable/);
        const foreign = await expectViolation(
          c,
          `INSERT INTO "LedgerTransaction" (id, category, direction, amount, currency, "walletId", "idempotencyKey") VALUES (gen_random_uuid(), 'ADJUSTMENT', 'CREDIT', 5, 'USD', $1, 'usd-into-idr')`,
          [wallet],
        );
        expect(foreign.message).toMatch(/currency does not match/);
      }));
  });

  describe('append-only ledgers', () => {
    it('the commerce ledger cannot be edited or deleted, and amounts are positive', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const order = await insertOrder(c, user);
        const id = await insertLedger(c, { category: 'ORDER_PAYMENT', direction: 'CREDIT', amount: 100, orderId: order });
        expect((await expectViolation(c, `UPDATE "LedgerTransaction" SET amount = 1 WHERE id = $1`, [id])).message).toMatch(/append-only/);
        expect((await expectViolation(c, `DELETE FROM "LedgerTransaction" WHERE id = $1`, [id])).message).toMatch(/append-only/);
        const zero = await expectViolation(c, `INSERT INTO "LedgerTransaction" (id, category, direction, amount, "idempotencyKey") VALUES (gen_random_uuid(), 'ADJUSTMENT', 'CREDIT', 0, 'zero')`);
        expect(zero.constraint).toBe('LedgerTransaction_amount_positive');
      }));

    it('a ledger idempotency key can be used only once', () =>
      withRollback(pool, async (c) => {
        const key = `once-${randomUUID()}`;
        const user = await insertUser(c);
        const order = await insertOrder(c, user);
        await insertLedger(c, { category: 'ORDER_PAYMENT', direction: 'CREDIT', amount: 10, orderId: order, key });
        const error = await expectViolation(
          c,
          `INSERT INTO "LedgerTransaction" (id, category, direction, amount, "orderId", "idempotencyKey") VALUES (gen_random_uuid(), 'ORDER_PAYMENT', 'CREDIT', 10, $1, $2)`,
          [order, key],
        );
        expect(error.constraint).toBe('LedgerTransaction_idempotencyKey_key');
      }));

    it('the AI credit ledger is append-only and idempotent per user', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const id = randomUUID();
        const insert = `INSERT INTO "AICreditLedgerEntry" (id, "userId", type, amount, "balanceAfter", "sourceType", "idempotencyKey") VALUES ($1, $2, 'EARN', 5, 5, 'QUIZ', 'k-1')`;
        await c.query(insert, [id, user]);
        const duplicate = await expectViolation(c, insert.replace('$1', 'gen_random_uuid()').replace('$2', '$1'), [user]);
        expect(duplicate.constraint).toBe('AICreditLedgerEntry_userId_idempotencyKey_key');
        expect((await expectViolation(c, `UPDATE "AICreditLedgerEntry" SET amount = 500 WHERE id = $1`, [id])).message).toMatch(/append-only/);
        expect((await expectViolation(c, `DELETE FROM "AICreditLedgerEntry" WHERE id = $1`, [id])).message).toMatch(/append-only/);
      }));

    it('the audit log is append-only', () =>
      withRollback(pool, async (c) => {
        const id = randomUUID();
        await c.query(`INSERT INTO "AuditLog" (id, action, "entityType", "entityId") VALUES ($1, 'TEST', 'Test', 'x')`, [id]);
        expect((await expectViolation(c, `UPDATE "AuditLog" SET action = 'EDITED' WHERE id = $1`, [id])).message).toMatch(/append-only/);
        expect((await expectViolation(c, `DELETE FROM "AuditLog" WHERE id = $1`, [id])).message).toMatch(/append-only/);
      }));
  });

  describe('AI credit wallet', () => {
    it('never allows an overdraft or over-reservation', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        await c.query(`INSERT INTO "AICreditWallet" (id, "userId", balance, reserved, "updatedAt") VALUES (gen_random_uuid(), $1, 10, 0, now())`, [user]);
        expect((await expectViolation(c, `UPDATE "AICreditWallet" SET balance = balance - 11 WHERE "userId" = $1`, [user])).constraint).toBe('AICreditWallet_no_overdraft');
        expect((await expectViolation(c, `UPDATE "AICreditWallet" SET reserved = 11 WHERE "userId" = $1`, [user])).constraint).toBe('AICreditWallet_no_overdraft');
        await c.query(`UPDATE "AICreditWallet" SET reserved = 10 WHERE "userId" = $1`, [user]);
      }));

    it('two concurrent spends cannot push the balance below zero', async () => {
      const user = await insertUser(pool);
      await pool.query(`INSERT INTO "AICreditWallet" (id, "userId", balance, "updatedAt") VALUES (gen_random_uuid(), $1, 10, now())`, [user]);
      const spend = async () => {
        try {
          const res = await pool.query(`UPDATE "AICreditWallet" SET balance = balance - 6 WHERE "userId" = $1 AND balance >= 6`, [user]);
          return res.rowCount === 1 ? 'ok' : 'insufficient';
        } catch {
          return 'rejected';
        }
      };
      const results = await Promise.all([spend(), spend(), spend(), spend()]);
      expect(results.filter((r) => r === 'ok')).toHaveLength(1);
      const { rows } = await pool.query(`SELECT balance FROM "AICreditWallet" WHERE "userId" = $1`, [user]);
      expect(rows[0].balance).toBe(4);
    });
  });

  describe('article versions', () => {
    it('drafts are editable, but a published version can no longer be changed or deleted', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const tenant = await insertTenant(c, user);
        const article = await insertArticle(c, tenant, user);
        const version = randomUUID();
        await c.query(`INSERT INTO "ArticleVersion" (id, "articleId", "versionNumber", title, content, "createdById") VALUES ($1, $2, 1, 'v1', 'draft', $3)`, [version, article, user]);
        await c.query(`UPDATE "ArticleVersion" SET content = 'edited draft' WHERE id = $1`, [version]);
        await c.query(`UPDATE "ArticleVersion" SET "publishedAt" = now() WHERE id = $1`, [version]);
        expect((await expectViolation(c, `UPDATE "ArticleVersion" SET content = 'tampered' WHERE id = $1`, [version])).message).toMatch(/immutable/);
        expect((await expectViolation(c, `DELETE FROM "ArticleVersion" WHERE id = $1`, [version])).message).toMatch(/immutable/);
      }));

    it('version numbers are unique per article and positive', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const tenant = await insertTenant(c, user);
        const article = await insertArticle(c, tenant, user);
        const insert = `INSERT INTO "ArticleVersion" (id, "articleId", "versionNumber", title, content, "createdById") VALUES (gen_random_uuid(), $1, $2, 't', 'c', $3)`;
        await c.query(insert, [article, 1, user]);
        expect((await expectViolation(c, insert, [article, 1, user])).constraint).toBe('ArticleVersion_articleId_versionNumber_key');
        expect((await expectViolation(c, insert, [article, 0, user])).constraint).toBe('ArticleVersion_number_positive');
      }));
  });

  describe('tenants', () => {
    it('a user has at most one membership per tenant and slugs are unique', () =>
      withRollback(pool, async (c) => {
        const owner = await insertUser(c);
        const tenant = await insertTenant(c, owner);
        const insert = `INSERT INTO "TenantMembership" (id, "tenantId", "userId", role, "updatedAt") VALUES (gen_random_uuid(), $1, $2, 'OWNER', now())`;
        await c.query(insert, [tenant, owner]);
        expect((await expectViolation(c, insert, [tenant, owner])).constraint).toBe('TenantMembership_tenantId_userId_key');
        const slug = await expectViolation(
          c,
          `INSERT INTO "Tenant" (id, name, slug, "ownerId", "updatedAt") VALUES (gen_random_uuid(), 'x', (SELECT slug FROM "Tenant" WHERE id = $1), $2, now())`,
          [tenant, owner],
        );
        expect(slug.constraint).toBe('Tenant_slug_key');
      }));

    it('the same article slug can exist in two tenants but not twice in one', () =>
      withRollback(pool, async (c) => {
        const a = await insertUser(c);
        const b = await insertUser(c);
        const tenantA = await insertTenant(c, a);
        const tenantB = await insertTenant(c, b);
        const insert = `INSERT INTO "Article" (id, "tenantId", "authorId", title, slug, "updatedAt") VALUES (gen_random_uuid(), $1, $2, 't', 'shared-slug', now())`;
        await c.query(insert, [tenantA, a]);
        await c.query(insert, [tenantB, b]);
        expect((await expectViolation(c, insert, [tenantA, a])).constraint).toBe('Article_tenantId_slug_key');
      }));
  });

  describe('learning events', () => {
    it('the same idempotency key cannot record an event twice for one user', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const insert = `INSERT INTO "LearningEvent" (id, "userId", "eventType", payload, "idempotencyKey") VALUES (gen_random_uuid(), $1, 'LESSON_COMPLETED', '{}'::jsonb, $2)`;
        await c.query(insert, [user, 'evt-1']);
        expect((await expectViolation(c, insert, [user, 'evt-1'])).constraint).toBe('LearningEvent_userId_idempotencyKey_key');
        await c.query(insert, [user, 'evt-2']);
        await c.query(insert, [user, null]);
        await c.query(insert, [user, null]);
      }));
  });
});
