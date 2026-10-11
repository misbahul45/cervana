import { Pool } from 'pg';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { createPool, databaseUrl, describeDb, insertUser } from '@/test-utils/pg-fixtures';
import { AuditLogsService } from '../audit-logs.service';

describeDb('audit logs on a real database (requires TEST_DATABASE_URL)', () => {
  let pool: Pool;
  let prisma: PrismaService;
  let service: AuditLogsService;
  const marker = `AUDIT_TEST_${Date.now()}`;

  const insertLog = async (values: { actorId?: string | null; action?: string; entityType?: string; entityId?: string; at?: string; before?: unknown; after?: unknown; reason?: string }) => {
    const result = await pool.query(
      `INSERT INTO "AuditLog" (id, "actorId", action, "entityType", "entityId", before, after, reason, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, now())) RETURNING id`,
      [
        values.actorId ?? null,
        values.action ?? `${marker}_A`,
        values.entityType ?? 'Thing',
        values.entityId ?? 'thing-1',
        values.before === undefined ? null : JSON.stringify(values.before),
        values.after === undefined ? null : JSON.stringify(values.after),
        values.reason ?? null,
        values.at ?? null,
      ],
    );
    return result.rows[0].id as string;
  };

  beforeAll(() => {
    process.env.DATABASE_URL = databaseUrl;
    pool = createPool();
    prisma = new PrismaService();
    service = new AuditLogsService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  const base = { page: 1, limit: 25 };

  it('lists newest first, filtered by action, with the actor resolved and no payload', async () => {
    const actor = await insertUser(pool, 'ADMIN');
    const older = await insertLog({ actorId: actor, action: `${marker}_LIST`, at: '2026-10-01T00:00:00Z', before: { secret: 'x' } });
    const newer = await insertLog({ actorId: actor, action: `${marker}_LIST`, at: '2026-10-02T00:00:00Z', reason: 'alasan' });
    await insertLog({ action: `${marker}_OTHER` });

    const result = (await service.list({ ...base, action: `${marker}_LIST` })).data;

    expect(result.data.map((row) => row.id)).toEqual([newer, older]);
    expect(result.data[0]).toMatchObject({ actor: { id: actor, role: 'ADMIN' }, reason: 'alasan' });
    expect(result.data[0]).not.toHaveProperty('before');
    expect(result.data[0]).not.toHaveProperty('after');
    expect(result.pagination).toMatchObject({ total: 2, page: 1, totalPages: 1 });
  });

  it('keeps entries without a known actor and resolves them to null', async () => {
    const id = await insertLog({ action: `${marker}_SYSTEM`, actorId: null });
    const row = (await service.list({ ...base, action: `${marker}_SYSTEM` })).data.data[0];
    expect(row).toMatchObject({ id, actor: null });
  });

  it('filters by entity, actor and a date range, and paginates', async () => {
    const actor = await insertUser(pool, 'ADMIN');
    for (let day = 1; day <= 5; day += 1) {
      await insertLog({ actorId: actor, action: `${marker}_RANGE`, entityType: 'Order', entityId: `o-${day}`, at: `2026-09-0${day}T12:00:00Z` });
    }

    const window = await service.list({ ...base, action: `${marker}_RANGE`, from: new Date('2026-09-02T00:00:00Z'), to: new Date('2026-09-04T23:59:59Z') });
    expect(window.data.data.map((row) => row.entityId)).toEqual(['o-4', 'o-3', 'o-2']);

    const byEntity = await service.list({ ...base, action: `${marker}_RANGE`, entityType: 'Order', entityId: 'o-3' });
    expect(byEntity.data.data).toHaveLength(1);

    const byActor = await service.list({ page: 2, limit: 2, action: `${marker}_RANGE`, actorId: actor });
    expect(byActor.data.pagination).toMatchObject({ total: 5, totalPages: 3 });
    expect(byActor.data.data.map((row) => row.entityId)).toEqual(['o-3', 'o-2']);
  });

  it('returns the payload only from the detail', async () => {
    const id = await insertLog({ action: `${marker}_DETAIL`, before: { role: 'STUDENT' }, after: { role: 'TEACHER' }, reason: 'disetujui' });

    const detail = (await service.findOne(id)).data;

    expect(detail).toMatchObject({ id, before: { role: 'STUDENT' }, after: { role: 'TEACHER' }, reason: 'disetujui' });
    await expect(service.findOne('00000000-0000-4000-8000-000000000000')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('lists the distinct action names for the filter', async () => {
    await insertLog({ action: `${marker}_ACT_Z` });
    await insertLog({ action: `${marker}_ACT_Z` });
    await insertLog({ action: `${marker}_ACT_Y` });

    const names = (await service.actions()).data.filter((name) => name.startsWith(`${marker}_ACT_`));

    expect(names).toEqual([`${marker}_ACT_Y`, `${marker}_ACT_Z`]);
  });
});
