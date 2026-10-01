import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { OrdersController } from '../orders.controller';
import { OrdersService } from '../orders.service';
import {
  ADMIN_A,
  STUDENT_A,
  TEACHER_A,
  asUser,
  createHttpApp,
} from '@/test-utils/http-harness';
import { PolicyService } from '@/common/authz/policy.service';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const TOPIC_ID = '22222222-2222-4222-8222-222222222222';
const ARTICLE_ID = '33333333-3333-4333-8333-333333333333';

describe('Orders HTTP contract', () => {
  let app: INestApplication;
  let service: Record<'create' | 'findAll' | 'findOne' | 'cancelOrder', jest.Mock>;

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ message: 'ok', data: { id: ORDER_ID } }),
      findAll: jest.fn().mockResolvedValue({ message: 'ok', data: { data: [], pagination: {} } }),
      findOne: jest.fn().mockResolvedValue({ message: 'ok', data: { id: ORDER_ID } }),
      cancelOrder: jest.fn().mockResolvedValue({ message: 'ok', data: { id: ORDER_ID } }),
    };
    app = await createHttpApp({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: service }],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  describe('authentication', () => {
    it.each([
      ['post', '/orders'],
      ['get', '/orders'],
      ['get', `/orders/${ORDER_ID}`],
      ['post', `/orders/${ORDER_ID}/cancel`],
    ])('%s %s requires a login', async (method, path) => {
      await (http() as any)[method](path).send({}).expect(401);
      expect(Object.values(service).every((fn) => fn.mock.calls.length === 0)).toBe(true);
    });
  });

  describe('order tampering surface', () => {
    it.each([
      ['patch', `/orders/${ORDER_ID}`],
      ['delete', `/orders/${ORDER_ID}`],
      ['post', `/orders/${ORDER_ID}/approve-payment`],
      ['post', `/orders/${ORDER_ID}/reject-payment`],
      ['post', `/orders/${ORDER_ID}/refund`],
    ])('%s %s does not exist, even for an administrator', async (method, path) => {
      await (http() as any)[method](path).set(asUser(ADMIN_A)).send({ reason: 'anything', status: 'PAID' }).expect(404);
      await (http() as any)[method](path).set(asUser(STUDENT_A)).send({ reason: 'anything', status: 'PAID' }).expect(404);
    });

    it('the order controller exposes no status-changing command besides cancel', () => {
      const routes = Object.getOwnPropertyNames(OrdersController.prototype).filter((name) => name !== 'constructor');
      expect(routes.sort()).toEqual(['cancel', 'create', 'findAll', 'findOne']);
    });
  });

  describe('creating an order', () => {
    it('passes the authenticated user and a trace id to the service', async () => {
      await http()
        .post('/orders')
        .set({ ...asUser(STUDENT_A), 'x-trace-id': 'trace-42' })
        .send({ items: [{ type: 'ARTICLE', id: ARTICLE_ID }], paymentMethod: 'BANK_TRANSFER' })
        .expect(201);

      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: STUDENT_A.id }),
        { items: [{ type: 'ARTICLE', id: ARTICLE_ID }], paymentMethod: 'BANK_TRANSFER' },
        'trace-42',
      );
    });

    it('accepts the legacy single-topic body and ignores extra client fields', async () => {
      await http()
        .post('/orders')
        .set(asUser(STUDENT_A))
        .send({ userId: 'someone-else', topicId: TOPIC_ID, amount: 1, total: 1, status: 'PAID' })
        .expect(201);

      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: STUDENT_A.id }),
        { topicId: TOPIC_ID },
        expect.any(String),
      );
    });

    it.each([
      ['no product', {}],
      ['both topicId and items', { topicId: TOPIC_ID, items: [{ type: 'ARTICLE', id: ARTICLE_ID }] }],
      ['an empty cart', { items: [] }],
      ['too many items', { items: Array.from({ length: 11 }, () => ({ type: 'ARTICLE', id: ARTICLE_ID })) }],
      ['an unknown product kind', { items: [{ type: 'COURSE', id: ARTICLE_ID }] }],
      ['a price on the item', { items: [{ type: 'ARTICLE', id: ARTICLE_ID, price: 1 }] }],
      ['a quantity on the item', { items: [{ type: 'ARTICLE', id: ARTICLE_ID, quantity: 5 }] }],
      ['a malformed product id', { items: [{ type: 'ARTICLE', id: 'not-a-uuid' }] }],
      ['a lower-case payment method', { topicId: TOPIC_ID, paymentMethod: 'bank transfer' }],
    ])('rejects %s', async (_label, body) => {
      await http().post('/orders').set(asUser(STUDENT_A)).send(body).expect(400);
      expect(service.create).not.toHaveBeenCalled();
    });
  });

  describe('reading orders', () => {
    it('rejects a malformed order id before reaching the service', async () => {
      await http().get('/orders/not-a-uuid').set(asUser(STUDENT_A)).expect(400);
      await http().post('/orders/not-a-uuid/cancel').set(asUser(STUDENT_A)).expect(400);
      expect(service.findOne).not.toHaveBeenCalled();
      expect(service.cancelOrder).not.toHaveBeenCalled();
    });

    it('hands the caller to the service, which decides ownership', async () => {
      await http().get(`/orders/${ORDER_ID}?include=topic`).set(asUser(TEACHER_A)).expect(200);
      expect(service.findOne).toHaveBeenCalledWith(expect.objectContaining({ id: TEACHER_A.id }), ORDER_ID, 'topic');

      await http().get('/orders?page=2&limit=5').set(asUser(STUDENT_A)).expect(200);
      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ id: STUDENT_A.id }),
        expect.objectContaining({ page: 2, limit: 5 }),
      );
    });
  });

  describe('cancelling', () => {
    it('passes the caller and trace to the service', async () => {
      await http().post(`/orders/${ORDER_ID}/cancel`).set({ ...asUser(STUDENT_A), 'x-trace-id': 't-9' }).expect(201);
      expect(service.cancelOrder).toHaveBeenCalledWith(expect.objectContaining({ id: STUDENT_A.id }), ORDER_ID, 't-9');
    });
  });
});

describe('OrdersService read scoping', () => {
  const build = () => {
    const repo = {
      list: jest.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }),
      findById: jest.fn(),
    };
    const payments = { findLatestForOrder: jest.fn().mockResolvedValue(null), present: jest.fn() };
    const { OrdersService: Service } = jest.requireActual('../orders.service');
    const service = new Service(
      repo,
      {},
      {},
      payments,
      {},
      {},
      {},
      new PolicyService(),
      {},
    ) as OrdersService;
    return { service, repo, payments };
  };

  it('a student can only list their own orders', async () => {
    const { service, repo } = build();
    await service.findAll(STUDENT_A, { page: 1, limit: 10 });
    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ userId: STUDENT_A.id }));

    await expect(service.findAll(STUDENT_A, { page: 1, limit: 10, userId: 'student-b' })).rejects.toMatchObject({
      status: 403,
    });
  });

  it('an administrator may list any user, or everyone', async () => {
    const { service, repo } = build();
    await service.findAll(ADMIN_A, { page: 1, limit: 10, userId: 'student-b' });
    expect(repo.list).toHaveBeenLastCalledWith(expect.objectContaining({ userId: 'student-b' }));
    await service.findAll(ADMIN_A, { page: 1, limit: 10 });
    expect(repo.list).toHaveBeenLastCalledWith(expect.objectContaining({ userId: undefined }));
  });

  it("another user's order looks like it does not exist", async () => {
    const { service, repo } = build();
    repo.findById.mockResolvedValue({ id: ORDER_ID, userId: 'student-b', items: [] });
    await expect(service.findOne(STUDENT_A, ORDER_ID)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.findOne(ADMIN_A, ORDER_ID)).resolves.toBeDefined();
  });
});
