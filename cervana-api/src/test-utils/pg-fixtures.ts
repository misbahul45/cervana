import { randomUUID } from 'crypto';
import { Pool, PoolClient } from 'pg';

export const databaseUrl = process.env.TEST_DATABASE_URL;

export const describeDb: typeof describe = (databaseUrl ? describe : describe.skip) as typeof describe;

export const createPool = () => new Pool({ connectionString: databaseUrl, max: 8 });

export const withRollback = async <T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    return await work(client);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
};

export const expectViolation = async (client: PoolClient, sql: string, params: unknown[] = []) => {
  await client.query('SAVEPOINT attempt');
  try {
    await client.query(sql, params);
  } catch (error) {
    await client.query('ROLLBACK TO SAVEPOINT attempt');
    return error as Error & { code?: string; constraint?: string };
  }
  await client.query('ROLLBACK TO SAVEPOINT attempt');
  throw new Error(`Expected a database violation but the statement succeeded: ${sql}`);
};

export const insertUser = async (client: PoolClient | Pool, role = 'STUDENT') => {
  const id = randomUUID();
  await client.query(
    `INSERT INTO "User" (id, name, email, provider, role, "isActive", "totalPoints", souls, stars, "currentStreak", "longestStreak", "updatedAt")
     VALUES ($1, $2, $3, 'JWT', $4::"Role", true, 0, 5, 0, 0, 0, now())`,
    [id, `user-${id.slice(0, 6)}`, `${id}@test.local`, role],
  );
  return id;
};

export const insertTenant = async (client: PoolClient | Pool, ownerId: string) => {
  const id = randomUUID();
  await client.query(
    `INSERT INTO "Tenant" (id, name, slug, status, "ownerId", "updatedAt") VALUES ($1, $2, $3, 'ACTIVE', $4, now())`,
    [id, `Tenant ${id.slice(0, 6)}`, `tenant-${id.slice(0, 8)}`, ownerId],
  );
  return id;
};

export const insertArticle = async (
  client: PoolClient | Pool,
  tenantId: string,
  authorId: string,
  overrides: { accessType?: string; price?: string | null } = {},
) => {
  const id = randomUUID();
  await client.query(
    `INSERT INTO "Article" (id, "tenantId", "authorId", title, slug, "accessType", price, status, "updatedAt")
     VALUES ($1, $2, $3, 'Title', $4, $5::"ProductAccessType", $6, 'DRAFT', now())`,
    [id, tenantId, authorId, `slug-${id.slice(0, 8)}`, overrides.accessType ?? 'FREE', overrides.price ?? null],
  );
  return id;
};

export const insertOrder = async (client: PoolClient | Pool, userId: string) => {
  const id = randomUUID();
  await client.query(
    `INSERT INTO "Order" (id, "userId", amount, currency, status, "expiredAt", "updatedAt")
     VALUES ($1, $2, 100, 'IDR', 'PENDING', now() + interval '1 hour', now())`,
    [id, userId],
  );
  return id;
};

export const insertWallet = async (
  client: PoolClient | Pool,
  ownerId: string,
  tenantId: string,
  balance = '100.00',
  currency = 'IDR',
) => {
  const id = randomUUID();
  await client.query(
    `INSERT INTO "Wallet" (id, "ownerId", "tenantId", currency, "updatedAt") VALUES ($1, $2, $3, $4, now())`,
    [id, ownerId, tenantId, currency],
  );
  if (Number(balance) > 0) {
    await insertLedger(client, {
      category: 'ADJUSTMENT',
      direction: 'CREDIT',
      amount: balance,
      walletId: id,
      currency,
    });
  }
  return id;
};

export interface LedgerFixture {
  category: string;
  direction: string;
  amount: string | number;
  currency?: string;
  walletId?: string | null;
  orderId?: string | null;
  payoutId?: string | null;
  refundId?: string | null;
  earningId?: string | null;
  reversalOfId?: string | null;
  key?: string;
}

export const insertLedger = async (client: PoolClient | Pool, entry: LedgerFixture) => {
  const id = randomUUID();
  await client.query(
    `INSERT INTO "LedgerTransaction" (id, category, direction, amount, currency, "walletId", "orderId", "payoutId", "refundId", "earningId", "reversalOfId", "idempotencyKey")
     VALUES ($1, $2::"LedgerCategory", $3::"LedgerDirection", $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      id,
      entry.category,
      entry.direction,
      entry.amount,
      entry.currency ?? 'IDR',
      entry.walletId ?? null,
      entry.orderId ?? null,
      entry.payoutId ?? null,
      entry.refundId ?? null,
      entry.earningId ?? null,
      entry.reversalOfId ?? null,
      entry.key ?? `fixture-${id}`,
    ],
  );
  return id;
};

export const walletBalance = async (client: PoolClient | Pool, walletId: string) =>
  (await client.query(`SELECT balance::text AS balance FROM "Wallet" WHERE id = $1`, [walletId])).rows[0].balance as string;

export const ledgerSum = async (client: PoolClient | Pool, walletId: string) =>
  (
    await client.query(
      `SELECT COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN amount ELSE -amount END), 0)::text AS total FROM "LedgerTransaction" WHERE "walletId" = $1`,
      [walletId],
    )
  ).rows[0].total as string;

export const insertOrderItem = async (
  client: PoolClient | Pool,
  orderId: string,
  item: { tenantId: string; articleId: string; price: string; fee?: string },
) => {
  const id = randomUUID();
  await client.query(
    `INSERT INTO "OrderItem" (id, "orderId", "tenantId", "articleId", quantity, "unitPrice", "totalPrice", "platformFee") VALUES ($1, $2, $3, $4, 1, $5, $5, $6)`,
    [id, orderId, item.tenantId, item.articleId, item.price, item.fee ?? '0'],
  );
  return id;
};

export const insertEarning = async (
  client: PoolClient | Pool,
  e: { tenantId: string; creatorId: string; orderId: string; orderItemId: string; gross: string; fee: string; creator: string; status?: string },
) => {
  const id = randomUUID();
  await client.query(
    `INSERT INTO "CreatorEarning" (id, "tenantId", "creatorId", "orderId", "orderItemId", "grossAmount", "platformFee", "creatorAmount", status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::"EarningStatus")`,
    [id, e.tenantId, e.creatorId, e.orderId, e.orderItemId, e.gross, e.fee, e.creator, e.status ?? 'PENDING'],
  );
  return id;
};

export const insertPayout = async (
  client: PoolClient | Pool,
  p: { creatorId: string; tenantId: string; walletId: string; amount: string; status?: string },
) => {
  const id = randomUUID();
  await client.query(
    `INSERT INTO "PayoutRequest" (id, "creatorId", "tenantId", "walletId", amount, "destinationInfo", status)
     VALUES ($1, $2, $3, $4, $5, '{"bank":"BCA","accountNumber":"123","accountName":"Creator"}'::jsonb, $6::"PayoutStatus")`,
    [id, p.creatorId, p.tenantId, p.walletId, p.amount, p.status ?? 'REQUESTED'],
  );
  return id;
};

export const insertIntent = async (client: PoolClient | Pool, orderId: string, status = 'PENDING') => {
  const id = randomUUID();
  const paid = ['PAID', 'REFUND_PENDING', 'REFUNDED'].includes(status);
  await client.query(
    `INSERT INTO "PaymentIntent" (id, "orderId", provider, amount, currency, status, "expiresAt", "paidAt", "updatedAt")
     VALUES ($1, $2, 'MANUAL', 100, 'IDR', $3::"PaymentIntentStatus", now() + interval '1 day', $4, now())`,
    [id, orderId, status, paid ? new Date() : null],
  );
  return id;
};

export const insertPayment = async (client: PoolClient | Pool, orderId: string, payerId: string, status: string) => {
  const live = await client.query(
    `SELECT id FROM "PaymentIntent" WHERE "orderId" = $1 AND status IN ('CREATED', 'PENDING', 'SUBMITTED', 'PROCESSING', 'PAID', 'REFUND_PENDING') LIMIT 1`,
    [orderId],
  );
  const intentId = live.rows[0]?.id ?? (await insertIntent(client, orderId));
  return client.query(
    `INSERT INTO "ManualPaymentSubmission" (id, "orderId", "paymentIntentId", "payerId", "paymentMethod", amount, "proofUrl", status)
     VALUES (gen_random_uuid(), $1, $2, $3, 'BANK_TRANSFER', 100, '{"url":"https://example.test/proof.png"}'::jsonb, $4::"ManualPaymentStatus")`,
    [orderId, intentId, payerId, status],
  );
};

export const insertTopic = async (client: PoolClient | Pool, price: number) => {
  const id = randomUUID();
  await client.query(
    `INSERT INTO "Topic" (id, title, slug, image, price, "updatedAt") VALUES ($1, $2, $3, '{"url":"https://example.test/t.png"}'::jsonb, $4, now())`,
    [id, `Topic ${id.slice(0, 6)}`, `topic-${id.slice(0, 8)}`, price],
  );
  return id;
};

export const insertPublishedArticle = async (
  client: PoolClient | Pool,
  tenantId: string,
  authorId: string,
  price: string | null,
) => {
  const id = randomUUID();
  await client.query(
    `INSERT INTO "Article" (id, "tenantId", "authorId", title, slug, "accessType", price, status, "updatedAt")
     VALUES ($1, $2, $3, 'Paid article', $4, $5::"ProductAccessType", $6, 'DRAFT', now())`,
    [id, tenantId, authorId, `slug-${id.slice(0, 8)}`, price ? 'PAID' : 'FREE', price],
  );
  const versionId = randomUUID();
  await client.query(
    `INSERT INTO "ArticleVersion" (id, "articleId", "versionNumber", title, content, "createdById", "publishedAt")
     VALUES ($1, $2, 1, 'Paid article', 'Body of the article', $3, now())`,
    [versionId, id, authorId],
  );
  await client.query(
    `UPDATE "Article" SET status = 'PUBLISHED', "publishedVersionId" = $2, "publishedAt" = now() WHERE id = $1`,
    [id, versionId],
  );
  return id;
};

export const insertPublishedClass = async (
  client: PoolClient | Pool,
  tenantId: string,
  instructorId: string,
  price: string,
) => {
  const id = randomUUID();
  await client.query(
    `INSERT INTO "ClassProduct" (id, "tenantId", "instructorId", title, slug, "accessType", price, status, "publishedAt", "updatedAt")
     VALUES ($1, $2, $3, 'Paid class', $4, 'PAID', $5, 'PUBLISHED', now(), now())`,
    [id, tenantId, instructorId, `class-${id.slice(0, 8)}`, price],
  );
  return id;
};

export const insertMembership = async (
  client: PoolClient | Pool,
  tenantId: string,
  userId: string,
  role: 'OWNER' | 'MANAGER' | 'TEACHER' | 'EDITOR',
  status = 'ACTIVE',
) => {
  await client.query(
    `INSERT INTO "TenantMembership" (id, "tenantId", "userId", role, status, "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3::"TenantRole", $4::"MembershipStatus", now())`,
    [tenantId, userId, role, status],
  );
};
