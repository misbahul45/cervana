import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { ADMIN_A, STUDENT_A, TEACHER_A, asUser, createHttpApp } from '@/test-utils/http-harness';
import { RewardsController } from '../rewards.controller';
import { RewardLedgerService } from '../reward-ledger.service';

const stored = (overrides: Record<string, unknown> = {}) => ({
  id: 'entry-1',
  userId: STUDENT_A.id,
  kind: 'XP',
  ruleId: 'MASTERY_PROGRESS',
  ruleVersion: 1,
  points: 12,
  idempotencyKey: 'reward:MASTERY_PROGRESS:v1:evt-1',
  sourceType: 'LEARNING_EVENT',
  sourceId: 'evt-1',
  conceptId: 'c1',
  topicId: 't1',
  subTopicId: 's1',
  reversalOf: null,
  reason: null,
  actorId: null,
  createdAt: new Date('2026-10-09T10:00:00Z'),
  ...overrides,
});

describe('RewardsController', () => {
  let app: INestApplication;
  let ledger: { history: jest.Mock; reverse: jest.Mock };

  beforeEach(async () => {
    ledger = {
      history: jest.fn(async (userId: string) => ({ balance: 12, starBalance: 3, entries: [stored({ userId })] })),
      reverse: jest.fn(async () => ({ entry: stored({ id: 'entry-2', points: -12, reversalOf: 'entry-1', reason: 'farmed', actorId: ADMIN_A.id }), duplicate: false })),
    };
    app = await createHttpApp({ controllers: [RewardsController], providers: [{ provide: RewardLedgerService, useValue: ledger }] });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /rewards/me', () => {
    it('requires authentication', async () => {
      await request(app.getHttpServer()).get('/rewards/me').expect(401);
    });

    it('returns the caller own balance and entries', async () => {
      const res = await request(app.getHttpServer()).get('/rewards/me').set(asUser(STUDENT_A)).expect(200);

      expect(ledger.history).toHaveBeenCalledWith(STUDENT_A.id, { limit: undefined });
      expect(res.body.data.balance).toBe(12);
      expect(res.body.data.starBalance).toBe(3);
      expect(res.body.data.entries).toHaveLength(1);
    });

    it('never reads another learner, whatever the query says', async () => {
      await request(app.getHttpServer()).get('/rewards/me?userId=student-b').set(asUser(STUDENT_A)).expect(200);

      expect(ledger.history).toHaveBeenCalledWith(STUDENT_A.id, expect.anything());
      expect(ledger.history).not.toHaveBeenCalledWith('student-b', expect.anything());
    });

    it('shows what the learner needs to understand a grant and hides the internals', async () => {
      const res = await request(app.getHttpServer()).get('/rewards/me').set(asUser(STUDENT_A)).expect(200);

      expect(res.body.data.entries[0]).toEqual({
        id: 'entry-1',
        kind: 'XP',
        ruleId: 'MASTERY_PROGRESS',
        ruleVersion: 1,
        points: 12,
        conceptId: 'c1',
        reversal: false,
        createdAt: '2026-10-09T10:00:00.000Z',
      });
    });

    it('marks a reversal and does not leak the admin reason or actor', async () => {
      ledger.history.mockResolvedValueOnce({ balance: 0, entries: [stored({ points: -12, reversalOf: 'entry-0', reason: 'internal note', actorId: 'admin-x' })] });

      const res = await request(app.getHttpServer()).get('/rewards/me').set(asUser(STUDENT_A)).expect(200);

      expect(res.body.data.entries[0].reversal).toBe(true);
      expect(JSON.stringify(res.body)).not.toMatch(/internal note|admin-x|idempotencyKey|sourceId/);
    });

    it('passes a numeric limit and ignores a garbage one', async () => {
      await request(app.getHttpServer()).get('/rewards/me?limit=5').set(asUser(STUDENT_A)).expect(200);
      await request(app.getHttpServer()).get('/rewards/me?limit=lots').set(asUser(STUDENT_A)).expect(200);

      expect(ledger.history.mock.calls.map(([, o]) => o.limit)).toEqual([5, undefined]);
    });

    it('is open to every signed-in role as their own history', async () => {
      await request(app.getHttpServer()).get('/rewards/me').set(asUser(TEACHER_A)).expect(200);
      await request(app.getHttpServer()).get('/rewards/me').set(asUser(ADMIN_A)).expect(200);

      expect(ledger.history.mock.calls.map(([id]) => id)).toEqual([TEACHER_A.id, ADMIN_A.id]);
    });
  });

  describe('POST /rewards/ledger/:id/reverse', () => {
    const body = { reason: 'farmed by retakes' };

    it('refuses everyone but an admin', async () => {
      await request(app.getHttpServer()).post('/rewards/ledger/entry-1/reverse').send(body).expect(401);
      await request(app.getHttpServer()).post('/rewards/ledger/entry-1/reverse').set(asUser(STUDENT_A)).send(body).expect(403);
      await request(app.getHttpServer()).post('/rewards/ledger/entry-1/reverse').set(asUser(TEACHER_A)).send(body).expect(403);

      expect(ledger.reverse).not.toHaveBeenCalled();
    });

    it('reverses as the admin named by the session and answers with the new entry', async () => {
      const res = await request(app.getHttpServer()).post('/rewards/ledger/entry-1/reverse').set(asUser(ADMIN_A)).send(body).expect(200);

      expect(ledger.reverse).toHaveBeenCalledWith({ entryId: 'entry-1', reason: 'farmed by retakes', actorId: ADMIN_A.id, actorRole: 'ADMIN' });
      expect(res.body.data).toEqual({ id: 'entry-2', reversalOf: 'entry-1', points: -12, duplicate: false });
    });

    it('answers a repeated reversal with the first and says so', async () => {
      ledger.reverse.mockResolvedValueOnce({ entry: stored({ id: 'entry-2', points: -12, reversalOf: 'entry-1' }), duplicate: true });

      const res = await request(app.getHttpServer()).post('/rewards/ledger/entry-1/reverse').set(asUser(ADMIN_A)).send(body).expect(200);

      expect(res.body.data.duplicate).toBe(true);
    });

    it.each([
      ['no reason', {}],
      ['a reason that is too short', { reason: 'no' }],
      ['a reason that is too long', { reason: 'x'.repeat(501) }],
      ['an extra field', { reason: 'farmed', points: 5 }],
    ])('rejects %s without reversing anything', async (_label, payload) => {
      await request(app.getHttpServer()).post('/rewards/ledger/entry-1/reverse').set(asUser(ADMIN_A)).send(payload).expect(400);

      expect(ledger.reverse).not.toHaveBeenCalled();
    });

    it('lets the not found and the already reversed answers of the service through', async () => {
      ledger.reverse.mockRejectedValueOnce(new AppError('Ledger entry not found', 404, AppErrorCode.NOT_FOUND));
      ledger.reverse.mockRejectedValueOnce(new AppError('A reversal cannot be reversed', 409, AppErrorCode.INVALID_STATE_TRANSITION));

      await request(app.getHttpServer()).post('/rewards/ledger/ghost/reverse').set(asUser(ADMIN_A)).send(body).expect(404);
      await request(app.getHttpServer()).post('/rewards/ledger/entry-2/reverse').set(asUser(ADMIN_A)).send(body).expect(409);
    });
  });
});
