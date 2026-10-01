import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PolicyService } from '@/common/authz/policy.service';
import { AuditService } from '@/common/authz/audit.service';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { TenantContextService } from '@/common/tenancy/tenant-context.service';
import { ADMIN_A, STUDENT_A, TEACHER_A, TEACHER_B, asUser, createHttpApp } from '@/test-utils/http-harness';
import { AdminClassesController } from '../admin-classes.controller';
import { ClassAuthoringService } from '../class-authoring.service';
import { ClassEnrollmentsService } from '../class-enrollments.service';
import { ClassModerationService } from '../class-moderation.service';
import { ClassesController } from '../classes.controller';
import { MarketplaceClassesController } from '../marketplace-classes.controller';
import { MarketplaceClassesService } from '../marketplace-classes.service';

const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CLASS = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';

const VALID = { title: 'Kelas laporan keuangan', accessType: 'FREE', format: 'LIVE', difficulty: 'BEGINNER' };
const WHEN = { startsAt: '2027-01-10T09:00:00.000Z', endsAt: '2027-01-10T10:00:00.000Z', meetingUrl: 'https://meet.example.test/room' };

const mocks = <T extends string>(names: readonly T[]) =>
  Object.fromEntries(names.map((name) => [name, jest.fn().mockResolvedValue({ message: 'ok', data: {} })])) as Record<T, jest.Mock>;

describe('Classes HTTP contract', () => {
  let app: INestApplication;
  let authoring: Record<string, jest.Mock>;
  let moderation: Record<string, jest.Mock>;
  let marketplace: Record<string, jest.Mock>;
  let enrollments: Record<string, jest.Mock>;
  let memberships: Record<string, Array<{ tenantId: string; role: string }>>;

  beforeEach(async () => {
    authoring = mocks(['create', 'list', 'findOne', 'update', 'submitReview', 'withdraw', 'archive', 'addSession', 'updateSession', 'cancelSession', 'enrollments']);
    moderation = mocks(['queue', 'findOne', 'approve', 'reject', 'suspend', 'reinstate', 'archive']);
    marketplace = mocks(['list', 'findOne', 'access', 'materials']);
    enrollments = mocks(['enrollFree', 'cancelFree', 'attend', 'complete', 'listMine']);
    memberships = {
      [TEACHER_A.id]: [{ tenantId: TENANT_A, role: 'TEACHER' }],
      [TEACHER_B.id]: [{ tenantId: TENANT_B, role: 'OWNER' }],
    };
    const prisma = {
      tenantMembership: { findMany: jest.fn().mockImplementation(async ({ where }) => memberships[where.userId] ?? []) },
      tenant: { findUnique: jest.fn().mockResolvedValue({ id: TENANT_A }) },
    };
    app = await createHttpApp({
      controllers: [ClassesController, MarketplaceClassesController, AdminClassesController],
      providers: [
        PolicyService,
        TenantContextService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { record: jest.fn() } },
        { provide: ClassAuthoringService, useValue: authoring },
        { provide: ClassModerationService, useValue: moderation },
        { provide: MarketplaceClassesService, useValue: marketplace },
        { provide: ClassEnrollmentsService, useValue: enrollments },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  describe('authoring is for tenant members only', () => {
    it('requires a login and a membership', async () => {
      await http().post('/classes').send(VALID).expect(401);
      await http().post('/classes').set(asUser(STUDENT_A)).send(VALID).expect(403);
      memberships[TEACHER_A.id] = [];
      await http().post('/classes').set(asUser(TEACHER_A)).send(VALID).expect(403);
      expect(authoring.create).not.toHaveBeenCalled();
    });

    it('resolves the tenant from the membership and refuses a forged one', async () => {
      await http().post('/classes').set({ ...asUser(TEACHER_A), 'x-trace-id': 't-1' }).send(VALID).expect(201);
      expect(authoring.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: TEACHER_A.id }),
        { userId: TEACHER_A.id, tenantId: TENANT_A, tenantRole: 'TEACHER', isPlatformAdmin: false },
        expect.objectContaining({ title: 'Kelas laporan keuangan', format: 'LIVE' }),
        't-1',
      );
      await http().post('/classes').set({ ...asUser(TEACHER_A), 'x-tenant-id': TENANT_B }).send(VALID).expect(403);
      await http().get(`/classes/${CLASS}/enrollments`).set({ ...asUser(TEACHER_A), 'x-tenant-id': TENANT_B }).expect(403);
    });
  });

  describe('mass assignment and validation', () => {
    it.each([
      ['status', { status: 'PUBLISHED' }],
      ['instructorId', { instructorId: 'someone-else' }],
      ['tenantId', { tenantId: TENANT_B }],
      ['publishedAt', { publishedAt: '2026-01-01T00:00:00.000Z' }],
      ['reviewedById', { reviewedById: ADMIN_A.id }],
      ['currency', { currency: 'USD' }],
      ['enrolled count', { enrolledCount: 0 }],
    ])('creating cannot set %s', async (_field, extra) => {
      await http().post('/classes').set(asUser(TEACHER_A)).send({ ...VALID, ...extra }).expect(400);
      await http().patch(`/classes/${CLASS}`).set(asUser(TEACHER_A)).send(extra).expect(400);
      expect(authoring.create).not.toHaveBeenCalled();
      expect(authoring.update).not.toHaveBeenCalled();
    });

    it.each([
      ['a short title', { title: 'ab' }],
      ['a negative price', { accessType: 'PAID', price: -1 }],
      ['zero capacity', { capacity: 0 }],
      ['a fractional capacity', { capacity: 2.5 }],
      ['an unknown format', { format: 'HOLOGRAM' }],
      ['an unknown difficulty', { difficulty: 'IMPOSSIBLE' }],
      ['a too short duration', { durationMinutes: 1 }],
      ['an insecure cover', { coverImage: { url: 'http://x.test/a.png', fileId: 'images/a' } }],
    ])('rejects %s', async (_label, extra) => {
      await http().post('/classes').set(asUser(TEACHER_A)).send({ ...VALID, ...extra }).expect(400);
      expect(authoring.create).not.toHaveBeenCalled();
    });

    it('a partial update sends only what changed', async () => {
      await http().patch(`/classes/${CLASS}`).set(asUser(TEACHER_A)).send({ capacity: 40 }).expect(200);
      expect(authoring.update).toHaveBeenCalledWith(expect.anything(), expect.anything(), CLASS, { capacity: 40 }, expect.any(String));
    });

    it('validates sessions', async () => {
      await http().post(`/classes/${CLASS}/sessions`).set(asUser(TEACHER_A)).send(WHEN).expect(201);
      const bad: object[] = [
        { ...WHEN, endsAt: WHEN.startsAt },
        { ...WHEN, endsAt: '2027-01-10T08:00:00.000Z' },
        { ...WHEN, meetingUrl: 'http://insecure.test/room' },
        { ...WHEN, meetingUrl: 'javascript:alert(1)' },
        { ...WHEN, status: 'COMPLETED' },
        { startsAt: 'not a date', endsAt: WHEN.endsAt },
        {},
      ];
      for (const body of bad) {
        await http().post(`/classes/${CLASS}/sessions`).set(asUser(TEACHER_A)).send(body).expect(400);
      }
      expect(authoring.addSession).toHaveBeenCalledTimes(1);
      await http().patch(`/classes/${CLASS}/sessions/${SESSION}`).set(asUser(TEACHER_A)).send({ status: 'COMPLETED' }).expect(400);
      await http().patch(`/classes/${CLASS}/sessions/${SESSION}`).set(asUser(TEACHER_A)).send({ recordingUrl: 'https://rec.example.test/a' }).expect(200);
      await http().post(`/classes/${CLASS}/sessions/${SESSION}/cancel`).set(asUser(TEACHER_A)).expect(201);
    });

    it('rejects malformed ids', async () => {
      await http().get('/classes/not-a-uuid').set(asUser(TEACHER_A)).expect(400);
      await http().post(`/classes/${CLASS}/sessions/not-a-uuid/cancel`).set(asUser(TEACHER_A)).expect(400);
    });
  });

  describe('review commands are for administrators', () => {
    const commands: Array<[string, string, object]> = [
      ['get', '/admin/classes', {}],
      ['get', `/admin/classes/${CLASS}`, {}],
      ['post', `/admin/classes/${CLASS}/approve`, {}],
      ['post', `/admin/classes/${CLASS}/reject`, { reason: 'Needs a clearer syllabus' }],
      ['post', `/admin/classes/${CLASS}/suspend`, { reason: 'Complaint received' }],
      ['post', `/admin/classes/${CLASS}/reinstate`, {}],
      ['post', `/admin/classes/${CLASS}/archive`, {}],
    ];
    const call = (method: string, path: string, body: object, actor?: object) => {
      let req = (http() as any)[method](path);
      if (actor) req = req.set(asUser(actor as never));
      return method === 'get' ? req : req.send(body);
    };

    it.each(commands)('%s %s needs a login and the ADMIN role', async (method, path, body) => {
      await call(method, path, body).expect(401);
      await call(method, path, body, STUDENT_A).expect(403);
      await call(method, path, body, TEACHER_A).expect(403);
      expect(Object.values(moderation).every((fn) => fn.mock.calls.length === 0)).toBe(true);
    });

    it('requires a reason to reject or suspend', async () => {
      for (const command of ['reject', 'suspend']) {
        await call('post', `/admin/classes/${CLASS}/${command}`, {}, ADMIN_A).expect(400);
        await call('post', `/admin/classes/${CLASS}/${command}`, { reason: 'valid reason', status: 'PUBLISHED' }, ADMIN_A).expect(400);
      }
      await call('post', `/admin/classes/${CLASS}/approve`, {}, ADMIN_A).expect(201);
      expect(moderation.reject).not.toHaveBeenCalled();
      expect(moderation.approve).toHaveBeenCalledWith(expect.objectContaining({ id: ADMIN_A.id }), CLASS, undefined, expect.any(String));
    });
  });

  describe('learners', () => {
    it('browse without a login but need one for everything personal', async () => {
      await http().get('/marketplace/classes').expect(200);
      await http().get(`/marketplace/classes/${CLASS}`).expect(200);
      for (const [method, path] of [
        ['get', `/marketplace/classes/${CLASS}/access`],
        ['get', `/marketplace/classes/${CLASS}/materials`],
        ['get', '/marketplace/classes/enrollments/mine'],
        ['post', `/marketplace/classes/${CLASS}/enroll`],
        ['post', `/marketplace/classes/${CLASS}/cancel-enrollment`],
        ['post', `/marketplace/classes/${CLASS}/sessions/${SESSION}/attend`],
        ['post', `/marketplace/classes/${CLASS}/complete`],
      ]) {
        await (http() as any)[method](path).expect(401);
      }
    });

    it('acts as the caller only, with a server-side clock', async () => {
      await http().post(`/marketplace/classes/${CLASS}/enroll`).set({ ...asUser(STUDENT_A), 'x-trace-id': 't-7' }).send({ userId: 'someone-else' }).expect(201);
      expect(enrollments.enrollFree).toHaveBeenCalledWith(expect.objectContaining({ id: STUDENT_A.id }), CLASS, 't-7');

      await http().post(`/marketplace/classes/${CLASS}/sessions/${SESSION}/attend`).set(asUser(STUDENT_A)).send({ now: '2020-01-01T00:00:00Z' }).expect(201);
      const [, , , when] = enrollments.attend.mock.calls[0];
      expect(Math.abs((when as Date).getTime() - Date.now())).toBeLessThan(5000);

      await http().post(`/marketplace/classes/${CLASS}/complete`).set(asUser(STUDENT_A)).send({ now: '2099-01-01T00:00:00Z' }).expect(201);
      const [, , completedAt] = enrollments.complete.mock.calls[0];
      expect(Math.abs((completedAt as Date).getTime() - Date.now())).toBeLessThan(5000);
    });

    it('bounds the listing query', async () => {
      await http().get('/marketplace/classes?limit=500').expect(400);
      await http().get('/marketplace/classes?format=HOLOGRAM').expect(400);
      await http().get('/marketplace/classes?sort=random').expect(400);
      await http().get('/marketplace/classes/enrollments/mine?limit=1000').set(asUser(STUDENT_A)).expect(400);
    });
  });
});
