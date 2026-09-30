import { LedgerCategory, LedgerDirection, Role } from '@prisma/client';
import { Pool } from 'pg';
import {
  createPool,
  databaseUrl,
  describeDb,
  insertPublishedArticle,
  insertTenant,
  insertUser,
  ledgerSum,
} from '@/test-utils/pg-fixtures';
import { buildCommerceStack, CommerceStack } from '@/test-utils/commerce-harness';

const proofFor = (userId: string) => ({
  url: `https://res.cloudinary.com/demo/image/upload/images/${userId}-proof.png`,
  fileId: `images/${userId}-proof`,
});

describeDb('ledger and wallets on a real database (requires TEST_DATABASE_URL)', () => {
  let pool: Pool;
  const stacks: CommerceStack[] = [];

  const stack = (env: Record<string, string> = {}) => {
    const built = buildCommerceStack({ env });
    stacks.push(built);
    return built;
  };

  const purchase = async (s: CommerceStack, price = '100000.00') => {
    const buyer = await insertUser(pool);
    const reviewer = await insertUser(pool, 'ADMIN');
    const owner = await insertUser(pool, 'TEACHER');
    const tenant = await insertTenant(pool, owner);
    const article = await insertPublishedArticle(pool, tenant, owner, price);
    const order = (
      await s.orders.create({ id: buyer, role: Role.STUDENT }, { items: [{ type: 'ARTICLE', id: article }] }, 't')
    ).data;
    const submitted = await s.manual.submit(
      { id: buyer, role: Role.STUDENT },
      order.payment!.id,
      { paymentMethod: 'BANK_TRANSFER', proof: proofFor(buyer) },
      't',
    );
    await s.manual.approve({ id: reviewer, role: Role.ADMIN }, submitted.data.submission.id, 'verified', 't');
    return { buyer, reviewer, owner, tenant, article, orderId: order.id };
  };

  const one = async (sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows[0];

  beforeAll(() => {
    process.env.DATABASE_URL = databaseUrl;
    pool = createPool();
  });

  afterAll(async () => {
    for (const s of stacks) await s.prisma.$disconnect();
    await pool.end();
  });

  describe('LedgerService', () => {
    it('is idempotent per key, refuses a key reused for different money, and refuses non-positive amounts', async () => {
      const s = stack();
      const user = await insertUser(pool);
      const tenantOwner = await insertUser(pool, 'TEACHER');
      const tenant = await insertTenant(pool, tenantOwner);
      const wallet = await s.prisma.$transaction((tx) => s.wallets.getOrCreate(tx, user, tenant, 'IDR'));
      const key = `adjust-${wallet.id}`;
      const post = (amount: string, direction: LedgerDirection = LedgerDirection.CREDIT) =>
        s.prisma.$transaction((tx) =>
          s.ledgerCore.post(tx, {
            category: LedgerCategory.ADJUSTMENT,
            direction,
            amount,
            currency: 'IDR',
            walletId: wallet.id,
            idempotencyKey: key,
          }),
        );

      const first = await post('50.00');
      const again = await post('50.00');
      expect(first.created).toBe(true);
      expect(again).toMatchObject({ created: false });
      expect(again.entry.id).toBe(first.entry.id);
      await expect(post('60.00')).rejects.toMatchObject({ statusCode: 409 });
      await expect(post('50.00', LedgerDirection.DEBIT)).rejects.toMatchObject({ statusCode: 409 });
      await expect(post('0')).rejects.toMatchObject({ statusCode: 422 });
      expect(await ledgerSum(pool, wallet.id)).toBe('50.00');
      expect((await one(`SELECT balance::text AS b FROM "Wallet" WHERE id = $1`, [wallet.id])).b).toBe('50.00');
    });

    it('reverses an entry once, restoring the wallet, and refuses to reverse a reversal', async () => {
      const s = stack();
      const user = await insertUser(pool);
      const tenantOwner = await insertUser(pool, 'TEACHER');
      const tenant = await insertTenant(pool, tenantOwner);
      const wallet = await s.prisma.$transaction((tx) => s.wallets.getOrCreate(tx, user, tenant, 'IDR'));
      const credit = await s.prisma.$transaction((tx) =>
        s.ledgerCore.post(tx, {
          category: LedgerCategory.ADJUSTMENT,
          direction: LedgerDirection.CREDIT,
          amount: '75.00',
          currency: 'IDR',
          walletId: wallet.id,
          idempotencyKey: `credit-${wallet.id}`,
        }),
      );

      const reverse = () =>
        s.prisma.$transaction((tx) => s.ledgerCore.reverse(tx, credit.entry.id, { idempotencyKey: `reversal-${credit.entry.id}` }));
      const first = await reverse();
      const second = await reverse();
      expect(first).toMatchObject({ created: true });
      expect(second).toMatchObject({ created: false });
      expect(second.entry.id).toBe(first.entry.id);
      expect(first.entry).toMatchObject({ direction: 'DEBIT', reversalOfId: credit.entry.id });
      expect(await ledgerSum(pool, wallet.id)).toBe('0.00');
      await expect(
        s.prisma.$transaction((tx) => s.ledgerCore.reverse(tx, first.entry.id, { idempotencyKey: 'again' })),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('creator earnings and the wallet', () => {
    it('credit the creator wallet on approval when there is no holding period, and the balance equals the ledger', async () => {
      const s = stack();
      const w = await purchase(s);
      const wallet = await one(`SELECT id, balance::text AS balance FROM "Wallet" WHERE "ownerId" = $1 AND "tenantId" = $2`, [w.owner, w.tenant]);
      expect(wallet.balance).toBe('90000.00');
      expect(await ledgerSum(pool, wallet.id)).toBe('90000.00');
      expect((await one(`SELECT status::text AS s, "releasedAt" IS NOT NULL AS released FROM "CreatorEarning" WHERE "orderId" = $1`, [w.orderId]))).toEqual({ s: 'AVAILABLE', released: true });
    });

    it('wait for the holding period, then release exactly once even when released concurrently', async () => {
      const s = stack({ CREATOR_EARNING_HOLD_DAYS: '7' });
      const w = await purchase(s);

      expect((await one(`SELECT status::text AS s FROM "CreatorEarning" WHERE "orderId" = $1`, [w.orderId])).s).toBe('PENDING');
      expect(await one(`SELECT id FROM "Wallet" WHERE "ownerId" = $1`, [w.owner])).toBeUndefined();
      expect(await s.earnings.releaseDue(7)).toBe(0);
      expect((await one(`SELECT count(*)::int AS n FROM "LedgerTransaction" WHERE "orderId" = $1 AND category = 'WALLET_CREDIT'`, [w.orderId])).n).toBe(0);

      await pool.query(`UPDATE "CreatorEarning" SET "createdAt" = now() - interval '8 days' WHERE "orderId" = $1`, [w.orderId]);
      const results = await Promise.all(Array.from({ length: 5 }, () => s.earnings.releaseDue(7)));
      expect(results.reduce((a, b) => a + b, 0)).toBe(1);

      const wallet = await one(`SELECT id, balance::text AS balance FROM "Wallet" WHERE "ownerId" = $1`, [w.owner]);
      expect(wallet.balance).toBe('90000.00');
      expect(await ledgerSum(pool, wallet.id)).toBe('90000.00');
      expect((await one(`SELECT count(*)::int AS n FROM "LedgerTransaction" WHERE "earningId" IN (SELECT id FROM "CreatorEarning" WHERE "orderId" = $1) AND category = 'WALLET_CREDIT'`, [w.orderId])).n).toBe(1);
      expect(await s.earnings.releaseDue(7)).toBe(0);
    });

    it('give two creators of one tenant separate wallets', async () => {
      const s = stack();
      const owner = await insertUser(pool, 'TEACHER');
      const teacherB = await insertUser(pool, 'TEACHER');
      const tenant = await insertTenant(pool, owner);
      const reviewer = await insertUser(pool, 'ADMIN');
      const articleA = await insertPublishedArticle(pool, tenant, owner, '100000.00');
      const articleB = await insertPublishedArticle(pool, tenant, teacherB, '200000.00');
      const buyer = await insertUser(pool);

      const order = (
        await s.orders.create(
          { id: buyer, role: Role.STUDENT },
          { items: [{ type: 'ARTICLE', id: articleA }, { type: 'ARTICLE', id: articleB }] },
          't',
        )
      ).data;
      const submitted = await s.manual.submit({ id: buyer, role: Role.STUDENT }, order.payment!.id, { paymentMethod: 'BANK_TRANSFER', proof: proofFor(buyer) }, 't');
      await s.manual.approve({ id: reviewer, role: Role.ADMIN }, submitted.data.submission.id, 'ok', 't');

      const wallets = await pool.query(`SELECT "ownerId", balance::text AS balance FROM "Wallet" WHERE "tenantId" = $1 ORDER BY "Wallet"."balance" ASC`, [tenant]);
      expect(wallets.rows).toEqual([
        { ownerId: owner, balance: '90000.00' },
        { ownerId: teacherB, balance: '180000.00' },
      ]);
    });
  });

  describe('WalletService', () => {
    it('creates one wallet per owner, tenant and currency even under concurrency', async () => {
      const s = stack();
      const user = await insertUser(pool);
      const tenantOwner = await insertUser(pool, 'TEACHER');
      const tenant = await insertTenant(pool, tenantOwner);
      const wallets = await Promise.all(Array.from({ length: 6 }, () => s.prisma.$transaction((tx) => s.wallets.getOrCreate(tx, user, tenant, 'IDR'))));
      expect(new Set(wallets.map((w) => w.id)).size).toBe(1);
    });

    it('shows a wallet and its ledger only to its owner or an administrator', async () => {
      const s = stack();
      const w = await purchase(s);
      const owner = { id: w.owner, role: Role.TEACHER };
      const stranger = { id: await insertUser(pool, 'TEACHER'), role: Role.TEACHER };
      const admin = { id: w.reviewer, role: Role.ADMIN };

      const mine = await s.wallets.listMine(owner);
      expect(mine.data).toHaveLength(1);
      expect(mine.data[0].balance.toString()).toBe('90000');
      expect((await s.wallets.listMine(stranger)).data).toHaveLength(0);

      const walletId = mine.data[0].id;
      await expect(s.wallets.findOne(stranger, walletId)).rejects.toMatchObject({ statusCode: 404 });
      await expect(s.wallets.ledgerOf(stranger, walletId, 1, 20)).rejects.toMatchObject({ statusCode: 404 });
      await expect(s.wallets.findOne(admin, walletId)).resolves.toBeDefined();

      const ledger = await s.wallets.ledgerOf(owner, walletId, 1, 20);
      expect(ledger.data.pagination.total).toBe(1);
      expect(ledger.data.data[0]).toMatchObject({ category: 'WALLET_CREDIT', direction: 'CREDIT' });
    });
  });
});
