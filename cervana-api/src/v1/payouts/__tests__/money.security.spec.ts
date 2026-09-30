import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ADMIN_A, STUDENT_A, STUDENT_B, TEACHER_A, asUser, createHttpApp } from '@/test-utils/http-harness';
import { WalletService } from '../../ledger/wallet.service';
import { WalletsController } from '../../ledger/wallets.controller';
import { AdminRefundsController, OrderRefundsController, RefundsController } from '../../refunds/refunds.controller';
import { RefundsService } from '../../refunds/refunds.service';
import { AdminPayoutsController, PayoutsController } from '../payouts.controller';
import { PayoutsService } from '../payouts.service';

const ID = '11111111-1111-4111-8111-111111111111';
const ORDER = '22222222-2222-4222-8222-222222222222';

const destination = { bankName: 'BCA', accountNumber: '1234567890', accountName: 'Nama Kreator' };
const evidence = { url: 'https://res.cloudinary.com/demo/image/upload/images/admin-a-proof.png', fileId: 'images/admin-a-proof' };

const mocks = (names: readonly string[]) =>
  Object.fromEntries(names.map((name) => [name, jest.fn().mockResolvedValue({ message: 'ok', data: {} })])) as Record<string, jest.Mock>;

describe('Money endpoints HTTP contract', () => {
  let app: INestApplication;
  let payouts: Record<string, jest.Mock>;
  let refunds: Record<string, jest.Mock>;
  let wallets: Record<string, jest.Mock>;

  beforeEach(async () => {
    payouts = mocks(['request', 'listMine', 'findMine', 'cancel', 'queue', 'findOne', 'startReview', 'approve', 'markPaid', 'reject']);
    refunds = mocks(['listMine', 'request', 'queue', 'findOne', 'approve', 'reject', 'process']);
    wallets = mocks(['listMine', 'findOne', 'ledgerOf']);
    app = await createHttpApp({
      controllers: [PayoutsController, AdminPayoutsController, RefundsController, OrderRefundsController, AdminRefundsController, WalletsController],
      providers: [
        { provide: PayoutsService, useValue: payouts },
        { provide: RefundsService, useValue: refunds },
        { provide: WalletService, useValue: wallets },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const call = (method: string, path: string, body: object | null, actor?: object) => {
    let req = (http() as any)[method](path);
    if (actor) req = req.set(asUser(actor as never));
    return method === 'get' ? req : req.send(body ?? {});
  };

  describe('payouts (creator side)', () => {
    it('are for teachers only', async () => {
      const commands: Array<[string, string, object | null]> = [
        ['post', '/payouts', { amount: 50000, destination }],
        ['get', '/payouts', null],
        ['get', `/payouts/${ID}`, null],
        ['post', `/payouts/${ID}/cancel`, {}],
      ];
      for (const [method, path, body] of commands) {
        await call(method, path, body).expect(401);
        await call(method, path, body, STUDENT_A).expect(403);
        await call(method, path, body, ADMIN_A).expect(403);
      }
      expect(payouts.request).not.toHaveBeenCalled();
      await call('post', '/payouts', { amount: 50000, destination }, TEACHER_A).expect(201);
      expect(payouts.request).toHaveBeenCalledWith(expect.objectContaining({ id: TEACHER_A.id }), { amount: 50000, destination }, expect.any(String));
    });

    it.each([
      ['no amount', { destination }],
      ['a zero amount', { amount: 0, destination }],
      ['a negative amount', { amount: -1, destination }],
      ['a fractional cent', { amount: '10.005', destination }],
      ['no destination', { amount: 50000 }],
      ['a destination with an extra field', { amount: 50000, destination: { ...destination, note: 'x' } }],
      ['a bad account number', { amount: 50000, destination: { ...destination, accountNumber: '<script>' } }],
      ['a client chosen status', { amount: 50000, destination, status: 'PAID' }],
      ['a client chosen creator', { amount: 50000, destination, creatorId: 'someone-else' }],
      ['a client chosen tenant', { amount: 50000, destination, tenantId: ID }],
    ])('refuse %s', async (_label, body) => {
      await call('post', '/payouts', body, TEACHER_A).expect(400);
      expect(payouts.request).not.toHaveBeenCalled();
    });
  });

  describe('payouts (admin side)', () => {
    const commands: Array<[string, string, object | null]> = [
      ['get', '/admin/payouts', null],
      ['get', `/admin/payouts/${ID}`, null],
      ['post', `/admin/payouts/${ID}/start-review`, {}],
      ['post', `/admin/payouts/${ID}/approve`, {}],
      ['post', `/admin/payouts/${ID}/mark-paid`, { evidence }],
      ['post', `/admin/payouts/${ID}/reject`, { reason: 'Account name mismatch' }],
    ];

    it.each(commands)('%s %s is closed to everyone but administrators', async (method, path, body) => {
      await call(method, path, body).expect(401);
      await call(method, path, body, STUDENT_A).expect(403);
      await call(method, path, body, TEACHER_A).expect(403);
      expect(Object.values(payouts).every((fn) => fn.mock.calls.length === 0)).toBe(true);
      await call(method, path, body, ADMIN_A).expect(method === 'get' ? 200 : 201);
    });

    it('needs evidence to mark paid and a reason to reject', async () => {
      await call('post', `/admin/payouts/${ID}/mark-paid`, {}, ADMIN_A).expect(400);
      await call('post', `/admin/payouts/${ID}/mark-paid`, { evidence: { url: 'http://x.test/e.png', fileId: 'images/e' } }, ADMIN_A).expect(400);
      await call('post', `/admin/payouts/${ID}/mark-paid`, { evidence, status: 'PAID' }, ADMIN_A).expect(400);
      await call('post', `/admin/payouts/${ID}/reject`, {}, ADMIN_A).expect(400);
      await call('post', `/admin/payouts/${ID}/reject`, { reason: 'valid reason', amount: 1 }, ADMIN_A).expect(400);
      expect(payouts.markPaid).not.toHaveBeenCalled();
      expect(payouts.reject).not.toHaveBeenCalled();
    });

    it('validates the queue filter', async () => {
      await call('get', '/admin/payouts?status=NOPE', null, ADMIN_A).expect(400);
      await call('get', '/admin/payouts?limit=1000', null, ADMIN_A).expect(400);
      await call('get', '/admin/payouts?status=REQUESTED&limit=10', null, ADMIN_A).expect(200);
    });
  });

  describe('refunds', () => {
    it('let a signed-in user ask for their own order, with a reason and nothing else', async () => {
      await call('post', `/orders/${ORDER}/refund-requests`, { reason: 'Saya membeli dua kali' }).expect(401);
      await call('post', `/orders/${ORDER}/refund-requests`, { reason: 'Saya membeli dua kali' }, STUDENT_A).expect(201);
      expect(refunds.request).toHaveBeenCalledWith(expect.objectContaining({ id: STUDENT_A.id }), ORDER, 'Saya membeli dua kali', expect.any(String));
      for (const body of [{}, { reason: 'abc' }, { reason: 'valid reason', amount: 1 }, { reason: 'valid reason', status: 'PROCESSED' }]) {
        await call('post', `/orders/${ORDER}/refund-requests`, body, STUDENT_B).expect(400);
      }
      await call('post', '/orders/not-a-uuid/refund-requests', { reason: 'valid reason' }, STUDENT_A).expect(400);
      expect(refunds.request).toHaveBeenCalledTimes(1);
    });

    it('list the caller refunds only through the caller route', async () => {
      await call('get', '/refunds/mine', null).expect(401);
      await call('get', '/refunds/mine', null, STUDENT_A).expect(200);
      expect(refunds.listMine).toHaveBeenCalledWith(expect.objectContaining({ id: STUDENT_A.id }), expect.anything());
    });

    it('are decided by administrators only', async () => {
      const commands: Array<[string, string, object | null]> = [
        ['get', '/admin/refunds', null],
        ['post', '/admin/refunds', { orderId: ORDER, reason: 'Goodwill refund' }],
        ['get', `/admin/refunds/${ID}`, null],
        ['post', `/admin/refunds/${ID}/approve`, {}],
        ['post', `/admin/refunds/${ID}/reject`, { reason: 'Outside the policy' }],
        ['post', `/admin/refunds/${ID}/process`, { evidence }],
      ];
      for (const [method, path, body] of commands) {
        await call(method, path, body).expect(401);
        await call(method, path, body, STUDENT_A).expect(403);
        await call(method, path, body, TEACHER_A).expect(403);
      }
      expect(Object.values(refunds).every((fn) => fn.mock.calls.length === 0)).toBe(true);
      await call('post', `/admin/refunds/${ID}/process`, {}, ADMIN_A).expect(400);
      await call('post', `/admin/refunds/${ID}/process`, { evidence, amount: 5 }, ADMIN_A).expect(400);
      await call('post', `/admin/refunds/${ID}/process`, { evidence }, ADMIN_A).expect(201);
      await call('post', '/admin/refunds', { orderId: 'nope', reason: 'Goodwill refund' }, ADMIN_A).expect(400);
    });
  });

  describe('wallets', () => {
    it('need a login and pass the caller to the service, which enforces ownership', async () => {
      await call('get', '/wallets/mine', null).expect(401);
      await call('get', `/wallets/${ID}`, null).expect(401);
      await call('get', `/wallets/${ID}/ledger`, null).expect(401);

      await call('get', '/wallets/mine', null, TEACHER_A).expect(200);
      await call('get', `/wallets/${ID}`, null, TEACHER_A).expect(200);
      expect(wallets.findOne).toHaveBeenCalledWith(expect.objectContaining({ id: TEACHER_A.id }), ID);
    });

    it('bound the ledger listing and expose no way to change a balance', async () => {
      await call('get', `/wallets/${ID}/ledger?limit=1000`, null, TEACHER_A).expect(400);
      await call('get', `/wallets/${ID}/ledger?page=0`, null, TEACHER_A).expect(400);
      await call('get', `/wallets/${ID}/ledger?page=2&limit=5`, null, TEACHER_A).expect(200);
      expect(wallets.ledgerOf).toHaveBeenCalledWith(expect.anything(), ID, 2, 5);

      for (const method of ['patch', 'put', 'post', 'delete']) {
        await call(method, `/wallets/${ID}`, { balance: 1000000 }, ADMIN_A).expect(404);
        await call(method, `/wallets/${ID}/ledger`, { amount: 1 }, ADMIN_A).expect(404);
      }
      await call('post', '/wallets', { balance: 1000000 }, TEACHER_A).expect(404);
      const routes = Object.getOwnPropertyNames(WalletsController.prototype).filter((name) => name !== 'constructor');
      expect(routes.sort()).toEqual(['findOne', 'ledger', 'mine']);
    });
  });
});
