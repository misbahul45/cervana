import { Role, TenantRole } from '@prisma/client';
import { Pool } from 'pg';
import { TenantContext } from '@/common/tenancy/tenant-context';
import { createPool, databaseUrl, describeDb, insertMembership, insertTenant, insertUser } from '@/test-utils/pg-fixtures';
import { buildCommerceStack, CommerceStack } from '@/test-utils/commerce-harness';

const proofFor = (userId: string) => ({
  url: `https://res.cloudinary.com/demo/image/upload/images/${userId}-proof.png`,
  fileId: `images/${userId}-proof`,
});

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describeDb('classes on a real database (requires TEST_DATABASE_URL)', () => {
  let pool: Pool;
  let s: CommerceStack;

  const teacher = (id: string) => ({ id, role: Role.TEACHER });
  const admin = (id: string) => ({ id, role: Role.ADMIN });
  const student = (id: string) => ({ id, role: Role.STUDENT });
  const ctx = (userId: string, tenantId: string, tenantRole: TenantRole): TenantContext => ({ userId, tenantId, tenantRole, isPlatformAdmin: false });

  const one = async (sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows[0];
  const count = async (sql: string, params: unknown[] = []) => Number((await one(sql, params)).count);

  const tenantWith = async () => {
    const owner = await insertUser(pool, 'TEACHER');
    const instructor = await insertUser(pool, 'TEACHER');
    const tenant = await insertTenant(pool, owner);
    await insertMembership(pool, tenant, owner, 'OWNER');
    await insertMembership(pool, tenant, instructor, 'TEACHER');
    const reviewer = await insertUser(pool, 'ADMIN');
    return {
      owner,
      instructor,
      tenant,
      reviewer,
      ownerCtx: ctx(owner, tenant, TenantRole.OWNER),
      teacherCtx: ctx(instructor, tenant, TenantRole.TEACHER),
    };
  };
  type World = Awaited<ReturnType<typeof tenantWith>>;

  const soon = () => new Date(Date.now() + 2 * DAY);
  const session = (offsetDays = 2, links: { meetingUrl?: string; recordingUrl?: string } = { meetingUrl: 'https://meet.example.test/room' }) => ({
    startsAt: new Date(Date.now() + offsetDays * DAY),
    endsAt: new Date(Date.now() + offsetDays * DAY + HOUR),
    ...links,
  });

  const draft = (w: World, overrides: Record<string, unknown> = {}) =>
    s.classAuthoring.create(teacher(w.instructor), w.teacherCtx, { title: 'Kelas laporan keuangan', accessType: 'FREE', format: 'LIVE', difficulty: 'BEGINNER', ...overrides } as never, 't');

  const publish = async (w: World, overrides: Record<string, unknown> = {}, sessions: Array<ReturnType<typeof session>> = [session()]) => {
    const created = (await draft(w, overrides)).data;
    for (const item of sessions) await s.classAuthoring.addSession(teacher(w.instructor), w.teacherCtx, created.id, item as never, 't');
    await s.classAuthoring.submitReview(teacher(w.instructor), w.teacherCtx, created.id, 't');
    await s.classModeration.approve(admin(w.reviewer), created.id, 'ok', 't');
    return created;
  };

  beforeAll(() => {
    process.env.DATABASE_URL = databaseUrl;
    pool = createPool();
    s = buildCommerceStack();
  });

  afterAll(async () => {
    await s.prisma.$disconnect();
    await pool.end();
  });

  describe('authoring', () => {
    it('creates a draft, enforces pricing rules and keeps peers and other tenants out', async () => {
      const w = await tenantWith();
      const created = (await draft(w, { capacity: 20 })).data;
      expect(created).toMatchObject({ status: 'DRAFT', slug: 'kelas-laporan-keuangan', capacity: 20, instructorId: w.instructor });
      expect((await draft(w)).data.slug).toBe('kelas-laporan-keuangan-2');

      await expect(draft(w, { accessType: 'PAID' })).rejects.toMatchObject({ statusCode: 422 });
      await expect(draft(w, { accessType: 'FREE', price: 5000 })).rejects.toMatchObject({ statusCode: 422 });

      const peer = await insertUser(pool, 'TEACHER');
      await insertMembership(pool, w.tenant, peer, 'TEACHER');
      const peerCtx = ctx(peer, w.tenant, TenantRole.TEACHER);
      await expect(s.classAuthoring.update(teacher(peer), peerCtx, created.id, { title: 'Hijack' }, 't')).rejects.toMatchObject({ statusCode: 403 });
      await expect(s.classAuthoring.addSession(teacher(peer), peerCtx, created.id, session() as never, 't')).rejects.toMatchObject({ statusCode: 403 });
      await expect(s.classAuthoring.findOne(teacher(peer), peerCtx, created.id)).rejects.toMatchObject({ statusCode: 404 });
      await expect(s.classAuthoring.update(teacher(w.owner), w.ownerCtx, created.id, { title: 'Owner edit' }, 't')).resolves.toBeDefined();

      const stranger = await tenantWith();
      await expect(s.classAuthoring.findOne(teacher(stranger.owner), stranger.ownerCtx, created.id)).rejects.toMatchObject({ statusCode: 404 });
      await expect(s.classAuthoring.addSession(teacher(stranger.owner), stranger.ownerCtx, created.id, session() as never, 't')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('manages sessions: validates times, updates, cancels once, and locks while under review', async () => {
      const w = await tenantWith();
      const created = (await draft(w)).data;
      const added = (await s.classAuthoring.addSession(teacher(w.instructor), w.teacherCtx, created.id, session() as never, 't')).data;

      await expect(
        s.classAuthoring.updateSession(teacher(w.instructor), w.teacherCtx, created.id, added.id, { endsAt: new Date(added.startsAt.getTime() - HOUR) }, 't'),
      ).rejects.toMatchObject({ statusCode: 422 });
      const moved = await s.classAuthoring.updateSession(teacher(w.instructor), w.teacherCtx, created.id, added.id, { meetingUrl: 'https://meet.example.test/new' }, 't');
      expect(moved.data.meetingUrl).toBe('https://meet.example.test/new');

      const first = await s.classAuthoring.cancelSession(teacher(w.instructor), w.teacherCtx, created.id, added.id, 't');
      const second = await s.classAuthoring.cancelSession(teacher(w.instructor), w.teacherCtx, created.id, added.id, 't');
      expect(first.message).toBe('Session cancelled');
      expect(second.message).toBe('Session already cancelled');
      await expect(s.classAuthoring.updateSession(teacher(w.instructor), w.teacherCtx, created.id, added.id, { meetingUrl: 'https://x.test/y' }, 't')).rejects.toMatchObject({ code: 'CONTENT_LOCKED' });

      await s.classAuthoring.addSession(teacher(w.instructor), w.teacherCtx, created.id, session() as never, 't');
      await s.classAuthoring.submitReview(teacher(w.instructor), w.teacherCtx, created.id, 't');
      await expect(s.classAuthoring.addSession(teacher(w.instructor), w.teacherCtx, created.id, session() as never, 't')).rejects.toMatchObject({ code: 'CONTENT_LOCKED' });
      await expect(s.classAuthoring.update(teacher(w.instructor), w.teacherCtx, created.id, { title: 'Sneaky' }, 't')).rejects.toMatchObject({ code: 'CONTENT_LOCKED' });
    });

    it('requires sessions and the links its format needs before review', async () => {
      const w = await tenantWith();
      const submit = (id: string) => s.classAuthoring.submitReview(teacher(w.instructor), w.teacherCtx, id, 't');
      const add = (id: string, links: { meetingUrl?: string; recordingUrl?: string }) =>
        s.classAuthoring.addSession(teacher(w.instructor), w.teacherCtx, id, session(2, links) as never, 't');

      const live = (await draft(w, { format: 'LIVE' })).data;
      await expect(submit(live.id)).rejects.toMatchObject({ statusCode: 422 });
      await add(live.id, { recordingUrl: 'https://rec.example.test/a' });
      await expect(submit(live.id)).rejects.toMatchObject({ statusCode: 422 });
      await add(live.id, { meetingUrl: 'https://meet.example.test/a' });
      await expect(submit(live.id)).resolves.toBeDefined();

      const recorded = (await draft(w, { format: 'RECORDED' })).data;
      await add(recorded.id, { meetingUrl: 'https://meet.example.test/a' });
      await expect(submit(recorded.id)).rejects.toMatchObject({ statusCode: 422 });
      await add(recorded.id, { recordingUrl: 'https://rec.example.test/a' });
      await expect(submit(recorded.id)).resolves.toBeDefined();

      const hybrid = (await draft(w, { format: 'HYBRID' })).data;
      await add(hybrid.id, { meetingUrl: 'https://meet.example.test/a' });
      await expect(submit(hybrid.id)).rejects.toMatchObject({ statusCode: 422 });
      await add(hybrid.id, { recordingUrl: 'https://rec.example.test/a' });
      await expect(submit(hybrid.id)).resolves.toBeDefined();
    });
  });

  describe('review and publication', () => {
    it('publishes once, emits one event, and still allows schedule changes afterwards', async () => {
      const w = await tenantWith();
      const created = (await draft(w)).data;
      await s.classAuthoring.addSession(teacher(w.instructor), w.teacherCtx, created.id, session() as never, 't');
      await s.classAuthoring.submitReview(teacher(w.instructor), w.teacherCtx, created.id, 't');

      await expect(s.classModeration.approve(teacher(w.instructor), created.id, undefined, 't')).rejects.toMatchObject({ status: 403 });
      const results = await Promise.allSettled(Array.from({ length: 4 }, () => s.classModeration.approve(admin(w.reviewer), created.id, 'ok', 't')));
      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
      expect(results.filter((r) => r.status === 'fulfilled' && (r.value.data as { changed: boolean }).changed)).toHaveLength(1);
      expect(await count(`SELECT count(*) FROM "DomainEvent" WHERE type = 'ClassPublished' AND "aggregateId" = $1`, [created.id])).toBe(1);

      const list = await s.classAuthoring.findOne(teacher(w.instructor), w.teacherCtx, created.id);
      const extra = await s.classAuthoring.addSession(teacher(w.instructor), w.teacherCtx, created.id, session(9) as never, 't');
      expect(extra.data.status).toBe('SCHEDULED');
      await expect(s.classAuthoring.update(teacher(w.instructor), w.teacherCtx, created.id, { title: 'Rename after publish' }, 't')).rejects.toMatchObject({ code: 'CONTENT_LOCKED' });
      expect(list.data.status).toBe('PUBLISHED');
    });

    it('refuses to publish for an inactive tenant or when the sessions were all cancelled', async () => {
      const w = await tenantWith();
      const created = (await draft(w)).data;
      const added = (await s.classAuthoring.addSession(teacher(w.instructor), w.teacherCtx, created.id, session() as never, 't')).data;
      await s.classAuthoring.submitReview(teacher(w.instructor), w.teacherCtx, created.id, 't');

      await pool.query(`UPDATE "Tenant" SET status = 'SUSPENDED' WHERE id = $1`, [w.tenant]);
      await expect(s.classModeration.approve(admin(w.reviewer), created.id, undefined, 't')).rejects.toMatchObject({ statusCode: 409 });
      await pool.query(`UPDATE "Tenant" SET status = 'ACTIVE' WHERE id = $1`, [w.tenant]);

      await pool.query(`UPDATE "ClassSession" SET status = 'CANCELLED' WHERE id = $1`, [added.id]);
      await expect(s.classModeration.approve(admin(w.reviewer), created.id, undefined, 't')).rejects.toMatchObject({ statusCode: 422 });
    });

    it('rejects with a reason the instructor can read, then accepts a corrected resubmission', async () => {
      const w = await tenantWith();
      const created = (await draft(w)).data;
      await s.classAuthoring.addSession(teacher(w.instructor), w.teacherCtx, created.id, session() as never, 't');
      await s.classAuthoring.submitReview(teacher(w.instructor), w.teacherCtx, created.id, 't');
      await s.classModeration.reject(admin(w.reviewer), created.id, 'Description is missing', 't');
      expect((await s.classAuthoring.findOne(teacher(w.instructor), w.teacherCtx, created.id)).data).toMatchObject({ status: 'REJECTED', reviewNote: 'Description is missing' });
      await s.classAuthoring.update(teacher(w.instructor), w.teacherCtx, created.id, { description: 'Now with a description' }, 't');
      await s.classAuthoring.submitReview(teacher(w.instructor), w.teacherCtx, created.id, 't');
      await s.classModeration.approve(admin(w.reviewer), created.id, undefined, 't');
      expect((await one(`SELECT status::text FROM "ClassProduct" WHERE id = $1`, [created.id])).status).toBe('PUBLISHED');
    });
  });

  describe('marketplace', () => {
    it('lists only published classes, reports seats left and never leaks meeting links', async () => {
      const w = await tenantWith();
      const open = await publish(w, { title: 'Kelas terbuka', capacity: 3 });
      await draft(w, { title: 'Kelas draft' });
      const listing = await s.marketplaceClasses.list({ page: 1, limit: 50, sort: 'newest', tenantId: w.tenant });
      expect(listing.data.data.map((c) => c.id)).toEqual([open.id]);
      expect(listing.data.data[0]).toMatchObject({ seatsLeft: 3, capacity: 3 });

      const detail = await s.marketplaceClasses.findOne(open.id);
      const serialized = JSON.stringify(detail.data);
      expect(serialized).not.toContain('meet.example.test');
      expect(serialized).not.toContain('reviewNote');
      expect(serialized).not.toContain('email');
      expect(detail.data.sessions).toHaveLength(1);

      await pool.query(`UPDATE "Tenant" SET status = 'SUSPENDED' WHERE id = $1`, [w.tenant]);
      await expect(s.marketplaceClasses.findOne(open.id)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('shows private material only to enrolled learners', async () => {
      const w = await tenantWith();
      const cls = await publish(w, { title: 'Kelas gratis' });
      const learner = await insertUser(pool);
      const other = await insertUser(pool);

      expect((await s.marketplaceClasses.access(student(learner), cls.id)).data).toMatchObject({ accessible: false, reason: 'ENTITLEMENT_REQUIRED' });
      await expect(s.marketplaceClasses.materials(student(learner), cls.id)).rejects.toMatchObject({ statusCode: 403, code: 'ENTITLEMENT_REQUIRED' });

      await s.classEnrollments.enrollFree(student(learner), cls.id, 't');
      expect((await s.marketplaceClasses.access(student(learner), cls.id)).data).toMatchObject({ accessible: true, reason: 'ENROLLED' });
      const materials = await s.marketplaceClasses.materials(student(learner), cls.id);
      expect(materials.data.sessions[0].meetingUrl).toBe('https://meet.example.test/room');
      await expect(s.marketplaceClasses.materials(student(other), cls.id)).rejects.toMatchObject({ code: 'ENTITLEMENT_REQUIRED' });
    });
  });

  describe('free enrollment and capacity', () => {
    it('enrols once, grants the entitlement, and lets the learner leave and return', async () => {
      const w = await tenantWith();
      const cls = await publish(w, { capacity: 1 });
      const a = await insertUser(pool);
      const b = await insertUser(pool);

      const first = await s.classEnrollments.enrollFree(student(a), cls.id, 't');
      const again = await s.classEnrollments.enrollFree(student(a), cls.id, 't');
      expect(first.data.created).toBe(true);
      expect(again.data.created).toBe(false);
      expect(await count(`SELECT count(*) FROM "Entitlement" WHERE "userId" = $1 AND "classId" = $2 AND status = 'ACTIVE'`, [a, cls.id])).toBe(1);
      await expect(s.classEnrollments.enrollFree(student(b), cls.id, 't')).rejects.toMatchObject({ statusCode: 409, code: 'CLASS_FULL' });

      await s.classEnrollments.cancelFree(student(a), cls.id, 't');
      expect((await s.classEnrollments.cancelFree(student(a), cls.id, 't')).message).toMatch(/already/);
      expect((await one(`SELECT status::text FROM "Entitlement" WHERE "userId" = $1 AND "classId" = $2`, [a, cls.id])).status).toBe('REVOKED');
      await expect(s.marketplaceClasses.materials(student(a), cls.id)).rejects.toMatchObject({ code: 'ENTITLEMENT_REQUIRED' });

      await expect(s.classEnrollments.enrollFree(student(b), cls.id, 't')).resolves.toBeDefined();
      await expect(s.classEnrollments.enrollFree(student(a), cls.id, 't')).rejects.toMatchObject({ code: 'CLASS_FULL' });
    });

    it('never lets more learners in than the capacity, however many ask at once', async () => {
      const w = await tenantWith();
      const cls = await publish(w, { capacity: 3 });
      const learners = await Promise.all(Array.from({ length: 8 }, () => insertUser(pool)));

      const outcomes = await Promise.allSettled(learners.map((id) => s.classEnrollments.enrollFree(student(id), cls.id, 't')));
      const admitted = outcomes.filter((o) => o.status === 'fulfilled');
      const refused = outcomes.filter((o): o is PromiseRejectedResult => o.status === 'rejected');
      expect(admitted).toHaveLength(3);
      expect(refused).toHaveLength(5);
      expect(refused.every((o) => o.reason?.code === 'CLASS_FULL')).toBe(true);
      expect(await count(`SELECT count(*) FROM "ClassEnrollment" WHERE "classProductId" = $1 AND status = 'ACTIVE'`, [cls.id])).toBe(3);
      expect(await count(`SELECT count(*) FROM "Entitlement" WHERE "classId" = $1 AND status = 'ACTIVE'`, [cls.id])).toBe(3);
      expect((await s.marketplaceClasses.findOne(cls.id)).data.seatsLeft).toBe(0);
    });

    it('is guarded by the database too, not just the service', async () => {
      const w = await tenantWith();
      const cls = await publish(w, { capacity: 1 });
      const [a, b] = await Promise.all([insertUser(pool), insertUser(pool)]);
      await pool.query(`INSERT INTO "ClassEnrollment" (id, "classProductId", "userId", status) VALUES (gen_random_uuid(), $1, $2, 'ACTIVE')`, [cls.id, a]);
      await expect(
        pool.query(`INSERT INTO "ClassEnrollment" (id, "classProductId", "userId", status) VALUES (gen_random_uuid(), $1, $2, 'ACTIVE')`, [cls.id, b]),
      ).rejects.toThrow(/class is full/);
      await expect(pool.query(`UPDATE "ClassProduct" SET capacity = 1 WHERE id = $1`, [cls.id])).resolves.toBeDefined();
      const bigger = await publish(w, { capacity: 5 });
      const learners = await Promise.all(Array.from({ length: 3 }, () => insertUser(pool)));
      for (const id of learners) await s.classEnrollments.enrollFree(student(id), bigger.id, 't');
      await expect(pool.query(`UPDATE "ClassProduct" SET capacity = 2 WHERE id = $1`, [bigger.id])).rejects.toThrow(/capacity cannot be lower/);
    });

    it('does not take a paid class through the free door', async () => {
      const w = await tenantWith();
      const paid = await publish(w, { accessType: 'PAID', price: 100000 });
      const learner = await insertUser(pool);
      await expect(s.classEnrollments.enrollFree(student(learner), paid.id, 't')).rejects.toMatchObject({ statusCode: 422 });
      expect(await count(`SELECT count(*) FROM "ClassEnrollment" WHERE "classProductId" = $1`, [paid.id])).toBe(0);
      const draftClass = (await draft(w)).data;
      await expect(s.classEnrollments.enrollFree(student(learner), draftClass.id, 't')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('buying a paid class', () => {
    const buy = async (w: World, classId: string, buyer: string) => {
      const order = (await s.orders.create(student(buyer), { items: [{ type: 'CLASS', id: classId }] }, 't')).data;
      const submitted = await s.manual.submit(student(buyer), order.payment!.id, { paymentMethod: 'BANK_TRANSFER', proof: proofFor(buyer) }, 't');
      return { order, submissionId: submitted.data.submission.id };
    };

    it('enrols the buyer, grants access and pays the instructor when the payment is approved', async () => {
      const w = await tenantWith();
      const paid = await publish(w, { title: 'Kelas premium', accessType: 'PAID', price: 200000, capacity: 5 });
      const buyer = await insertUser(pool);
      const { submissionId } = await buy(w, paid.id, buyer);
      await s.manual.approve(admin(w.reviewer), submissionId, 'verified', 't');

      const enrollment = await one(`SELECT status::text, "orderId" FROM "ClassEnrollment" WHERE "classProductId" = $1 AND "userId" = $2`, [paid.id, buyer]);
      expect(enrollment.status).toBe('ACTIVE');
      expect(enrollment.orderId).not.toBeNull();
      expect((await s.marketplaceClasses.access(student(buyer), paid.id)).data).toMatchObject({ accessible: true, reason: 'PURCHASED' });
      expect((await s.marketplaceClasses.materials(student(buyer), paid.id)).data.sessions).toHaveLength(1);
      expect((await one(`SELECT balance::text AS b FROM "Wallet" WHERE "ownerId" = $1 AND "tenantId" = $2`, [w.instructor, w.tenant])).b).toBe('180000.00');
      await expect(s.classEnrollments.cancelFree(student(buyer), paid.id, 't')).rejects.toMatchObject({ statusCode: 409 });
    });

    it('holds seats for pending orders and refuses the order that would oversell', async () => {
      const w = await tenantWith();
      const paid = await publish(w, { accessType: 'PAID', price: 100000, capacity: 1 });
      const [first, second] = await Promise.all([insertUser(pool), insertUser(pool)]);

      const firstOrder = await buy(w, paid.id, first);
      await expect(s.orders.create(student(second), { items: [{ type: 'CLASS', id: paid.id }] }, 't')).rejects.toMatchObject({ statusCode: 409, code: 'CLASS_FULL' });

      await s.orders.cancelOrder(student(first), firstOrder.order.id, 't').catch(() => undefined);
      await pool.query(`UPDATE "PaymentIntent" SET status = 'PENDING' WHERE id = $1 AND status = 'SUBMITTED'`, [firstOrder.order.payment!.id]);
      await s.orders.cancelOrder(student(first), firstOrder.order.id, 't');
      await expect(s.orders.create(student(second), { items: [{ type: 'CLASS', id: paid.id }] }, 't')).resolves.toBeDefined();
    });

    it('rolls a whole approval back when the class filled up in the meantime', async () => {
      const w = await tenantWith();
      const paid = await publish(w, { accessType: 'PAID', price: 100000, capacity: 1 });
      const [buyer, squatter] = await Promise.all([insertUser(pool), insertUser(pool)]);
      const { order, submissionId } = await buy(w, paid.id, buyer);

      await pool.query(`INSERT INTO "ClassEnrollment" (id, "classProductId", "userId", status) VALUES (gen_random_uuid(), $1, $2, 'ACTIVE')`, [paid.id, squatter]);
      await expect(s.manual.approve(admin(w.reviewer), submissionId, 'verified', 't')).rejects.toMatchObject({ statusCode: 409, code: 'CLASS_FULL' });

      expect((await one(`SELECT status::text FROM "PaymentIntent" WHERE id = $1`, [order.payment!.id])).status).toBe('SUBMITTED');
      expect((await one(`SELECT status::text FROM "Order" WHERE id = $1`, [order.id])).status).toBe('PENDING');
      expect(await count(`SELECT count(*) FROM "Entitlement" WHERE "userId" = $1`, [buyer])).toBe(0);
      expect(await count(`SELECT count(*) FROM "CreatorEarning" WHERE "orderId" = $1`, [order.id])).toBe(0);
      expect(await count(`SELECT count(*) FROM "LedgerTransaction" WHERE "orderId" = $1`, [order.id])).toBe(0);
    });
  });

  describe('attendance and completion', () => {
    it('records attendance once, only for enrolled learners and started sessions', async () => {
      const w = await tenantWith();
      const cls = await publish(w, {}, [session(2)]);
      const learner = await insertUser(pool);
      const outsider = await insertUser(pool);
      const [sess] = await s.prisma.classSession.findMany({ where: { classProductId: cls.id } });
      await s.classEnrollments.enrollFree(student(learner), cls.id, 't');

      const before = new Date(sess.startsAt.getTime() - 2 * HOUR);
      const during = new Date(sess.startsAt.getTime() + 10 * 60 * 1000);
      await expect(s.classEnrollments.attend(student(learner), cls.id, sess.id, before, 't')).rejects.toMatchObject({ statusCode: 409 });
      await expect(s.classEnrollments.attend(student(outsider), cls.id, sess.id, during, 't')).rejects.toMatchObject({ statusCode: 403 });

      const first = await s.classEnrollments.attend(student(learner), cls.id, sess.id, during, 't');
      const second = await s.classEnrollments.attend(student(learner), cls.id, sess.id, during, 't');
      expect(first.data.first).toBe(true);
      expect(second.data.first).toBe(false);
      expect(await count(`SELECT count(*) FROM "ClassAttendance" WHERE "sessionId" = $1`, [sess.id])).toBe(1);
      expect(await count(`SELECT count(*) FROM "DomainEvent" WHERE type = 'ClassAttended' AND "dedupeKey" = $1`, [`ClassAttended:${sess.id}:${learner}`])).toBe(1);

      await pool.query(`UPDATE "ClassSession" SET status = 'CANCELLED' WHERE id = $1`, [sess.id]);
      const other = await insertUser(pool);
      await s.classEnrollments.enrollFree(student(other), cls.id, 't');
      await expect(s.classEnrollments.attend(student(other), cls.id, sess.id, during, 't')).rejects.toMatchObject({ statusCode: 409 });
    });

    it('completes only after every session ended and was attended, and only once', async () => {
      const w = await tenantWith();
      const cls = await publish(w, {}, [session(2), session(3)]);
      const learner = await insertUser(pool);
      const sessions = await s.prisma.classSession.findMany({ where: { classProductId: cls.id }, orderBy: { startsAt: 'asc' } });
      await s.classEnrollments.enrollFree(student(learner), cls.id, 't');

      const afterAll = new Date(sessions[1].endsAt.getTime() + HOUR);
      await expect(s.classEnrollments.complete(student(learner), cls.id, new Date(), 't')).rejects.toMatchObject({ statusCode: 409 });
      await s.classEnrollments.attend(student(learner), cls.id, sessions[0].id, new Date(sessions[0].startsAt.getTime() + 60000), 't');
      await expect(s.classEnrollments.complete(student(learner), cls.id, afterAll, 't')).rejects.toMatchObject({ statusCode: 409 });
      await s.classEnrollments.attend(student(learner), cls.id, sessions[1].id, new Date(sessions[1].startsAt.getTime() + 60000), 't');

      const done = await s.classEnrollments.complete(student(learner), cls.id, afterAll, 't');
      const again = await s.classEnrollments.complete(student(learner), cls.id, afterAll, 't');
      expect(done.data.status).toBe('COMPLETED');
      expect(again.message).toMatch(/already/);
      expect(await count(`SELECT count(*) FROM "DomainEvent" WHERE type = 'ClassCompleted' AND "aggregateId" = $1`, [cls.id])).toBe(1);
      await expect(s.classEnrollments.cancelFree(student(learner), cls.id, 't')).rejects.toMatchObject({ statusCode: 409 });
      await expect(pool.query(`UPDATE "ClassEnrollment" SET status = 'ACTIVE', "completedAt" = NULL WHERE "userId" = $1`, [learner])).rejects.toThrow(/cannot be reopened/);
    });

    it('does not let a stranger complete a class they are not in', async () => {
      const w = await tenantWith();
      const cls = await publish(w);
      const outsider = await insertUser(pool);
      await expect(s.classEnrollments.complete(student(outsider), cls.id, new Date(Date.now() + 30 * DAY), 't')).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('teacher analytics', () => {
    it('shows counts and learner names to the instructor without contact details', async () => {
      const w = await tenantWith();
      const cls = await publish(w, { capacity: 10 });
      const learner = await insertUser(pool);
      await s.classEnrollments.enrollFree(student(learner), cls.id, 't');

      const view = await s.classAuthoring.enrollments(teacher(w.instructor), w.teacherCtx, cls.id, { page: 1, limit: 20 });
      expect(view.data.counts).toEqual({ ACTIVE: 1 });
      expect(view.data.data).toHaveLength(1);
      expect(JSON.stringify(view.data)).not.toContain('@test.local');
      const stranger = await tenantWith();
      await expect(s.classAuthoring.enrollments(teacher(stranger.owner), stranger.ownerCtx, cls.id, { page: 1, limit: 20 })).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
