import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import { InternalResourcesController } from '../internal-resources.controller';
import { ResourcesService } from '../../material/resources/resources.service';
import { InternalServiceGuard, MAX_CLOCK_SKEW_MS } from '@/common/authz/internal-service.guard';
import {
  IDEMPOTENCY_KEY_HEADER,
  SERVICE_ID_HEADER,
  SERVICE_SIGNATURE_HEADER,
  SERVICE_TIMESTAMP_HEADER,
  computeSignature,
} from '@/common/authz/internal-signature';
import { ADMIN_A, STUDENT_A, TEACHER_A, asUser, createHttpApp } from '@/test-utils/http-harness';

const SECRET = 'unit-test-service-secret';
const RESOURCE_ID = '99999999-9999-4999-8999-999999999999';

describe('Internal service authentication', () => {
  let app: INestApplication;
  let resources: { findOne: jest.Mock; callback: jest.Mock };

  const sign = (options: {
    method: 'GET' | 'POST';
    target: string;
    body?: string;
    timestamp?: string;
    secret?: string;
    serviceId?: string;
    idempotencyKey?: string | null;
  }) => {
    const timestamp = options.timestamp ?? String(Date.now());
    const signature = computeSignature({
      secret: options.secret ?? SECRET,
      timestamp,
      method: options.method,
      target: options.target,
      body: Buffer.from(options.body ?? ''),
    });
    const headers: Record<string, string> = {
      [SERVICE_ID_HEADER]: options.serviceId ?? 'ai-api',
      [SERVICE_TIMESTAMP_HEADER]: timestamp,
      [SERVICE_SIGNATURE_HEADER]: signature,
    };
    if (options.idempotencyKey !== null && options.method !== 'GET') {
      headers[IDEMPOTENCY_KEY_HEADER] = options.idempotencyKey ?? `key-${Math.random()}`;
    }
    return headers;
  };

  const callbackTarget = '/internal/resources/callback?type=EXTRACT';
  const callbackBody = JSON.stringify({ resourceId: RESOURCE_ID, status: 'SUCCESS' });

  const postCallback = (headers: Record<string, string>, body = callbackBody, target = callbackTarget) =>
    request(app.getHttpServer()).post(target).set(headers).set('content-type', 'application/json').send(body);

  beforeEach(async () => {
    resources = {
      findOne: jest.fn().mockResolvedValue({ data: { id: RESOURCE_ID } }),
      callback: jest.fn().mockResolvedValue({ message: 'ok', data: null }),
    };
    app = await createHttpApp({
      controllers: [InternalResourcesController],
      rawBody: true,
      providers: [
        InternalServiceGuard,
        { provide: ResourcesService, useValue: resources },
        { provide: ConfigService, useValue: { get: (key: string) => (key === 'INTERNAL_AI_API_SECRET' ? SECRET : undefined) } },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('accepts a correctly signed read', async () => {
    const target = `/internal/resources/${RESOURCE_ID}`;
    await request(app.getHttpServer()).get(target).set(sign({ method: 'GET', target })).expect(200);
    expect(resources.findOne).toHaveBeenCalledWith(RESOURCE_ID);
  });

  it('accepts a correctly signed callback and passes validated input on', async () => {
    await postCallback(sign({ method: 'POST', target: callbackTarget, body: callbackBody })).expect(201);
    expect(resources.callback).toHaveBeenCalledWith('EXTRACT', { resourceId: RESOURCE_ID, status: 'SUCCESS' });
  });

  it('rejects requests without service credentials', async () => {
    await request(app.getHttpServer()).get(`/internal/resources/${RESOURCE_ID}`).expect(401);
    await postCallback({}).expect(401);
    expect(resources.callback).not.toHaveBeenCalled();
  });

  it.each([
    ['a user session, whatever its role', ADMIN_A],
    ['a student session', STUDENT_A],
    ['a teacher session', TEACHER_A],
  ])('%s does not grant access to internal routes', async (_label, user) => {
    await request(app.getHttpServer())
      .get(`/internal/resources/${RESOURCE_ID}`)
      .set(asUser(user))
      .expect(401);
    expect(resources.findOne).not.toHaveBeenCalled();
  });

  it('rejects an unknown service id', async () => {
    const target = `/internal/resources/${RESOURCE_ID}`;
    await request(app.getHttpServer())
      .get(target)
      .set(sign({ method: 'GET', target, serviceId: 'rogue-service' }))
      .expect(401);
  });

  it('rejects a signature made with the wrong secret', async () => {
    await postCallback(sign({ method: 'POST', target: callbackTarget, body: callbackBody, secret: 'wrong' })).expect(401);
    expect(resources.callback).not.toHaveBeenCalled();
  });

  it('rejects a tampered body', async () => {
    const tampered = JSON.stringify({ resourceId: RESOURCE_ID, status: 'FAILED' });
    await postCallback(sign({ method: 'POST', target: callbackTarget, body: callbackBody }), tampered).expect(401);
    expect(resources.callback).not.toHaveBeenCalled();
  });

  it('rejects a tampered path or query', async () => {
    const headers = sign({ method: 'POST', target: callbackTarget, body: callbackBody });
    await postCallback(headers, callbackBody, '/internal/resources/callback?type=EMMBED').expect(401);
    expect(resources.callback).not.toHaveBeenCalled();
  });

  it('rejects stale and future-dated requests', async () => {
    const target = `/internal/resources/${RESOURCE_ID}`;
    const stale = String(Date.now() - MAX_CLOCK_SKEW_MS - 5_000);
    const future = String(Date.now() + MAX_CLOCK_SKEW_MS + 5_000);
    await request(app.getHttpServer()).get(target).set(sign({ method: 'GET', target, timestamp: stale })).expect(401);
    await request(app.getHttpServer()).get(target).set(sign({ method: 'GET', target, timestamp: future })).expect(401);
    await request(app.getHttpServer()).get(target).set(sign({ method: 'GET', target, timestamp: 'not-a-number' })).expect(401);
  });

  it('rejects mutations without an idempotency key', async () => {
    await postCallback(sign({ method: 'POST', target: callbackTarget, body: callbackBody, idempotencyKey: null })).expect(401);
    expect(resources.callback).not.toHaveBeenCalled();
  });

  it('rejects an exact replay of a valid request', async () => {
    const headers = sign({ method: 'POST', target: callbackTarget, body: callbackBody });
    await postCallback(headers).expect(201);
    await postCallback(headers).expect(401);
    expect(resources.callback).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the service secret is not configured', async () => {
    const unconfigured = await createHttpApp({
      controllers: [InternalResourcesController],
      rawBody: true,
      providers: [
        InternalServiceGuard,
        { provide: ResourcesService, useValue: resources },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    });
    const target = `/internal/resources/${RESOURCE_ID}`;
    await request(unconfigured.getHttpServer()).get(target).set(sign({ method: 'GET', target })).expect(401);
    await unconfigured.close();
  });

  it('validates the callback payload after authentication', async () => {
    const bad = JSON.stringify({ resourceId: 'not-a-uuid', extra: true });
    await postCallback(sign({ method: 'POST', target: callbackTarget, body: bad }), bad).expect(400);
    expect(resources.callback).not.toHaveBeenCalled();
  });
});
