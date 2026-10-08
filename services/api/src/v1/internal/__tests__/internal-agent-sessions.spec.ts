import { randomUUID } from 'crypto';
import * as request from 'supertest';
import {
  IDEMPOTENCY_KEY_HEADER,
  SERVICE_ID_HEADER,
  SERVICE_SIGNATURE_HEADER,
  SERVICE_TIMESTAMP_HEADER,
  computeSignature,
} from '@/common/authz/internal-signature';
import { InternalAgentSessionsController } from '../internal-agent-sessions.controller';
import { createHttpApp } from '@/test-utils/http-harness';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@/common/config/redis/redis.service';

const TEST_SECRET = 'test-internal-secret-32chars-long-padding';
const SERVICE_ID = 'ai-api';

function sign(method: string, target: string, body: string) {
  const ts = String(Date.now());
  const sig = computeSignature({
    secret: TEST_SECRET,
    timestamp: ts,
    method,
    target,
    body: Buffer.from(body),
  });
  return {
    [SERVICE_ID_HEADER]: SERVICE_ID,
    [SERVICE_TIMESTAMP_HEADER]: ts,
    [SERVICE_SIGNATURE_HEADER]: sig,
  };
}

const fakeRedis = {
  set: jest.fn(async () => 'OK'),
  get: jest.fn(async () => null),
  del: jest.fn(async () => 0),
  ping: jest.fn(async () => 'PONG'),
  quit: jest.fn(async () => 'OK'),
  on: jest.fn(),
} as any;

describe('InternalAgentSessionsController', () => {
  let app: Awaited<ReturnType<typeof createHttpApp>>;
  const mintTarget = '/internal/agent-sessions';
  const resolveBodyTarget = '/internal/agent-sessions/resolve';

  beforeEach(async () => {
    fakeRedis.set.mockReset();
    fakeRedis.set.mockResolvedValue('OK');
    app = await createHttpApp({
      controllers: [InternalAgentSessionsController],
      rawBody: true,
      providers: [
        { provide: ConfigService, useValue: { get: (key: string) => (key === 'INTERNAL_AI_API_SECRET' ? TEST_SECRET : undefined) } },
        { provide: RedisService, useValue: { client: fakeRedis } },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects unsigned requests with 401', async () => {
    await request(app.getHttpServer()).post(mintTarget).send({}).expect(401);
  });

  it('mints a session and returns sessionId + tenantId (16-hex)', async () => {
    const payload = { acting_user_id: 'user-a', ttl_seconds: 60 };
    const body = JSON.stringify(payload);
    const res = await request(app.getHttpServer())
      .post(mintTarget)
      .set(sign('POST', mintTarget, body))
      .set('content-type', 'application/json')
      .set(IDEMPOTENCY_KEY_HEADER, 'e2e-mint-001')
      .send(body)
      .expect(201);
    expect(res.body.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.actingUserId).toBe('user-a');
    expect(res.body.tenantId).toMatch(/^[0-9a-f]{16}$/);
    expect(res.body.expiresAtMs).toBeGreaterThan(res.body.issuedAtMs);
  });

  it('resolves a fresh session via POST /resolve', async () => {
    const mintBody = JSON.stringify({ acting_user_id: 'user-b', ttl_seconds: 60 });
    const mint = await request(app.getHttpServer())
      .post(mintTarget)
      .set(sign('POST', mintTarget, mintBody))
      .set('content-type', 'application/json')
      .set(IDEMPOTENCY_KEY_HEADER, 'e2e-mint-002')
      .send(mintBody)
      .expect(201);
    const sessionId = mint.body.sessionId;

    const resolveBody = JSON.stringify({ session_id: sessionId });
    const res = await request(app.getHttpServer())
      .post(resolveBodyTarget)
      .set(sign('POST', resolveBodyTarget, resolveBody))
      .set('content-type', 'application/json')
      .set(IDEMPOTENCY_KEY_HEADER, 'e2e-resolve-001')
      .send(resolveBody)
      .expect(200);
    expect(res.body.found).toBe(true);
    expect(res.body.sessionId).toBe(sessionId);
    expect(res.body.actingUserId).toBe('user-b');
  });

  it('resolves a session via GET /{id}/resolve', async () => {
    const mintBody = JSON.stringify({ acting_user_id: 'user-c', ttl_seconds: 60 });
    const mint = await request(app.getHttpServer())
      .post(mintTarget)
      .set(sign('POST', mintTarget, mintBody))
      .set('content-type', 'application/json')
      .set(IDEMPOTENCY_KEY_HEADER, 'e2e-mint-003')
      .send(mintBody)
      .expect(201);
    const sessionId = mint.body.sessionId;
    const pathTarget = `/internal/agent-sessions/${sessionId}/resolve`;
    const res = await request(app.getHttpServer())
      .get(pathTarget)
      .set(sign('GET', pathTarget, ''))
      .expect(200);
    expect(res.body.found).toBe(true);
  });

  it('returns found=false for an unknown session id', async () => {
    const pathTarget = `/internal/agent-sessions/00000000-0000-0000-0000-000000000000/resolve`;
    const res = await request(app.getHttpServer())
      .get(pathTarget)
      .set(sign('GET', pathTarget, ''))
      .expect(200);
    expect(res.body.found).toBe(false);
  });

  it('rejects ttl_seconds above 900', async () => {
    const body = JSON.stringify({ acting_user_id: 'user-d', ttl_seconds: 3600 });
    await request(app.getHttpServer())
      .post(mintTarget)
      .set(sign('POST', mintTarget, body))
      .set('content-type', 'application/json')
      .set(IDEMPOTENCY_KEY_HEADER, 'e2e-ttl-001')
      .send(body)
      .expect(400);
  });

  it('rejects unknown fields via .strict()', async () => {
    const body = JSON.stringify({ acting_user_id: 'user-e', not_a_field: 'x' });
    await request(app.getHttpServer())
      .post(mintTarget)
      .set(sign('POST', mintTarget, body))
      .set('content-type', 'application/json')
      .set(IDEMPOTENCY_KEY_HEADER, 'e2e-strict-001')
      .send(body)
      .expect(400);
  });
});
