import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PaymentsController } from '../payments.controller';
import { AdminPaymentsController } from '../admin-payments.controller';
import { PaymentWebhookController } from '../payment-webhook.controller';
import { PaymentService } from '../payment.service';
import { ManualPaymentService } from '../providers/manual/manual-payment.service';
import { PolicyService } from '@/common/authz/policy.service';
import { AuditService } from '@/common/authz/audit.service';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import {
  ADMIN_A,
  STUDENT_A,
  STUDENT_B,
  TEACHER_A,
  asUser,
  createHttpApp,
} from '@/test-utils/http-harness';

const INTENT_ID = '44444444-4444-4444-8444-444444444444';
const SUBMISSION_ID = '55555555-5555-4555-8555-555555555555';

const PROOF = {
  url: 'https://res.cloudinary.com/demo/image/upload/images/student-a-proof.png',
  fileId: 'images/student-a-proof',
};

describe('Payments HTTP contract', () => {
  let app: INestApplication;
  let payments: Record<'listMethods' | 'present' | 'reconcile' | 'expireDue', jest.Mock>;
  let manual: Record<'submit' | 'listForIntent' | 'queue' | 'findOne' | 'startReview' | 'approve' | 'reject', jest.Mock>;
  let prisma: { paymentIntent: { findUnique: jest.Mock } };
  let audit: { record: jest.Mock };

  const intentRow = (ownerId: string) => ({
    id: INTENT_ID,
    orderId: 'order-1',
    provider: 'MANUAL',
    status: 'PENDING',
    order: { userId: ownerId },
  });

  beforeEach(async () => {
    payments = {
      listMethods: jest.fn().mockReturnValue({ provider: 'MANUAL', capabilities: {}, methods: [] }),
      present: jest.fn().mockReturnValue({ type: 'MANUAL_INSTRUCTIONS', data: {} }),
      reconcile: jest.fn().mockResolvedValue({ consistent: true, discrepancies: [] }),
      expireDue: jest.fn().mockResolvedValue(3),
    };
    manual = {
      submit: jest.fn().mockResolvedValue({ message: 'ok', data: {} }),
      listForIntent: jest.fn().mockResolvedValue({ message: 'ok', data: [] }),
      queue: jest.fn().mockResolvedValue({ message: 'ok', data: {} }),
      findOne: jest.fn().mockResolvedValue({ message: 'ok', data: {} }),
      startReview: jest.fn().mockResolvedValue({ message: 'ok', data: {} }),
      approve: jest.fn().mockResolvedValue({ message: 'ok', data: {} }),
      reject: jest.fn().mockResolvedValue({ message: 'ok', data: {} }),
    };
    prisma = { paymentIntent: { findUnique: jest.fn().mockResolvedValue(intentRow(STUDENT_A.id)) } };
    audit = { record: jest.fn().mockResolvedValue({}) };

    app = await createHttpApp({
      controllers: [PaymentsController, AdminPaymentsController, PaymentWebhookController],
      withOwnershipGuard: true,
      providers: [
        PolicyService,
        { provide: PaymentService, useValue: payments },
        { provide: ManualPaymentService, useValue: manual },
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  describe('buyer endpoints', () => {
    it('lists payment methods for any logged-in user only', async () => {
      await http().get('/payments/methods').expect(401);
      await http().get('/payments/methods').set(asUser(STUDENT_A)).expect(200);
    });

    it('shows a payment to its buyer and to an administrator, never to another user', async () => {
      await http().get(`/payments/intents/${INTENT_ID}`).set(asUser(STUDENT_A)).expect(200);
      await http().get(`/payments/intents/${INTENT_ID}`).set(asUser(ADMIN_A)).expect(200);
      await http().get(`/payments/intents/${INTENT_ID}`).set(asUser(STUDENT_B)).expect(403);
      await http().get(`/payments/intents/${INTENT_ID}`).set(asUser(TEACHER_A)).expect(403);
      await http().get(`/payments/intents/${INTENT_ID}`).expect(401);
    });

    it('does not reveal whether a payment exists to a stranger', async () => {
      prisma.paymentIntent.findUnique.mockResolvedValue(null);
      await http().get(`/payments/intents/${INTENT_ID}`).set(asUser(STUDENT_B)).expect(403);
    });

    it('does not leak the order relation in the payment payload', async () => {
      prisma.paymentIntent.findUnique.mockResolvedValue({ ...intentRow(STUDENT_A.id), metadata: { method: null } });
      const res = await http().get(`/payments/intents/${INTENT_ID}`).set(asUser(STUDENT_A)).expect(200);
      expect(JSON.stringify(res.body)).not.toContain('"order":');
      expect(res.body.data.presentation).toEqual({ type: 'MANUAL_INSTRUCTIONS', data: {} });
    });

    it('only the buyer may submit a proof', async () => {
      const body = { paymentMethod: 'BANK_TRANSFER', proof: PROOF };
      await http().post(`/payments/manual/intents/${INTENT_ID}/submissions`).send(body).expect(401);
      await http().post(`/payments/manual/intents/${INTENT_ID}/submissions`).set(asUser(STUDENT_B)).send(body).expect(403);
      await http().post(`/payments/manual/intents/${INTENT_ID}/submissions`).set(asUser(TEACHER_A)).send(body).expect(403);
      expect(manual.submit).not.toHaveBeenCalled();

      await http()
        .post(`/payments/manual/intents/${INTENT_ID}/submissions`)
        .set({ ...asUser(STUDENT_A), 'x-trace-id': 'trace-7' })
        .send(body)
        .expect(201);
      expect(manual.submit).toHaveBeenCalledWith(
        expect.objectContaining({ id: STUDENT_A.id }),
        INTENT_ID,
        body,
        'trace-7',
      );
    });

    it.each([
      ['a client supplied amount', { paymentMethod: 'BANK_TRANSFER', proof: PROOF, amount: 1 }],
      ['a client supplied status', { paymentMethod: 'BANK_TRANSFER', proof: PROOF, status: 'APPROVED' }],
      ['no proof', { paymentMethod: 'BANK_TRANSFER' }],
      ['a proof that is not a URL', { paymentMethod: 'BANK_TRANSFER', proof: { url: 'javascript:alert(1)', fileId: 'images/x' } }],
      ['a proof served over plain http', { paymentMethod: 'BANK_TRANSFER', proof: { url: 'http://res.cloudinary.com/x.png', fileId: 'images/x' } }],
      ['a proof pointing at a data URL', { paymentMethod: 'BANK_TRANSFER', proof: { url: 'data:text/html;base64,AAAA', fileId: 'images/x' } }],
      ['a proof with extra fields', { paymentMethod: 'BANK_TRANSFER', proof: { ...PROOF, reviewed: true } }],
      ['a lower-case method', { paymentMethod: 'bank', proof: PROOF }],
      ['an over-long note', { paymentMethod: 'BANK_TRANSFER', proof: PROOF, note: 'x'.repeat(501) }],
    ])('rejects %s', async (_label, body) => {
      await http().post(`/payments/manual/intents/${INTENT_ID}/submissions`).set(asUser(STUDENT_A)).send(body).expect(400);
      expect(manual.submit).not.toHaveBeenCalled();
    });

    it('rejects a malformed payment id', async () => {
      await http().get('/payments/intents/not-a-uuid').set(asUser(ADMIN_A)).expect(400);
    });

    it('lets the buyer read only their own submissions', async () => {
      await http().get(`/payments/manual/intents/${INTENT_ID}/submissions`).set(asUser(STUDENT_B)).expect(403);
      await http().get(`/payments/manual/intents/${INTENT_ID}/submissions`).set(asUser(STUDENT_A)).expect(200);
      expect(manual.listForIntent).toHaveBeenCalledTimes(1);
    });
  });

  describe('administrator endpoints', () => {
    const commands: Array<[string, string, object | null]> = [
      ['get', '/admin/payments/manual/submissions', null],
      ['get', `/admin/payments/manual/submissions/${SUBMISSION_ID}`, null],
      ['post', `/admin/payments/manual/submissions/${SUBMISSION_ID}/start-review`, {}],
      ['post', `/admin/payments/manual/submissions/${SUBMISSION_ID}/approve`, { reason: 'Proof verified' }],
      ['post', `/admin/payments/manual/submissions/${SUBMISSION_ID}/reject`, { reason: 'Proof unreadable' }],
      ['post', `/admin/payments/intents/${INTENT_ID}/reconcile`, {}],
      ['post', '/admin/payments/expire-due', {}],
    ];

    const call = (method: string, path: string, body?: object | null, actor?: object) => {
      let req = (http() as any)[method](path);
      if (actor) req = req.set(asUser(actor as never));
      return method === 'get' ? req : req.send(body ?? {});
    };

    it.each(commands)('%s %s requires a login', async (method, path, body) => {
      await call(method, path, body).expect(401);
    });

    it.each(commands)('%s %s is closed to students and teachers', async (method, path, body) => {
      for (const actor of [STUDENT_A, STUDENT_B, TEACHER_A]) {
        await call(method, path, body, actor).expect(403);
      }
      expect(Object.values(manual).every((fn) => fn.mock.calls.length === 0)).toBe(true);
      expect(payments.reconcile).not.toHaveBeenCalled();
      expect(payments.expireDue).not.toHaveBeenCalled();
    });

    it('an administrator approves with a reason and a trace id', async () => {
      await http()
        .post(`/admin/payments/manual/submissions/${SUBMISSION_ID}/approve`)
        .set({ ...asUser(ADMIN_A), 'x-trace-id': 'trace-a' })
        .send({ reason: 'Transfer matches statement' })
        .expect(201);
      expect(manual.approve).toHaveBeenCalledWith(
        expect.objectContaining({ id: ADMIN_A.id }),
        SUBMISSION_ID,
        'Transfer matches statement',
        'trace-a',
      );
    });

    it('requires a reason and forbids extra fields on approval', async () => {
      const path = `/admin/payments/manual/submissions/${SUBMISSION_ID}/approve`;
      await http().post(path).set(asUser(ADMIN_A)).send({}).expect(400);
      await http().post(path).set(asUser(ADMIN_A)).send({ reason: 'ok' }).expect(400);
      await http().post(path).set(asUser(ADMIN_A)).send({ reason: 'verified', amount: 5 }).expect(400);
      expect(manual.approve).not.toHaveBeenCalled();
    });

    it('rejects with resubmission allowed by default and honours an explicit final rejection', async () => {
      const path = `/admin/payments/manual/submissions/${SUBMISSION_ID}/reject`;
      await http().post(path).set(asUser(ADMIN_A)).send({ reason: 'Proof unreadable' }).expect(201);
      expect(manual.reject).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: ADMIN_A.id }),
        SUBMISSION_ID,
        { reason: 'Proof unreadable', allowResubmit: true },
        expect.any(String),
      );

      await http().post(path).set(asUser(ADMIN_A)).send({ reason: 'Fraud suspected', allowResubmit: false }).expect(201);
      expect(manual.reject).toHaveBeenLastCalledWith(
        expect.anything(),
        SUBMISSION_ID,
        { reason: 'Fraud suspected', allowResubmit: false },
        expect.any(String),
      );

      await http().post(path).set(asUser(ADMIN_A)).send({ reason: 'Fraud suspected', allowResubmit: 'no' }).expect(400);
    });

    it('validates the queue filter', async () => {
      await http().get('/admin/payments/manual/submissions?status=APPROVED&limit=10').set(asUser(ADMIN_A)).expect(200);
      expect(manual.queue).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: ADMIN_A.id }),
        expect.objectContaining({ status: 'APPROVED', limit: 10, page: 1 }),
      );
      await http().get('/admin/payments/manual/submissions?status=PAID').set(asUser(ADMIN_A)).expect(400);
      await http().get('/admin/payments/manual/submissions?limit=1000').set(asUser(ADMIN_A)).expect(400);
    });

    it('reconciles and sweeps expired payments with an audit trail for the sweep', async () => {
      const reconciled = await http().post(`/admin/payments/intents/${INTENT_ID}/reconcile`).set(asUser(ADMIN_A)).send({}).expect(201);
      expect(reconciled.body.data).toEqual({ consistent: true, discrepancies: [] });
      expect(payments.reconcile).toHaveBeenCalledWith(
        INTENT_ID,
        expect.objectContaining({ actor: { kind: 'ADMIN', id: ADMIN_A.id, role: 'ADMIN' } }),
      );

      const swept = await http().post('/admin/payments/expire-due').set(asUser(ADMIN_A)).send({}).expect(201);
      expect(swept.body.data).toEqual({ expired: 3 });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYMENT_EXPIRE_SWEEP', actorId: ADMIN_A.id, after: { expired: 3 } }),
      );
    });
  });

  describe('provider webhooks', () => {
    it('are reserved but not enabled: every provider gets 501 and no state changes', async () => {
      for (const provider of ['midtrans', 'stripe', 'xendit', 'manual']) {
        const res = await http().post(`/webhooks/payments/${provider}`).send({ status: 'settlement' }).expect(501);
        expect(JSON.stringify(res.body)).toContain('PAYMENT_PROVIDER_UNAVAILABLE');
      }
      expect(Object.values(manual).every((fn) => fn.mock.calls.length === 0)).toBe(true);
    });

    it('the old Stripe webhook route is gone', async () => {
      await http().post('/webhooks/stripe').send({}).expect(404);
    });
  });
});
