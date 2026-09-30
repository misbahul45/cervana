import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ApplicationsController } from '../applications.controller';
import { ApplicationsService } from '../applications.service';
import { ApplicationsRepo } from '../applications.repo';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { PolicyService } from '@/common/authz/policy.service';
import { AuditService } from '@/common/authz/audit.service';
import { TenantProvisioningService } from '@/v1/tenants/tenant-provisioning.service';
import {
  ADMIN_A,
  STUDENT_A,
  STUDENT_B,
  TEACHER_A,
  asUser,
  createHttpApp,
} from '@/test-utils/http-harness';

const APP_ID = '44444444-4444-4444-8444-444444444444';
const valid = { fullName: 'Applicant Name', expertise: 'Accounting' };

describe('Teacher applications security', () => {
  let app: INestApplication;
  let stored: { id: string; userId: string; status: string; fullName: string };
  let userRow: { id: string; role: string };
  let repo: Record<string, jest.Mock>;
  let tx: any;
  let prisma: any;
  let provisioning: { provisionForOwner: jest.Mock };

  beforeEach(async () => {
    stored = { id: APP_ID, userId: STUDENT_A.id, status: 'PENDING', fullName: 'Applicant Name' };
    userRow = { id: STUDENT_A.id, role: 'STUDENT' };
    repo = {
      findById: jest.fn().mockImplementation(async () => ({ ...stored })),
      findByUserId: jest.fn().mockResolvedValue(null),
      list: jest.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }),
      create: jest.fn().mockImplementation(async (userId, values) => ({ id: APP_ID, userId, status: 'PENDING', ...values })),
      updateContent: jest.fn().mockResolvedValue({}),
    };
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      teacherApplication: {
        findUnique: jest.fn().mockImplementation(async () => ({ ...stored })),
        update: jest.fn().mockImplementation(async ({ data }) => {
          stored = { ...stored, ...data };
          return { ...stored };
        }),
      },
      user: {
        findUnique: jest.fn().mockImplementation(async () => ({ ...userRow })),
        update: jest.fn().mockImplementation(async ({ data }) => {
          userRow = { ...userRow, ...data };
          return userRow;
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb(tx)),
      ...tx,
    };
    provisioning = {
      provisionForOwner: jest.fn().mockResolvedValueOnce({ tenantId: 'tenant-1', created: true }).mockResolvedValue({ tenantId: 'tenant-1', created: false }),
    };
    app = await createHttpApp({
      controllers: [ApplicationsController],
      withOwnershipGuard: true,
      providers: [
        ApplicationsService,
        PolicyService,
        AuditService,
        { provide: TenantProvisioningService, useValue: provisioning },
        { provide: ApplicationsRepo, useValue: repo },
        { provide: PrismaService, useValue: prisma },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('submission', () => {
    it('rejects unauthenticated submission', async () => {
      await request(app.getHttpServer()).post('/applications').send(valid).expect(401);
    });

    it('a learner submits for themselves and always starts PENDING', async () => {
      await request(app.getHttpServer()).post('/applications').set(asUser(STUDENT_A)).send(valid).expect(201);
      expect(repo.create).toHaveBeenCalledWith(STUDENT_A.id, valid);
    });

    it.each(['userId', 'status', 'reviewedBy', 'reviewedAt', 'feedback'])(
      'rejects a body that tries to set %s',
      async (field) => {
        await request(app.getHttpServer())
          .post('/applications')
          .set(asUser(STUDENT_A))
          .send({ ...valid, [field]: field === 'status' ? 'APPROVED' : 'x' })
          .expect(400);
        expect(repo.create).not.toHaveBeenCalled();
      },
    );

    it('rejects a second application', async () => {
      repo.findByUserId.mockResolvedValue({ id: APP_ID });
      await request(app.getHttpServer()).post('/applications').set(asUser(STUDENT_A)).send(valid).expect(409);
    });

    it('existing teachers and admins cannot apply', async () => {
      await request(app.getHttpServer()).post('/applications').set(asUser(TEACHER_A)).send(valid).expect(403);
      await request(app.getHttpServer()).post('/applications').set(asUser(ADMIN_A)).send(valid).expect(403);
    });
  });

  describe('reading and editing', () => {
    it('a learner only lists their own application', async () => {
      await request(app.getHttpServer()).get('/applications').set(asUser(STUDENT_A)).expect(200);
      expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ userId: STUDENT_A.id }));
    });

    it('a learner cannot list another applicant', async () => {
      await request(app.getHttpServer())
        .get(`/applications?userId=55555555-5555-4555-8555-555555555555`)
        .set(asUser(STUDENT_A))
        .expect(403);
    });

    it('ADMIN lists everything', async () => {
      await request(app.getHttpServer()).get('/applications').set(asUser(ADMIN_A)).expect(200);
      expect(repo.list).toHaveBeenLastCalledWith(expect.objectContaining({ userId: undefined }));
    });

    it('owner and admin can read, another user cannot', async () => {
      await request(app.getHttpServer()).get(`/applications/${APP_ID}`).set(asUser(STUDENT_A)).expect(200);
      await request(app.getHttpServer()).get(`/applications/${APP_ID}`).set(asUser(ADMIN_A)).expect(200);
      await request(app.getHttpServer()).get(`/applications/${APP_ID}`).set(asUser(STUDENT_B)).expect(403);
      await request(app.getHttpServer()).get(`/applications/${APP_ID}`).set(asUser(TEACHER_A)).expect(403);
    });

    it('another user cannot edit it, and the owner cannot change status', async () => {
      await request(app.getHttpServer()).patch(`/applications/${APP_ID}`).set(asUser(STUDENT_B)).send({ bio: 'x' }).expect(403);
      await request(app.getHttpServer())
        .patch(`/applications/${APP_ID}`)
        .set(asUser(STUDENT_A))
        .send({ status: 'APPROVED' })
        .expect(400);
      expect(repo.updateContent).not.toHaveBeenCalled();
    });

    it('the owner can edit only while PENDING', async () => {
      await request(app.getHttpServer()).patch(`/applications/${APP_ID}`).set(asUser(STUDENT_A)).send({ bio: 'better' }).expect(200);
      stored.status = 'REJECTED';
      await request(app.getHttpServer()).patch(`/applications/${APP_ID}`).set(asUser(STUDENT_A)).send({ bio: 'again' }).expect(409);
    });

    it('DELETE is not exposed', async () => {
      await request(app.getHttpServer()).delete(`/applications/${APP_ID}`).set(asUser(ADMIN_A)).expect(404);
    });
  });

  describe('review', () => {
    const approve = (actor?: any) => {
      const req = request(app.getHttpServer()).post(`/applications/${APP_ID}/approve`);
      if (actor) req.set(asUser(actor));
      return req.send({});
    };

    it.each([
      ['unauthenticated', undefined, 401],
      ['the applicant', STUDENT_A, 403],
      ['another learner', STUDENT_B, 403],
      ['a teacher', TEACHER_A, 403],
    ])('%s cannot approve', async (_label, actor, status) => {
      await approve(actor).expect(status);
      expect(stored.status).toBe('PENDING');
      expect(userRow.role).toBe('STUDENT');
    });

    it('ADMIN approval promotes the applicant and audits both changes atomically', async () => {
      await approve(ADMIN_A).expect(201);
      expect(stored.status).toBe('APPROVED');
      expect(userRow.role).toBe('TEACHER');
      const actions = tx.auditLog.create.mock.calls.map((c: any) => c[0].data.action);
      expect(actions).toEqual(['TEACHER_APPLICATION_APPROVED', 'USER_ROLE_CHANGED', 'TENANT_CREATED']);
      expect(provisioning.provisionForOwner).toHaveBeenCalledWith(tx, { id: STUDENT_A.id, displayName: 'Applicant Name' });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('repeated approval is idempotent', async () => {
      await approve(ADMIN_A).expect(201);
      await approve(ADMIN_A).expect(201);
      await approve(ADMIN_A).expect(201);
      expect(tx.user.update).toHaveBeenCalledTimes(1);
      expect(tx.auditLog.create).toHaveBeenCalledTimes(3);
      expect(provisioning.provisionForOwner).toHaveBeenCalledTimes(1);
    });

    it('an admin cannot approve their own application', async () => {
      stored.userId = ADMIN_A.id;
      await approve(ADMIN_A).expect(403);
      expect(stored.status).toBe('PENDING');
    });

    it('rejection needs feedback, and a rejected application cannot be approved', async () => {
      await request(app.getHttpServer()).post(`/applications/${APP_ID}/reject`).set(asUser(ADMIN_A)).send({}).expect(400);
      await request(app.getHttpServer())
        .post(`/applications/${APP_ID}/reject`)
        .set(asUser(ADMIN_A))
        .send({ feedback: 'Insufficient evidence' })
        .expect(201);
      expect(userRow.role).toBe('STUDENT');
      await approve(ADMIN_A).expect(409);
      expect(userRow.role).toBe('STUDENT');
    });

    it('a teacher who already holds a higher role is not demoted by approval', async () => {
      userRow.role = 'ADMIN';
      await approve(ADMIN_A).expect(201);
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(provisioning.provisionForOwner).not.toHaveBeenCalled();
    });
  });
});
