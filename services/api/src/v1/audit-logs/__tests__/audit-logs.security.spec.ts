import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PolicyService } from '@/common/authz/policy.service';
import { ADMIN_A, STUDENT_A, TEACHER_A, asUser, createHttpApp } from '@/test-utils/http-harness';
import { AuditLogQueryDto } from '../audit-logs.dto';
import { AuditLogsController } from '../audit-logs.controller';
import { AuditLogsService } from '../audit-logs.service';

const LOG = '11111111-1111-4111-8111-111111111111';

describe('Audit logs HTTP contract', () => {
  let app: INestApplication;
  let logs: Record<'list' | 'actions' | 'findOne', jest.Mock>;

  beforeEach(async () => {
    const ok = () => jest.fn().mockResolvedValue({ message: 'ok', data: {} });
    logs = { list: ok(), actions: ok(), findOne: ok() };
    app = await createHttpApp({
      controllers: [AuditLogsController],
      providers: [PolicyService, { provide: AuditLogsService, useValue: logs }],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('requires a login', async () => {
    await http().get('/admin/audit-logs').expect(401);
    await http().get('/admin/audit-logs/actions').expect(401);
    await http().get(`/admin/audit-logs/${LOG}`).expect(401);
  });

  it('is closed to learners and teachers', async () => {
    for (const user of [STUDENT_A, TEACHER_A]) {
      await http().get('/admin/audit-logs').set(asUser(user)).expect(403);
      await http().get('/admin/audit-logs/actions').set(asUser(user)).expect(403);
      await http().get(`/admin/audit-logs/${LOG}`).set(asUser(user)).expect(403);
    }
    expect(logs.list).not.toHaveBeenCalled();
    expect(logs.actions).not.toHaveBeenCalled();
    expect(logs.findOne).not.toHaveBeenCalled();
  });

  it('lets an administrator read, with defaults filled in', async () => {
    await http().get('/admin/audit-logs').set(asUser(ADMIN_A)).expect(200);
    expect(logs.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 25 }));
    await http().get('/admin/audit-logs/actions').set(asUser(ADMIN_A)).expect(200);
    await http().get(`/admin/audit-logs/${LOG}`).set(asUser(ADMIN_A)).expect(200);
    expect(logs.findOne).toHaveBeenCalledWith(LOG);
  });

  it('passes the filters through after validating them', async () => {
    await http()
      .get(`/admin/audit-logs?action=USER_ROLE_CHANGED&entityType=User&actorId=${LOG}&from=2026-10-01T00:00:00.000Z&to=2026-10-11T00:00:00.000Z&limit=50`)
      .set(asUser(ADMIN_A))
      .expect(200);
    expect(logs.list).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_ROLE_CHANGED', entityType: 'User', actorId: LOG, limit: 50, from: new Date('2026-10-01T00:00:00.000Z'), to: new Date('2026-10-11T00:00:00.000Z') }),
    );
  });

  it.each([
    ['a page below one', 'page=0'],
    ['a limit above one hundred', 'limit=101'],
    ['an actor that is not a uuid', 'actorId=nope'],
    ['a date that is not a date', 'from=yesterday'],
    ['a range that ends before it starts', 'from=2026-10-11T00:00:00.000Z&to=2026-10-01T00:00:00.000Z'],
    ['an action that is far too long', `action=${'x'.repeat(101)}`],
  ])('rejects %s', async (_label, query) => {
    await http().get(`/admin/audit-logs?${query}`).set(asUser(ADMIN_A)).expect(400);
    expect(logs.list).not.toHaveBeenCalled();
  });

  it('rejects an id that is not a uuid', async () => {
    await http().get('/admin/audit-logs/not-a-uuid').set(asUser(ADMIN_A)).expect(400);
    expect(logs.findOne).not.toHaveBeenCalled();
  });

  it('ignores filters it does not know instead of passing them to the database', () => {
    const parsed = AuditLogQueryDto.parse({ where: '{"id":"x"}', orderBy: 'id', actorId: LOG });
    expect(Object.keys(parsed).sort()).toEqual(['actorId', 'limit', 'page']);
  });
});
