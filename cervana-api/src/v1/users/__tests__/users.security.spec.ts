import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';
import { UsersRepo } from '../users.repo';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { PolicyService } from '@/common/authz/policy.service';
import { AuditService } from '@/common/authz/audit.service';
import {
  ADMIN_A,
  STUDENT_A,
  STUDENT_B,
  TEACHER_A,
  asUser,
  createHttpApp,
} from '@/test-utils/http-harness';

describe('Users security', () => {
  let app: INestApplication;
  let usersRepo: { findOne: jest.Mock; findAll: jest.Mock; update: jest.Mock; delete: jest.Mock; create: jest.Mock };
  let tx: { user: { findUnique: jest.Mock; update: jest.Mock }; auditLog: { create: jest.Mock } };
  let prisma: { $transaction: jest.Mock; auditLog: { create: jest.Mock } };

  beforeEach(async () => {
    usersRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'student-b', password: 'hash' }),
      findAll: jest.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({ id: 'new' }),
    };
    tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'student-b', role: 'STUDENT', isActive: true }),
        update: jest.fn().mockImplementation(async ({ data }) => ({ id: 'student-b', ...data })),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb(tx)),
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    app = await createHttpApp({
      controllers: [UsersController],
      providers: [
        UsersService,
        PolicyService,
        AuditService,
        { provide: UsersRepo, useValue: usersRepo },
        { provide: PrismaService, useValue: prisma },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('authentication', () => {
    it('rejects unauthenticated profile read', async () => {
      await request(app.getHttpServer()).get('/users/student-a').expect(401);
    });

    it('rejects unauthenticated role change', async () => {
      await request(app.getHttpServer())
        .post('/users/student-b/role')
        .send({ role: 'ADMIN', reason: 'no auth' })
        .expect(401);
    });
  });

  describe('role escalation through profile update', () => {
    it.each([
      ['STUDENT promoting self', STUDENT_A, 'student-a'],
      ['STUDENT promoting another user', STUDENT_A, 'student-b'],
      ['TEACHER promoting self', TEACHER_A, 'teacher-a'],
      ['TEACHER promoting a STUDENT', TEACHER_A, 'student-b'],
    ])('%s is rejected and nothing is written', async (_label, actor, targetId) => {
      const res = await request(app.getHttpServer())
        .patch(`/users/${targetId}`)
        .set(asUser(actor))
        .send({ role: 'ADMIN' });

      expect([400, 403]).toContain(res.status);
      expect(usersRepo.update).not.toHaveBeenCalled();
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it.each(['isActive', 'emailVerified', 'provider', 'password', 'email'])(
      'profile update rejects privileged field %s',
      async (field) => {
        const res = await request(app.getHttpServer())
          .patch('/users/student-a')
          .set(asUser(STUDENT_A))
          .send({ [field]: field === 'isActive' ? true : 'x' });

        expect(res.status).toBe(400);
        expect(usersRepo.update).not.toHaveBeenCalled();
      },
    );

    it('allows a user to update own name', async () => {
      await request(app.getHttpServer())
        .patch('/users/student-a')
        .set(asUser(STUDENT_A))
        .send({ name: 'New Name' })
        .expect(200);
      expect(usersRepo.update).toHaveBeenCalledWith({ id: 'student-a', values: { name: 'New Name' } });
    });

    it('blocks a user from updating another user profile', async () => {
      await request(app.getHttpServer())
        .patch('/users/student-b')
        .set(asUser(STUDENT_A))
        .send({ name: 'Hijack' })
        .expect(403);
      expect(usersRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('dedicated role management', () => {
    const body = { role: 'TEACHER', reason: 'Approved teacher application' };

    it.each([
      ['STUDENT', STUDENT_A],
      ['TEACHER', TEACHER_A],
    ])('%s cannot change any role', async (_label, actor) => {
      await request(app.getHttpServer())
        .post('/users/student-b/role')
        .set(asUser(actor))
        .send(body)
        .expect(403);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('ADMIN can change a role and the change is audited in the same transaction', async () => {
      await request(app.getHttpServer())
        .post('/users/student-b/role')
        .set(asUser(ADMIN_A))
        .set('x-trace-id', 'trace-123')
        .send(body)
        .expect(201);

      expect(tx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'student-b' }, data: { role: 'TEACHER' } }),
      );
      expect(tx.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'admin-a',
          actorRole: 'ADMIN',
          action: 'USER_ROLE_CHANGED',
          entityType: 'User',
          entityId: 'student-b',
          reason: body.reason,
          traceId: 'trace-123',
        }),
      });
    });

    it('ADMIN cannot change own role', async () => {
      await request(app.getHttpServer())
        .post('/users/admin-a/role')
        .set(asUser(ADMIN_A))
        .send({ role: 'STUDENT', reason: 'self demotion' })
        .expect(403);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('requires a reason and rejects unknown fields', async () => {
      await request(app.getHttpServer())
        .post('/users/student-b/role')
        .set(asUser(ADMIN_A))
        .send({ role: 'TEACHER' })
        .expect(400);
      await request(app.getHttpServer())
        .post('/users/student-b/role')
        .set(asUser(ADMIN_A))
        .send({ role: 'TEACHER', reason: 'valid reason', isActive: true })
        .expect(400);
    });

    it('an unchanged role writes nothing and is not audited', async () => {
      tx.user.findUnique.mockResolvedValue({ id: 'student-b', role: 'TEACHER' });
      await request(app.getHttpServer())
        .post('/users/student-b/role')
        .set(asUser(ADMIN_A))
        .send(body)
        .expect(201);
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(tx.auditLog.create).not.toHaveBeenCalled();
    });
  });

  describe('read access', () => {
    it('STUDENT cannot list users', async () => {
      await request(app.getHttpServer()).get('/users').set(asUser(STUDENT_A)).expect(403);
      expect(usersRepo.findAll).not.toHaveBeenCalled();
    });

    it('STUDENT cannot read another user', async () => {
      await request(app.getHttpServer()).get('/users/student-b').set(asUser(STUDENT_A)).expect(403);
      expect(usersRepo.findOne).not.toHaveBeenCalled();
    });

    it('STUDENT can read self without password', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'student-a', password: 'hash', name: 'A' });
      const res = await request(app.getHttpServer()).get('/users/student-a').set(asUser(STUDENT_A)).expect(200);
      expect(JSON.stringify(res.body)).not.toContain('hash');
    });

    it('ADMIN can list and read any user', async () => {
      await request(app.getHttpServer()).get('/users').set(asUser(ADMIN_A)).expect(200);
      await request(app.getHttpServer()).get('/users/student-b').set(asUser(ADMIN_A)).expect(200);
    });
  });

  describe('destructive and activation operations', () => {
    it('only ADMIN can delete a user', async () => {
      await request(app.getHttpServer()).delete('/users/student-b').set(asUser(STUDENT_A)).expect(403);
      await request(app.getHttpServer()).delete('/users/student-b').set(asUser(TEACHER_A)).expect(403);
      expect(usersRepo.delete).not.toHaveBeenCalled();
      await request(app.getHttpServer()).delete('/users/student-b').set(asUser(ADMIN_A)).expect(200);
    });

    it('only ADMIN can change activation, and it is audited', async () => {
      const body = { isActive: false, reason: 'Policy violation' };
      await request(app.getHttpServer()).post('/users/student-b/activation').set(asUser(STUDENT_B)).send(body).expect(403);
      await request(app.getHttpServer()).post('/users/student-b/activation').set(asUser(ADMIN_A)).send(body).expect(201);
      expect(tx.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'USER_DEACTIVATED', entityId: 'student-b' }),
      });
    });
  });
});
