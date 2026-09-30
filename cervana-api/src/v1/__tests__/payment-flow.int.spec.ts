import { PaymentIntent, PaymentIntentStatus, PaymentProvider, Role } from '@prisma/client';
import { Pool } from 'pg';
import {
  createPool,
  databaseUrl,
  describeDb,
  insertPublishedArticle,
  insertPublishedClass,
  insertTenant,
  insertTopic,
  insertUser,
} from '@/test-utils/pg-fixtures';
import { buildCommerceStack, CommerceStack } from '@/test-utils/commerce-harness';
import {
  PaymentMethodOption,
  PaymentPresentation,
  PaymentProviderAdapter,
} from '@/v1/payments/payment.types';

class FakeGatewayProvider implements PaymentProviderAdapter {
  readonly provider = PaymentProvider.MIDTRANS;
  readonly capabilities = {
    supportsCheckout: true,
    supportsWebhook: true,
    supportsRefund: true,
    supportsCapture: true,
    supportsPartialRefund: true,
  };
  listMethods(): PaymentMethodOption[] {
    return [{ method: 'GOPAY', label: 'GoPay' }];
  }
  async createPaymentIntent(_ctx: unknown, input: { orderId: string }) {
    return {
      providerPaymentId: `gw-${input.orderId}`,
      metadata: { checkoutUrl: `https://gateway.test/pay/${input.orderId}` },
    };
  }
  presentPayment(intent: PaymentIntent): PaymentPresentation {
    return { type: 'REDIRECT', data: { url: (intent.metadata as { checkoutUrl: string }).checkoutUrl } };
  }
  async getPaymentStatus(_ctx: unknown, intent: { status: PaymentIntentStatus }) {
    return { status: intent.status, providerStatus: 'pending', observedAt: new Date() };
  }
  async cancelPayment() {
    return { allowed: true };
  }
  async refundPayment() {
    return { mode: 'PROVIDER' as const, providerRefundId: 'refund-1', status: 'PENDING' as const };
  }
  async reconcilePayment() {
    return { providerStatus: 'settlement', consistent: true, discrepancies: [] };
  }
}

const proofFor = (userId: string) => ({
  url: `https://res.cloudinary.com/demo/image/upload/images/${userId}-proof.png`,
  fileId: `images/${userId}-proof`,
});

describeDb('payment domain on a real database (requires TEST_DATABASE_URL)', () => {
  let pool: Pool;
  let stack: CommerceStack;
  const extraStacks: CommerceStack[] = [];

  const student = (id: string) => ({ id, role: Role.STUDENT });
  const admin = (id: string) => ({ id, role: Role.ADMIN });

  const count = async (sql: string, params: unknown[] = []) =>
    Number((await pool.query(sql, params)).rows[0].count);

  const world = async (price = '100000.00') => {
    const buyer = await insertUser(pool);
    const reviewer = await insertUser(pool, 'ADMIN');
    const owner = await insertUser(pool, 'TEACHER');
    const tenant = await insertTenant(pool, owner);
    const article = await insertPublishedArticle(pool, tenant, owner, price);
    return { buyer, reviewer, owner, tenant, article };
  };

  const createArticleOrder = (s: CommerceStack, w: { buyer: string; article: string }) =>
    s.orders.create(
      student(w.buyer),
      { items: [{ type: 'ARTICLE', id: w.article }], paymentMethod: 'BANK_TRANSFER' },
      'trace-create',
    );

  const submitProof = (s: CommerceStack, buyer: string, intentId: string) =>
    s.manual.submit(
      student(buyer),
      intentId,
      { paymentMethod: 'BANK_TRANSFER', referenceNumber: 'TRX-001', proof: proofFor(buyer) },
      'trace-submit',
    );

  const paidWorld = async (s: CommerceStack = stack) => {
    const w = await world();
    const order = (await createArticleOrder(s, w)).data;
    const submitted = await submitProof(s, w.buyer, order.payment!.id);
    return { ...w, orderId: order.id, intentId: order.payment!.id, submissionId: submitted.data.submission.id };
  };

  beforeAll(() => {
    process.env.DATABASE_URL = databaseUrl;
    pool = createPool();
    stack = buildCommerceStack();
  });

  afterAll(async () => {
    await stack.prisma.$disconnect();
    for (const extra of extraStacks) await extra.prisma.$disconnect();
    await pool.end();
  });

  describe('order creation', () => {
    it('creates a pending order with a MANUAL payment intent and payment instructions', async () => {
      const w = await world();
      const { data } = await createArticleOrder(stack, w);

      expect(data.status).toBe('PENDING');
      expect(data.currency).toBe('IDR');
      expect(data.total?.toString()).toBe('100000');
      expect(data.platformFee?.toString()).toBe('10000');
      expect(data.items).toHaveLength(1);
      expect(data.items[0].articleId).toBe(w.article);

      expect(data.payment).toMatchObject({ provider: 'MANUAL', status: 'PENDING' });
      expect(data.payment!.presentation).toMatchObject({ type: 'MANUAL_INSTRUCTIONS' });
      const accounts = (data.payment!.presentation!.data as { accounts: Array<{ method: string }> }).accounts;
      expect(accounts.map((a) => a.method)).toEqual(['BANK_TRANSFER']);

      expect(await count(`SELECT count(*) FROM "DomainEvent" WHERE type = 'PaymentCreated' AND "aggregateId" = $1`, [data.payment!.id])).toBe(1);
      expect(await count(`SELECT count(*) FROM "AuditLog" WHERE action = 'ORDER_CREATED' AND "entityId" = $1`, [data.id])).toBe(1);
    });

    it('prices from the database and never from the client', async () => {
      const w = await world('250000.00');
      const { data } = await stack.orders.create(
        student(w.buyer),
        { items: [{ type: 'ARTICLE', id: w.article }], amount: 1, total: 1 } as never,
        'trace',
      );
      expect(data.total?.toString()).toBe('250000');
    });

    it('returns the same open order for the same items, including under concurrency', async () => {
      const w = await world();
      const results = await Promise.all(Array.from({ length: 6 }, () => createArticleOrder(stack, w)));
      expect(new Set(results.map((r) => r.data.id)).size).toBe(1);
      expect(await count(`SELECT count(*) FROM "Order" WHERE "userId" = $1`, [w.buyer])).toBe(1);
      expect(await count(`SELECT count(*) FROM "PaymentIntent" p JOIN "Order" o ON o.id = p."orderId" WHERE o."userId" = $1`, [w.buyer])).toBe(1);
    });

    it('rejects free, unpublished, unknown-method and already owned purchases', async () => {
      const w = await world();
      const free = await insertPublishedArticle(pool, w.tenant, w.owner, null);
      await expect(
        stack.orders.create(student(w.buyer), { items: [{ type: 'ARTICLE', id: free }] }, 't'),
      ).rejects.toMatchObject({ statusCode: 422 });

      const draft = await insertPublishedArticle(pool, w.tenant, w.owner, '5000.00');
      await pool.query(`UPDATE "Article" SET status = 'DRAFT' WHERE id = $1`, [draft]);
      await expect(
        stack.orders.create(student(w.buyer), { items: [{ type: 'ARTICLE', id: draft }] }, 't'),
      ).rejects.toMatchObject({ statusCode: 404 });

      await expect(
        stack.orders.create(student(w.buyer), { items: [{ type: 'ARTICLE', id: w.article }], paymentMethod: 'CRYPTO' }, 't'),
      ).rejects.toMatchObject({ statusCode: 422 });
      expect(await count(`SELECT count(*) FROM "Order" WHERE "userId" = $1`, [w.buyer])).toBe(0);

      const order = (await createArticleOrder(stack, w)).data;
      const submitted = await submitProof(stack, w.buyer, order.payment!.id);
      await stack.manual.approve(admin(w.reviewer), submitted.data.submission.id, 'verified', 't');
      await expect(createArticleOrder(stack, w)).rejects.toMatchObject({ statusCode: 409, code: 'ALREADY_OWNED' });
    });

    it('does not create an order for a tenant that is not active', async () => {
      const w = await world();
      await pool.query(`UPDATE "Tenant" SET status = 'SUSPENDED' WHERE id = $1`, [w.tenant]);
      await expect(createArticleOrder(stack, w)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('manual payment acceptance', () => {
    it('create order → submit proof → admin approve → paid, fulfilled, earned and ledgered once', async () => {
      const w = await paidWorld();

      expect(
        (await pool.query(`SELECT status::text FROM "PaymentIntent" WHERE id = $1`, [w.intentId])).rows[0].status,
      ).toBe('SUBMITTED');
      expect((await pool.query(`SELECT status::text FROM "Order" WHERE id = $1`, [w.orderId])).rows[0].status).toBe('PENDING');

      const approved = await stack.manual.approve(admin(w.reviewer), w.submissionId, 'Transfer matches statement', 'trace-approve');
      expect(approved.data).toMatchObject({ status: 'APPROVED', paymentStatus: 'PAID', changed: true });

      const intent = (await pool.query(`SELECT status::text, "paidAt" FROM "PaymentIntent" WHERE id = $1`, [w.intentId])).rows[0];
      expect(intent.status).toBe('PAID');
      expect(intent.paidAt).not.toBeNull();

      const order = (await pool.query(`SELECT status::text, "paidAt" FROM "Order" WHERE id = $1`, [w.orderId])).rows[0];
      expect(order.status).toBe('FULFILLED');
      expect(order.paidAt).not.toBeNull();

      const capture = await pool.query(
        `SELECT type::text, status::text, amount::text, "providerTransactionId", "externalReference" FROM "PaymentTransaction" WHERE "paymentIntentId" = $1`,
        [w.intentId],
      );
      expect(capture.rows).toEqual([
        { type: 'CAPTURE', status: 'SUCCEEDED', amount: '100000.00', providerTransactionId: w.submissionId, externalReference: 'TRX-001' },
      ]);

      const entitlement = await pool.query(
        `SELECT "resourceType"::text, status::text, "orderId", "tenantId" FROM "Entitlement" WHERE "userId" = $1 AND "articleId" = $2`,
        [w.buyer, w.article],
      );
      expect(entitlement.rows).toEqual([{ resourceType: 'ARTICLE', status: 'ACTIVE', orderId: w.orderId, tenantId: w.tenant }]);

      const earnings = await pool.query(
        `SELECT "creatorId", "tenantId", "grossAmount"::text AS gross, "platformFee"::text AS fee, "creatorAmount"::text AS creator, status::text FROM "CreatorEarning" WHERE "orderId" = $1`,
        [w.orderId],
      );
      expect(earnings.rows).toEqual([
        { creatorId: w.owner, tenantId: w.tenant, gross: '100000.00', fee: '10000.00', creator: '90000.00', status: 'AVAILABLE' },
      ]);

      const ledger = await pool.query(
        `SELECT category::text, amount::text FROM "LedgerTransaction" WHERE "orderId" = $1 ORDER BY category::text`,
        [w.orderId],
      );
      expect(ledger.rows).toEqual([
        { category: 'CREATOR_EARNING', amount: '90000.00' },
        { category: 'ORDER_PAYMENT', amount: '100000.00' },
        { category: 'PLATFORM_FEE', amount: '10000.00' },
        { category: 'WALLET_CREDIT', amount: '90000.00' },
      ]);

      const wallet = await pool.query(
        `SELECT id, balance::text AS balance FROM "Wallet" WHERE "ownerId" = $1 AND "tenantId" = $2 AND currency = 'IDR'`,
        [w.owner, w.tenant],
      );
      expect(wallet.rows).toHaveLength(1);
      expect(wallet.rows[0].balance).toBe('90000.00');
      expect(
        (await pool.query(`SELECT count(*)::int AS n FROM "LedgerTransaction" WHERE "walletId" = $1`, [wallet.rows[0].id])).rows[0].n,
      ).toBe(1);

      for (const type of ['OrderFulfilled', 'CreatorEarningCreated']) {
        expect(await count(`SELECT count(*) FROM "DomainEvent" WHERE type = $1 AND "payload"::text LIKE '%' || $2 || '%'`, [type, w.orderId])).toBe(1);
      }
      expect(await count(`SELECT count(*) FROM "DomainEvent" WHERE type = 'EntitlementGranted' AND "payload"::text LIKE '%' || $1 || '%'`, [w.article])).toBe(1);

      expect(await count(`SELECT count(*) FROM "DomainEvent" WHERE type = 'PaymentVerified' AND "aggregateId" = $1`, [w.intentId])).toBe(1);
      const actions = (await pool.query(
        `SELECT DISTINCT action FROM "AuditLog" WHERE "entityId" IN ($1, $2, $3) ORDER BY action`,
        [w.orderId, w.intentId, w.submissionId],
      )).rows.map((r) => r.action);
      expect(actions).toEqual(
        expect.arrayContaining([
          'MANUAL_PAYMENT_SUBMITTED',
          'MANUAL_PAYMENT_APPROVED',
          'PAYMENT_INTENT_VERIFIED',
          'ORDER_PAID',
          'ORDER_FULFILLED',
          'ORDER_FULFILLMENT_COMPLETED',
        ]),
      );
    });

    it('a repeated approval produces no duplicate entitlement, earning, ledger entry, capture or event', async () => {
      const w = await paidWorld();
      await stack.manual.approve(admin(w.reviewer), w.submissionId, 'first', 't1');

      const snapshot = async () => ({
        entitlements: await count(`SELECT count(*) FROM "Entitlement" WHERE "userId" = $1`, [w.buyer]),
        earnings: await count(`SELECT count(*) FROM "CreatorEarning" WHERE "orderId" = $1`, [w.orderId]),
        ledger: await count(`SELECT count(*) FROM "LedgerTransaction" WHERE "orderId" = $1`, [w.orderId]),
        captures: await count(`SELECT count(*) FROM "PaymentTransaction" WHERE "paymentIntentId" = $1`, [w.intentId]),
        events: await count(`SELECT count(*) FROM "DomainEvent" WHERE "aggregateId" = $1`, [w.intentId]),
        audit: await count(`SELECT count(*) FROM "AuditLog" WHERE "entityId" IN ($1, $2, $3)`, [w.orderId, w.intentId, w.submissionId]),
      });

      const before = await snapshot();
      const again = await stack.manual.approve(admin(w.reviewer), w.submissionId, 'second', 't2');
      expect(again.data).toMatchObject({ status: 'APPROVED', paymentStatus: 'PAID', changed: false });
      expect(await snapshot()).toEqual(before);
      expect(before).toMatchObject({ entitlements: 1, earnings: 1, ledger: 4, captures: 1 });
    });

    it('concurrent approvals have exactly one effect', async () => {
      const w = await paidWorld();
      const results = await Promise.allSettled(
        Array.from({ length: 8 }, (_, i) =>
          stack.manual.approve(admin(w.reviewer), w.submissionId, `attempt ${i}`, `t${i}`),
        ),
      );
      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
      const changed = results.filter((r) => r.status === 'fulfilled' && (r.value.data as { changed: boolean }).changed);
      expect(changed).toHaveLength(1);

      expect(await count(`SELECT count(*) FROM "Entitlement" WHERE "userId" = $1`, [w.buyer])).toBe(1);
      expect(await count(`SELECT count(*) FROM "CreatorEarning" WHERE "orderId" = $1`, [w.orderId])).toBe(1);
      expect(await count(`SELECT count(*) FROM "LedgerTransaction" WHERE "orderId" = $1`, [w.orderId])).toBe(4);
      expect(await count(`SELECT count(*) FROM "PaymentTransaction" WHERE "paymentIntentId" = $1`, [w.intentId])).toBe(1);
      expect(await count(`SELECT count(*) FROM "AuditLog" WHERE action = 'MANUAL_PAYMENT_APPROVED' AND "entityId" = $1`, [w.submissionId])).toBe(1);
    });

    it('a concurrent approve and reject settle on one consistent outcome', async () => {
      const w = await paidWorld();
      const results = await Promise.allSettled([
        stack.manual.approve(admin(w.reviewer), w.submissionId, 'looks fine', 'ta'),
        stack.manual.reject(admin(w.reviewer), w.submissionId, { reason: 'blurry proof', allowResubmit: true }, 'tr'),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const failure = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(failure.reason).toMatchObject({ statusCode: 409 });

      const report = await stack.payments.reconcile(w.intentId, { actor: { kind: 'ADMIN', id: w.reviewer, role: Role.ADMIN } });
      expect(report.consistent).toBe(true);
      const paid = report.status === 'PAID';
      expect(await count(`SELECT count(*) FROM "Entitlement" WHERE "userId" = $1`, [w.buyer])).toBe(paid ? 1 : 0);
      expect(await count(`SELECT count(*) FROM "CreatorEarning" WHERE "orderId" = $1`, [w.orderId])).toBe(paid ? 1 : 0);
    });

    it('rolls the whole approval back when any downstream fulfillment step fails', async () => {
      const isolated = buildCommerceStack();
      extraStacks.push(isolated);
      const w = await paidWorld(isolated);

      isolated.bus.subscribe('PaymentVerified', 'failing-consumer', async () => {
        throw new Error('downstream failure');
      });
      await expect(isolated.manual.approve(admin(w.reviewer), w.submissionId, 'approve', 't')).rejects.toThrow('downstream failure');

      expect((await pool.query(`SELECT status::text FROM "ManualPaymentSubmission" WHERE id = $1`, [w.submissionId])).rows[0].status).toBe('SUBMITTED');
      expect((await pool.query(`SELECT status::text FROM "PaymentIntent" WHERE id = $1`, [w.intentId])).rows[0].status).toBe('SUBMITTED');
      expect((await pool.query(`SELECT status::text FROM "Order" WHERE id = $1`, [w.orderId])).rows[0].status).toBe('PENDING');
      expect(await count(`SELECT count(*) FROM "PaymentTransaction" WHERE "paymentIntentId" = $1`, [w.intentId])).toBe(0);
      expect(await count(`SELECT count(*) FROM "Entitlement" WHERE "userId" = $1`, [w.buyer])).toBe(0);
      expect(await count(`SELECT count(*) FROM "CreatorEarning" WHERE "orderId" = $1`, [w.orderId])).toBe(0);
      expect(await count(`SELECT count(*) FROM "LedgerTransaction" WHERE "orderId" = $1`, [w.orderId])).toBe(0);
      expect(await count(`SELECT count(*) FROM "DomainEvent" WHERE type = 'PaymentVerified' AND "aggregateId" = $1`, [w.intentId])).toBe(0);

      const retry = buildCommerceStack();
      extraStacks.push(retry);
      const ok = await retry.manual.approve(admin(w.reviewer), w.submissionId, 'approve again', 't');
      expect(ok.data).toMatchObject({ paymentStatus: 'PAID', changed: true });
    });

    it('a non-admin can never approve, and the buyer cannot submit for someone else', async () => {
      const w = await paidWorld();
      await expect(stack.manual.approve(student(w.buyer), w.submissionId, 'self approve', 't')).rejects.toMatchObject({ status: 403 });

      const stranger = await insertUser(pool);
      const order = (await createArticleOrder(stack, await world())).data;
      await expect(
        stack.manual.submit(student(stranger), order.payment!.id, { paymentMethod: 'BANK_TRANSFER', proof: proofFor(stranger) }, 't'),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('validates the proof before accepting it', async () => {
      const strict = buildCommerceStack({ ownsFile: () => false });
      extraStacks.push(strict);
      const w = await world();
      const order = (await createArticleOrder(strict, w)).data;
      const intentId = order.payment!.id;
      const submit = (proof: { url: string; fileId: string }) =>
        strict.manual.submit(student(w.buyer), intentId, { paymentMethod: 'BANK_TRANSFER', proof }, 't');

      await expect(submit(proofFor(w.buyer))).rejects.toMatchObject({ statusCode: 422 });

      const permissive = buildCommerceStack();
      extraStacks.push(permissive);
      const submitPermissive = (proof: { url: string; fileId: string }) =>
        permissive.manual.submit(student(w.buyer), intentId, { paymentMethod: 'BANK_TRANSFER', proof }, 't');
      await expect(submitPermissive({ url: 'http://insecure.test/x.png', fileId: 'images/x' })).rejects.toMatchObject({ statusCode: 422 });
      await expect(submitPermissive({ url: 'https://res.cloudinary.com/demo/other.png', fileId: 'images/x' })).rejects.toMatchObject({ statusCode: 422 });
      await expect(
        permissive.manual.submit(student(w.buyer), intentId, { paymentMethod: 'CRYPTO', proof: proofFor(w.buyer) }, 't'),
      ).rejects.toMatchObject({ statusCode: 422 });
      expect(await count(`SELECT count(*) FROM "ManualPaymentSubmission" WHERE "paymentIntentId" = $1`, [intentId])).toBe(0);
      await expect(submitPermissive(proofFor(w.buyer))).resolves.toBeDefined();
      await expect(submitPermissive(proofFor(w.buyer))).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('rejection, cancellation and expiry', () => {
    it('a rejection with resubmit returns the payment to pending and a later proof can be approved', async () => {
      const w = await paidWorld();
      const rejected = await stack.manual.reject(admin(w.reviewer), w.submissionId, { reason: 'Proof is unreadable', allowResubmit: true }, 't');
      expect(rejected.data).toMatchObject({ status: 'REJECTED', paymentStatus: 'PENDING' });
      expect((await pool.query(`SELECT status::text FROM "Order" WHERE id = $1`, [w.orderId])).rows[0].status).toBe('PENDING');
      expect(await count(`SELECT count(*) FROM "Entitlement" WHERE "userId" = $1`, [w.buyer])).toBe(0);

      const second = await submitProof(stack, w.buyer, w.intentId);
      const approved = await stack.manual.approve(admin(w.reviewer), second.data.submission.id, 'second proof ok', 't');
      expect(approved.data).toMatchObject({ paymentStatus: 'PAID' });
      expect((await pool.query(`SELECT status::text FROM "Order" WHERE id = $1`, [w.orderId])).rows[0].status).toBe('FULFILLED');
      await expect(
        stack.manual.approve(admin(w.reviewer), w.submissionId, 'approve the rejected one', 't'),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('a final rejection fails the payment and the order, and cannot be approved afterwards', async () => {
      const w = await paidWorld();
      const rejected = await stack.manual.reject(admin(w.reviewer), w.submissionId, { reason: 'Fraudulent proof', allowResubmit: false }, 't');
      expect(rejected.data).toMatchObject({ paymentStatus: 'FAILED' });
      expect((await pool.query(`SELECT status::text FROM "Order" WHERE id = $1`, [w.orderId])).rows[0].status).toBe('FAILED');
      expect(await count(`SELECT count(*) FROM "DomainEvent" WHERE type = 'PaymentFailed' AND "aggregateId" = $1`, [w.intentId])).toBe(1);
      await expect(stack.manual.approve(admin(w.reviewer), w.submissionId, 'late', 't')).rejects.toMatchObject({ statusCode: 409 });

      const again = await stack.manual.reject(admin(w.reviewer), w.submissionId, { reason: 'Fraudulent proof', allowResubmit: false }, 't');
      expect(again.data).toMatchObject({ changed: false });
    });

    it('fails the payment when the proof attempts are exhausted', async () => {
      const limited = buildCommerceStack({ env: { MANUAL_PAYMENT_MAX_SUBMISSIONS: '2' } });
      extraStacks.push(limited);
      const w = await world();
      const order = (await createArticleOrder(limited, w)).data;
      const first = await submitProof(limited, w.buyer, order.payment!.id);
      await limited.manual.reject(admin(w.reviewer), first.data.submission.id, { reason: 'first bad proof', allowResubmit: true }, 't');
      const second = await submitProof(limited, w.buyer, order.payment!.id);
      const rejected = await limited.manual.reject(admin(w.reviewer), second.data.submission.id, { reason: 'second bad proof', allowResubmit: true }, 't');
      expect(rejected.data).toMatchObject({ paymentStatus: 'FAILED' });
    });

    it('cancels a pending order and its payment, idempotently, and refuses once a proof is under review', async () => {
      const w = await world();
      const order = (await createArticleOrder(stack, w)).data;
      const cancelled = await stack.orders.cancelOrder(student(w.buyer), order.id, 't');
      expect(cancelled.data.status).toBe('CANCELLED');
      expect((await pool.query(`SELECT status::text FROM "PaymentIntent" WHERE id = $1`, [order.payment!.id])).rows[0].status).toBe('CANCELLED');
      const again = await stack.orders.cancelOrder(student(w.buyer), order.id, 't');
      expect(again.message).toBe('Order already cancelled');
      await expect(stack.orders.cancelOrder(student(await insertUser(pool)), order.id, 't')).rejects.toMatchObject({ statusCode: 404 });

      const cancelledOrderAgain = (await createArticleOrder(stack, w)).data;
      expect(cancelledOrderAgain.id).not.toBe(order.id);
      const submitted = await submitProof(stack, w.buyer, cancelledOrderAgain.payment!.id);
      await expect(stack.orders.cancelOrder(student(w.buyer), cancelledOrderAgain.id, 't')).rejects.toMatchObject({ statusCode: 409 });
      expect((await pool.query(`SELECT status::text FROM "PaymentIntent" WHERE id = $1`, [cancelledOrderAgain.payment!.id])).rows[0].status).toBe('SUBMITTED');
      expect(submitted.data.paymentStatus).toBe('SUBMITTED');
    });

    it('expires unpaid payments and their orders, but never one that is awaiting review', async () => {
      const unpaid = await world();
      const unpaidOrder = (await createArticleOrder(stack, unpaid)).data;
      const reviewing = await paidWorld();
      await pool.query(`UPDATE "PaymentIntent" SET "expiresAt" = now() - interval '1 minute' WHERE id = ANY($1)`, [
        [unpaidOrder.payment!.id, reviewing.intentId],
      ]);

      await stack.payments.expireDue(500);

      expect((await pool.query(`SELECT status::text FROM "PaymentIntent" WHERE id = $1`, [unpaidOrder.payment!.id])).rows[0].status).toBe('EXPIRED');
      expect((await pool.query(`SELECT status::text FROM "Order" WHERE id = $1`, [unpaidOrder.id])).rows[0].status).toBe('EXPIRED');
      expect((await pool.query(`SELECT status::text FROM "PaymentIntent" WHERE id = $1`, [reviewing.intentId])).rows[0].status).toBe('SUBMITTED');

      const approved = await stack.manual.approve(admin(reviewing.reviewer), reviewing.submissionId, 'still valid', 't');
      expect(approved.data).toMatchObject({ paymentStatus: 'PAID' });
    });

    it('refuses a proof after the window closed', async () => {
      const w = await world();
      const order = (await createArticleOrder(stack, w)).data;
      await pool.query(`UPDATE "PaymentIntent" SET "expiresAt" = now() - interval '1 minute' WHERE id = $1`, [order.payment!.id]);
      await expect(submitProof(stack, w.buyer, order.payment!.id)).rejects.toMatchObject({ statusCode: 409, code: 'PAYMENT_EXPIRED' });
      expect((await pool.query(`SELECT status::text FROM "Order" WHERE id = $1`, [order.id])).rows[0].status).toBe('EXPIRED');
      const fresh = (await createArticleOrder(stack, w)).data;
      expect(fresh.id).not.toBe(order.id);
    });
  });

  describe('products', () => {
    it('fulfils a paid curriculum topic through the same pipeline without a creator earning', async () => {
      const buyer = await insertUser(pool);
      const reviewer = await insertUser(pool, 'ADMIN');
      const topic = await insertTopic(pool, 50000);

      const order = (await stack.orders.create(student(buyer), { topicId: topic }, 't')).data;
      expect(order.topicId).toBe(topic);
      expect(order.total?.toString()).toBe('50000');
      expect(order.platformFee?.toString()).toBe('0');

      const submitted = await submitProof(stack, buyer, order.payment!.id);
      await stack.manual.approve(admin(reviewer), submitted.data.submission.id, 'ok', 't');

      expect(await count(`SELECT count(*) FROM "CreatorEarning" WHERE "orderId" = $1`, [order.id])).toBe(0);
      const ledger = await pool.query(`SELECT category::text, amount::text FROM "LedgerTransaction" WHERE "orderId" = $1`, [order.id]);
      expect(ledger.rows).toEqual([{ category: 'ORDER_PAYMENT', amount: '50000.00' }]);
      expect(await count(`SELECT count(*) FROM "Entitlement" WHERE "userId" = $1 AND "topicId" = $2 AND status = 'ACTIVE'`, [buyer, topic])).toBe(1);
      expect(
        (await pool.query(`SELECT "accessType"::text FROM "UserTopic" WHERE "userId" = $1 AND "topicId" = $2`, [buyer, topic])).rows[0].accessType,
      ).toBe('PURCHASED');
      await expect(stack.orders.create(student(buyer), { topicId: topic }, 't')).rejects.toMatchObject({ code: 'ALREADY_OWNED' });
    });

    it('enrols a free topic without a payment', async () => {
      const buyer = await insertUser(pool);
      const topic = await insertTopic(pool, 0);
      const first = await stack.orders.create(student(buyer), { topicId: topic }, 't');
      expect(first.data.status).toBe('FULFILLED');
      expect(first.data.payment).toBeNull();
      const second = await stack.orders.create(student(buyer), { topicId: topic }, 't');
      expect(second.data.id).toBe(first.data.id);
      expect(
        (await pool.query(`SELECT "accessType"::text FROM "UserTopic" WHERE "userId" = $1 AND "topicId" = $2`, [buyer, topic])).rows[0].accessType,
      ).toBe('FREE');
    });

    it('splits a multi-tenant order into one earning per tenant and a balanced ledger', async () => {
      const buyer = await insertUser(pool);
      const reviewer = await insertUser(pool, 'ADMIN');
      const ownerA = await insertUser(pool, 'TEACHER');
      const ownerB = await insertUser(pool, 'TEACHER');
      const tenantA = await insertTenant(pool, ownerA);
      const tenantB = await insertTenant(pool, ownerB);
      const article = await insertPublishedArticle(pool, tenantA, ownerA, '33333.33');
      const klass = await insertPublishedClass(pool, tenantB, ownerB, '150000.00');

      const order = (
        await stack.orders.create(
          student(buyer),
          { items: [{ type: 'ARTICLE', id: article }, { type: 'CLASS', id: klass }] },
          't',
        )
      ).data;
      expect(order.total?.toString()).toBe('183333.33');
      expect(order.platformFee?.toString()).toBe('18333.33');

      const submitted = await submitProof(stack, buyer, order.payment!.id);
      await stack.manual.approve(admin(reviewer), submitted.data.submission.id, 'ok', 't');

      const earnings = await pool.query(
        `SELECT "tenantId", "creatorId", "grossAmount"::text AS gross, "platformFee"::text AS fee, "creatorAmount"::text AS creator FROM "CreatorEarning" WHERE "orderId" = $1 ORDER BY "grossAmount"`,
        [order.id],
      );
      expect(earnings.rows).toEqual([
        { tenantId: tenantA, creatorId: ownerA, gross: '33333.33', fee: '3333.33', creator: '30000.00' },
        { tenantId: tenantB, creatorId: ownerB, gross: '150000.00', fee: '15000.00', creator: '135000.00' },
      ]);

      const sums = (
        await pool.query(
          `SELECT category::text, sum(amount)::text AS total, count(*)::int AS entries FROM "LedgerTransaction" WHERE "orderId" = $1 GROUP BY category ORDER BY category::text`,
          [order.id],
        )
      ).rows;
      expect(sums).toEqual([
        { category: 'CREATOR_EARNING', total: '165000.00', entries: 2 },
        { category: 'ORDER_PAYMENT', total: '183333.33', entries: 1 },
        { category: 'PLATFORM_FEE', total: '18333.33', entries: 2 },
        { category: 'WALLET_CREDIT', total: '165000.00', entries: 2 },
      ]);
      const wallets = await pool.query(`SELECT "ownerId", balance::text AS balance FROM "Wallet" WHERE "ownerId" = ANY($1) ORDER BY "Wallet"."balance" ASC`, [[ownerA, ownerB]]);
      expect(wallets.rows).toEqual([
        { ownerId: ownerA, balance: '30000.00' },
        { ownerId: ownerB, balance: '135000.00' },
      ]);
      expect(await count(`SELECT count(*) FROM "Entitlement" WHERE "userId" = $1 AND status = 'ACTIVE'`, [buyer])).toBe(2);
    });
  });

  describe('reconciliation', () => {
    it('reports a consistent manual payment and flags a tampered order', async () => {
      const w = await paidWorld();
      await stack.manual.approve(admin(w.reviewer), w.submissionId, 'ok', 't');
      const actor = { kind: 'ADMIN' as const, id: w.reviewer, role: Role.ADMIN };

      const clean = await stack.payments.reconcile(w.intentId, { actor, traceId: 't' });
      expect(clean).toMatchObject({ consistent: true, status: 'PAID', discrepancies: [] });

      await pool.query(`UPDATE "Order" SET status = 'PENDING' WHERE id = $1`, [w.orderId]);
      const tampered = await stack.payments.reconcile(w.intentId, { actor, traceId: 't' });
      expect(tampered.consistent).toBe(false);
      expect(tampered.discrepancies.join(' ')).toContain('order is PENDING');
      expect(await count(`SELECT count(*) FROM "AuditLog" WHERE action = 'PAYMENT_RECONCILED' AND "entityId" = $1`, [w.intentId])).toBe(2);
    });
  });

  describe('database guarantees behind the payment records', () => {
    it('protects payment history from mutation and duplication', async () => {
      const w = await paidWorld();
      await stack.manual.approve(admin(w.reviewer), w.submissionId, 'ok', 't');

      const fails = async (sql: string, params: unknown[] = []) => {
        await expect(pool.query(sql, params)).rejects.toMatchObject({ code: expect.stringMatching(/^23/) });
      };

      await fails(`UPDATE "ManualPaymentSubmission" SET note = 'edited' WHERE id = $1`, [w.submissionId]);
      await fails(`DELETE FROM "ManualPaymentSubmission" WHERE id = $1`, [w.submissionId]);
      await fails(`UPDATE "PaymentTransaction" SET amount = 1 WHERE "paymentIntentId" = $1`, [w.intentId]);
      await fails(`DELETE FROM "PaymentTransaction" WHERE "paymentIntentId" = $1`, [w.intentId]);
      await fails(`UPDATE "PaymentIntent" SET amount = 1 WHERE id = $1`, [w.intentId]);
      await fails(`UPDATE "PaymentIntent" SET provider = 'STRIPE' WHERE id = $1`, [w.intentId]);
      await fails(`DELETE FROM "PaymentIntent" WHERE id = $1`, [w.intentId]);
      await fails(`UPDATE "DomainEvent" SET type = 'x' WHERE "aggregateId" = $1`, [w.intentId]);
      await fails(
        `INSERT INTO "PaymentTransaction" (id, "paymentIntentId", type, amount, currency, "providerTransactionId", status) VALUES (gen_random_uuid(), $1, 'CAPTURE', 100000, 'IDR', 'second-capture', 'SUCCEEDED')`,
        [w.intentId],
      );
      await fails(
        `INSERT INTO "PaymentIntent" (id, "orderId", provider, amount, currency, status, "expiresAt", "updatedAt") VALUES (gen_random_uuid(), $1, 'MANUAL', 100000, 'IDR', 'PENDING', now() + interval '1 day', now())`,
        [w.orderId],
      );
    });

    it('does not let a terminal payment change state', async () => {
      const w = await world();
      const order = (await createArticleOrder(stack, w)).data;
      await stack.orders.cancelOrder(student(w.buyer), order.id, 't');
      await expect(
        pool.query(`UPDATE "PaymentIntent" SET status = 'PENDING' WHERE id = $1`, [order.payment!.id]),
      ).rejects.toMatchObject({ code: expect.stringMatching(/^23/) });
    });
  });

  describe('a future gateway provider needs no change to the commerce pipeline', () => {
    it('create order → gateway intent → webhook-style verification → the same fulfilment', async () => {
      const gateway = buildCommerceStack({
        env: { PAYMENT_PROVIDER: 'midtrans' },
        extraAdapters: [new FakeGatewayProvider()],
      });
      extraStacks.push(gateway);
      const w = await world();

      const order = (
        await gateway.orders.create(
          student(w.buyer),
          { items: [{ type: 'ARTICLE', id: w.article }], paymentMethod: 'GOPAY' },
          't',
        )
      ).data;
      expect(order.payment).toMatchObject({ provider: 'MIDTRANS', status: 'PENDING' });
      expect(order.payment!.presentation).toMatchObject({ type: 'REDIRECT' });
      const intentId = order.payment!.id;
      expect(
        (await pool.query(`SELECT "providerPaymentId" FROM "PaymentIntent" WHERE id = $1`, [intentId])).rows[0].providerPaymentId,
      ).toBe(`gw-${order.id}`);

      const verify = () =>
        gateway.prisma.$transaction((tx) =>
          gateway.payments.markVerified(
            tx,
            intentId,
            { providerTransactionId: 'gw-txn-1', externalReference: 'gw-ref-1', rawReference: { status: 'settlement' } },
            { actor: { kind: 'PROVIDER', id: null }, traceId: 'webhook-1' },
          ),
        );

      const first = await verify();
      const replay = await verify();
      expect(first.changed).toBe(true);
      expect(replay.changed).toBe(false);

      expect((await pool.query(`SELECT status::text FROM "PaymentIntent" WHERE id = $1`, [intentId])).rows[0].status).toBe('PAID');
      expect((await pool.query(`SELECT status::text FROM "Order" WHERE id = $1`, [order.id])).rows[0].status).toBe('FULFILLED');
      expect(await count(`SELECT count(*) FROM "Entitlement" WHERE "userId" = $1 AND status = 'ACTIVE'`, [w.buyer])).toBe(1);
      expect(await count(`SELECT count(*) FROM "CreatorEarning" WHERE "orderId" = $1`, [order.id])).toBe(1);
      expect(await count(`SELECT count(*) FROM "LedgerTransaction" WHERE "orderId" = $1`, [order.id])).toBe(4);
      expect(await count(`SELECT count(*) FROM "PaymentTransaction" WHERE "paymentIntentId" = $1`, [intentId])).toBe(1);
    });

    it('keeps resolving payments created by another provider after the configuration switches', async () => {
      const w = await world();
      const manualOrder = (await createArticleOrder(stack, w)).data;

      const switched = buildCommerceStack({
        env: { PAYMENT_PROVIDER: 'midtrans' },
        extraAdapters: [new FakeGatewayProvider()],
      });
      extraStacks.push(switched);

      const intent = await switched.prisma.paymentIntent.findUniqueOrThrow({ where: { id: manualOrder.payment!.id } });
      expect(switched.payments.present(intent)).toMatchObject({ type: 'MANUAL_INSTRUCTIONS' });
      expect(switched.payments.listMethods().provider).toBe('MIDTRANS');
    });

    it('reports the provider as unavailable when the configured one is not registered', async () => {
      const broken = buildCommerceStack({ env: { PAYMENT_PROVIDER: 'stripe' } });
      extraStacks.push(broken);
      const w = await world();
      await expect(createArticleOrder(broken, w)).rejects.toMatchObject({ statusCode: 503, code: 'PAYMENT_PROVIDER_UNAVAILABLE' });
      expect(await count(`SELECT count(*) FROM "Order" WHERE "userId" = $1`, [w.buyer])).toBe(0);
    });
  });
});
