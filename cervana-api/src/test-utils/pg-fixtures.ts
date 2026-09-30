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

export const insertWallet = async (client: PoolClient | Pool, ownerId: string, tenantId: string, balance = '100.00') => {
  const id = randomUUID();
  await client.query(
    `INSERT INTO "Wallet" (id, "ownerId", "tenantId", balance, currency, "updatedAt") VALUES ($1, $2, $3, $4, 'IDR', now())`,
    [id, ownerId, tenantId, balance],
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
    `INSERT INTO "Article" (id, "tenantId", "authorId", title, slug, "accessType", price, status, "publishedAt", "updatedAt")
     VALUES ($1, $2, $3, 'Paid article', $4, $5::"ProductAccessType", $6, 'PUBLISHED', now(), now())`,
    [id, tenantId, authorId, `slug-${id.slice(0, 8)}`, price ? 'PAID' : 'FREE', price],
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
