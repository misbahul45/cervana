import { Pool } from 'pg';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { TopicEntitlementBackfillService } from '../topic-entitlement-backfill.service';

const url = process.env.TEST_LEGACY_DATABASE_URL;
const describeLegacy: typeof describe = (url ? describe : describe.skip) as typeof describe;

describeLegacy('topic entitlement backfill on legacy data (requires TEST_LEGACY_DATABASE_URL)', () => {
  let pool: Pool;
  let prisma: PrismaService;
  let service: TopicEntitlementBackfillService;

  const entitlements = async () => {
    const { rows } = await pool.query(
      `SELECT "userId", "topicId", "orderId", status::text AS status, "expiresAt" FROM "Entitlement" WHERE "resourceType" = 'TOPIC' ORDER BY "userId", "topicId"`,
    );
    return rows;
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    pool = new Pool({ connectionString: url });
    prisma = new PrismaService();
    service = new TopicEntitlementBackfillService(prisma);
  });

  beforeEach(async () => {
    await pool.query(`DELETE FROM "Entitlement"`);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  it('creates one entitlement per purchased topic and applies the documented policy', async () => {
    const result = await service.run();
    expect(result).toEqual({ candidates: 4, inserted: 4, skipped: 0, withoutPaidOrder: 1 });

    const rows = await entitlements();
    const byKey = Object.fromEntries(rows.map((r) => [`${r.userId}/${r.topicId}`, r]));
    expect(Object.keys(byKey).sort()).toEqual(['u-s1/t-paidA', 'u-s1/t-paidB', 'u-s2/t-paidA', 'u-s3/t-paidB']);

    expect(byKey['u-s1/t-paidA']).toMatchObject({ orderId: 'o1', status: 'ACTIVE' });
    expect(byKey['u-s1/t-paidA'].expiresAt).not.toBeNull();
    expect(byKey['u-s2/t-paidA']).toMatchObject({ orderId: 'o2', status: 'EXPIRED' });
    expect(byKey['u-s1/t-paidB']).toMatchObject({ orderId: 'o6', status: 'ACTIVE', expiresAt: null });
    expect(byKey['u-s3/t-paidB']).toMatchObject({ orderId: null, status: 'ACTIVE' });
  });

  it('grants nothing for pending or failed orders and free topics', async () => {
    await service.run();
    const keys = (await entitlements()).map((r) => `${r.userId}/${r.topicId}`);
    expect(keys).not.toContain('u-s3/t-paidA');
    expect(keys).not.toContain('u-s2/t-paidB');
    expect(keys.some((k) => k.endsWith('/t-free'))).toBe(false);
  });

  it('is repeat-safe: running again changes nothing', async () => {
    await service.run();
    const first = await entitlements();
    const second = await service.run();
    expect(second).toEqual({ candidates: 4, inserted: 0, skipped: 4, withoutPaidOrder: 1 });
    expect(await entitlements()).toEqual(first);
  });

  it('is safe under concurrent runs', async () => {
    const results = await Promise.all([service.run(), service.run(), service.run()]);
    expect(results.reduce((sum, r) => sum + r.inserted, 0)).toBe(4);
    expect(await entitlements()).toHaveLength(4);
  });

  it('never modifies or removes the legacy purchase records', async () => {
    const snapshot = async () =>
      (await pool.query(`SELECT id, "accessType"::text, "expiredAt", status::text FROM "UserTopic" ORDER BY id`)).rows;
    const orders = async () => (await pool.query(`SELECT id, status::text FROM "Order" ORDER BY id`)).rows;
    const [userTopicsBefore, ordersBefore] = [await snapshot(), await orders()];
    await service.run();
    expect(await snapshot()).toEqual(userTopicsBefore);
    expect(await orders()).toEqual(ordersBefore);
  });
});
