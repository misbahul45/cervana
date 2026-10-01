import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TenantsController } from '../tenants.controller';
import { AdminTenantsController } from '../admin-tenants.controller';
import { TenantsService } from '../tenants.service';
import { TenantContextService } from '@/common/tenancy/tenant-context.service';
import { TenantGuard } from '@/common/tenancy/tenant.guard';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { PolicyService } from '@/common/authz/policy.service';
import { AuditService } from '@/common/authz/audit.service';
import {
  ADMIN_A,
  STUDENT_A,
  TEACHER_A,
  TEACHER_B,
  TestUser,
  asUser,
  createHttpApp,
} from '@/test-utils/http-harness';

const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TENANT_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const MISSING = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const EDITOR: TestUser = { id: 'editor-a', role: 'TEACHER' as any };

type Tenant = { id: string; name: string; slug: string; status: string; description: string | null; logo: unknown; ownerId: string };
type Membership = { tenantId: string; userId: string; role: string; status: string };

describe('Tenant isolation', () => {
  let app: INestApplication;
  let tenants: Map<string, Tenant>;
  let memberships: Membership[];
  let audits: any[];

  const seed = () => {
    tenants = new Map<string, Tenant>([
      [TENANT_A, { id: TENANT_A, name: 'Tenant A', slug: 'tenant-a', status: 'ACTIVE', description: null, logo: null, ownerId: TEACHER_A.id }],
      [TENANT_B, { id: TENANT_B, name: 'Tenant B', slug: 'tenant-b', status: 'ACTIVE', description: null, logo: null, ownerId: TEACHER_B.id }],
      [TENANT_C, { id: TENANT_C, name: 'Tenant C', slug: 'tenant-c', status: 'ACTIVE', description: null, logo: null, ownerId: TEACHER_A.id }],
    ]);
    memberships = [
      { tenantId: TENANT_A, userId: TEACHER_A.id, role: 'OWNER', status: 'ACTIVE' },
      { tenantId: TENANT_B, userId: TEACHER_B.id, role: 'OWNER', status: 'ACTIVE' },
      { tenantId: TENANT_A, userId: EDITOR.id, role: 'EDITOR', status: 'ACTIVE' },
    ];
    audits = [];
  };

  beforeEach(async () => {
    seed();
    const prisma: any = {
      tenantMembership: {
        findMany: jest.fn().mockImplementation(async ({ where }) =>
          memberships
            .filter(
              (m) =>
                m.userId === where.userId &&
                m.status === where.status &&
                (!where.tenant || tenants.get(m.tenantId)!.status === where.tenant.status),
            )
            .map((m) => ({ tenantId: m.tenantId, role: m.role, tenant: tenants.get(m.tenantId) })),
        ),
      },
      tenant: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => (tenants.has(where.id) ? { ...tenants.get(where.id), settings: null } : null)),
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const next = { ...tenants.get(where.id)!, ...data };
          tenants.set(where.id, next);
          return { ...next };
        }),
        findMany: jest.fn().mockImplementation(async () => [...tenants.values()]),
        count: jest.fn().mockImplementation(async () => tenants.size),
      },
      auditLog: { create: jest.fn().mockImplementation(async ({ data }) => audits.push(data)) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    prisma.$transaction = jest.fn().mockImplementation(async (cb) => cb(prisma));

    app = await createHttpApp({
      controllers: [TenantsController, AdminTenantsController],
      providers: [
        TenantsService,
        TenantContextService,
        TenantGuard,
        PolicyService,
        AuditService,
        { provide: PrismaService, useValue: prisma },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  const current = (actor?: TestUser, tenantId?: string) => {
    const req = request(app.getHttpServer()).get('/tenants/current');
    if (actor) req.set(asUser(actor));
    if (tenantId) req.set('x-tenant-id', tenantId);
    return req;
  };

  describe('tenant context', () => {
    it('rejects unauthenticated requests', async () => {
      await current().expect(401);
    });

    it('a learner has no tenant access even when naming a real tenant', async () => {
      await current(STUDENT_A).expect(403);
      await current(STUDENT_A, TENANT_A).expect(403);
    });

    it('a teacher with one membership is placed in that tenant automatically', async () => {
      const res = await current(TEACHER_A).expect(200);
      expect(res.body.data.id ?? res.body.data?.data?.id).toBe(TENANT_A);
    });

    it('a teacher cannot read another tenant by forging the tenant header', async () => {
      await current(TEACHER_A, TENANT_B).expect(403);
      await current(TEACHER_B, TENANT_A).expect(403);
    });

    it('a forged header for a tenant that does not exist gives the same answer as one that exists', async () => {
      const missing = await current(TEACHER_A, MISSING);
      const other = await current(TEACHER_A, TENANT_B);
      expect(missing.status).toBe(403);
      expect(other.status).toBe(403);
    });

    it('rejects malformed tenant identifiers', async () => {
      await current(TEACHER_A, 'not-a-uuid').expect(400);
      await current(TEACHER_A, "' OR 1=1 --").expect(400);
    });

    it('a teacher in several tenants must choose one, and can only choose their own', async () => {
      memberships.push({ tenantId: TENANT_C, userId: TEACHER_A.id, role: 'MANAGER', status: 'ACTIVE' });
      await current(TEACHER_A).expect(400);
      const chosen = await current(TEACHER_A, TENANT_C).expect(200);
      expect(JSON.stringify(chosen.body)).toContain(TENANT_C);
      await current(TEACHER_A, TENANT_B).expect(403);
    });

    it('inactive memberships and suspended tenants grant nothing', async () => {
      memberships[0].status = 'SUSPENDED';
      await current(TEACHER_A).expect(403);
      seed();
      tenants.get(TENANT_A)!.status = 'SUSPENDED';
      await current(TEACHER_A).expect(403);
    });
  });

  describe('platform admin', () => {
    it('must name a tenant, and can reach any existing one', async () => {
      await current(ADMIN_A).expect(400);
      await current(ADMIN_A, TENANT_A).expect(200);
      await current(ADMIN_A, TENANT_B).expect(200);
      await current(ADMIN_A, MISSING).expect(404);
    });
  });

  describe('tenant mutation', () => {
    const patch = (actor: TestUser, body: object, tenantId?: string) => {
      const req = request(app.getHttpServer()).patch('/tenants/current').set(asUser(actor));
      if (tenantId) req.set('x-tenant-id', tenantId);
      return req.send(body);
    };

    it('an editor cannot change tenant details', async () => {
      const res = await patch(EDITOR, { name: 'Hijacked' }).expect(403);
      expect(JSON.stringify(res.body)).toContain('TENANT_ROLE_INSUFFICIENT');
      expect(tenants.get(TENANT_A)!.name).toBe('Tenant A');
    });

    it('the owner can, and the change is audited against the tenant', async () => {
      await patch(TEACHER_A, { name: 'Renamed Academy' }).expect(200);
      expect(tenants.get(TENANT_A)!.name).toBe('Renamed Academy');
      expect(audits).toContainEqual(expect.objectContaining({ action: 'TENANT_UPDATED', tenantId: TENANT_A, actorId: TEACHER_A.id }));
    });

    it('a teacher cannot mutate a tenant they do not belong to', async () => {
      await patch(TEACHER_A, { name: 'Takeover' }, TENANT_B).expect(403);
      expect(tenants.get(TENANT_B)!.name).toBe('Tenant B');
    });

    it.each(['status', 'ownerId', 'slug', 'id'])('the %s field cannot be set through the owner endpoint', async (field) => {
      await patch(TEACHER_A, { [field]: 'x' }).expect(400);
    });
  });

  describe('listing', () => {
    it('/tenants/mine returns only the caller memberships', async () => {
      const res = await request(app.getHttpServer()).get('/tenants/mine').set(asUser(TEACHER_A)).expect(200);
      const text = JSON.stringify(res.body);
      expect(text).toContain(TENANT_A);
      expect(text).not.toContain(TENANT_B);
    });

    it('the global tenant list is admin only', async () => {
      await request(app.getHttpServer()).get('/admin/tenants').set(asUser(TEACHER_A)).expect(403);
      await request(app.getHttpServer()).get('/admin/tenants').set(asUser(STUDENT_A)).expect(403);
      await request(app.getHttpServer()).get('/admin/tenants').set(asUser(ADMIN_A)).expect(200);
    });
  });

  describe('suspension', () => {
    const act = (path: string, actor: TestUser, body: object = { reason: 'Terms violation' }) =>
      request(app.getHttpServer()).post(path).set(asUser(actor)).send(body);

    it('only an admin can suspend, including the tenant own owner', async () => {
      await act(`/admin/tenants/${TENANT_A}/suspend`, TEACHER_A).expect(403);
      await act(`/admin/tenants/${TENANT_A}/suspend`, STUDENT_A).expect(403);
      expect(tenants.get(TENANT_A)!.status).toBe('ACTIVE');
    });

    it('suspension is audited, idempotent, and immediately blocks the tenant members', async () => {
      await act(`/admin/tenants/${TENANT_A}/suspend`, ADMIN_A).expect(201);
      await act(`/admin/tenants/${TENANT_A}/suspend`, ADMIN_A).expect(201);
      expect(tenants.get(TENANT_A)!.status).toBe('SUSPENDED');
      expect(audits.filter((a) => a.action === 'TENANT_SUSPENDED')).toHaveLength(1);
      expect(audits[0]).toEqual(expect.objectContaining({ tenantId: TENANT_A, reason: 'Terms violation', actorRole: 'ADMIN' }));
      await current(TEACHER_A).expect(403);
      await current(TEACHER_B).expect(200);
    });

    it('can be reversed, but an archived tenant is terminal', async () => {
      await act(`/admin/tenants/${TENANT_A}/suspend`, ADMIN_A).expect(201);
      await act(`/admin/tenants/${TENANT_A}/activate`, ADMIN_A, { reason: 'Appeal accepted' }).expect(201);
      await current(TEACHER_A).expect(200);
      tenants.get(TENANT_A)!.status = 'ARCHIVED';
      await act(`/admin/tenants/${TENANT_A}/activate`, ADMIN_A, { reason: 'Try to revive' }).expect(409);
    });

    it('requires a reason and a valid identifier', async () => {
      await act(`/admin/tenants/${TENANT_A}/suspend`, ADMIN_A, {}).expect(400);
      await act(`/admin/tenants/not-a-uuid/suspend`, ADMIN_A).expect(400);
      await act(`/admin/tenants/${MISSING}/suspend`, ADMIN_A).expect(404);
    });
  });
});
