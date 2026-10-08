import { randomUUID } from 'crypto';
import * as request from 'supertest';
import {
  IDEMPOTENCY_KEY_HEADER,
  SERVICE_ID_HEADER,
  SERVICE_SIGNATURE_HEADER,
  SERVICE_TIMESTAMP_HEADER,
  computeSignature,
} from '@/common/authz/internal-signature';
import { InternalDecisionTracesController } from '../internal-decision-traces.controller';
import { createHttpApp } from '@/test-utils/http-harness';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { RedisService } from '@/common/config/redis/redis.service';

const TEST_SECRET = 'test-internal-secret-32chars-long-padding';
const SERVICE_ID = 'ai-api';
const target = '/internal/decision-traces';

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

describe('InternalDecisionTracesController', () => {
  let app: Awaited<ReturnType<typeof createHttpApp>>;
  const traceStore = new Map<string, any>();
  const decisionTraceUpsertMock = jest.fn(async ({ where, create, update }: any) => {
    const existing = traceStore.get(where.traceId);
    if (existing) {
      Object.assign(existing, update, { id: existing.id, createdAt: existing.createdAt });
      return { id: existing.id, traceId: existing.traceId, createdAt: existing.createdAt };
    }
    const row = { id: randomUUID(), traceId: where.traceId, createdAt: new Date(), ...create };
    traceStore.set(where.traceId, row);
    return { id: row.id, traceId: row.traceId, createdAt: row.createdAt };
  });

  beforeEach(async () => {
    traceStore.clear();
    decisionTraceUpsertMock.mockClear();
    fakeRedis.set.mockReset();
    fakeRedis.set.mockResolvedValue('OK');
    app = await createHttpApp({
      controllers: [InternalDecisionTracesController],
      rawBody: true,
      providers: [
        { provide: ConfigService, useValue: { get: (key: string) => (key === 'INTERNAL_AI_API_SECRET' ? TEST_SECRET : undefined) } },
        { provide: PrismaService, useValue: { decisionTrace: { upsert: decisionTraceUpsertMock } } },
        { provide: RedisService, useValue: { client: fakeRedis } },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects unsigned requests with 401', async () => {
    await request(app.getHttpServer()).post(target).send({}).expect(401);
  });

  it('creates a decision trace and returns 201', async () => {
    const payload = {
      trace_id: randomUUID(),
      session_id: randomUUID(),
      acting_user_id: 'user-z',
      tenant_id: 'tenant-test',
      agent_name: 'tutor',
      agent_scope: 'lesson-journal',
      prompt_hash: 'sha256:abc',
      response_hash: 'sha256:def',
      tool_calls: [{ name: 'rag_retrieve', args: { lessonId: 'lesson-journal' } }],
      deterministic_outputs: { retrieved_count: 3 },
      policy_version: 'policy-v1',
      prompt_version: 'tutor-v1',
      reason_codes: ['RAG_HIT', 'BALANCE_VALIDATED'],
      selected_action: 'tutor_explain',
      metadata: { e2e: true },
    };
    const body = JSON.stringify(payload);
    const res = await request(app.getHttpServer())
      .post(target)
      .set(sign('POST', target, body))
      .set('content-type', 'application/json')
      .set(IDEMPOTENCY_KEY_HEADER, 'e2e-dt-001')
      .set('Idempotency-Key', 'e2e-dt-001')
      .send(body)
      .expect(201);
    expect(res.body.decisionTraceId).toBeDefined();
    expect(res.body.traceId).toBe(payload.trace_id);

    const callArg = decisionTraceUpsertMock.mock.calls[0][0];
    expect(callArg.create.traceId).toBe(payload.trace_id);
    expect(callArg.create.userId).toBe('user-z');
    expect(callArg.create.agentVersion).toBe('tutor:lesson-journal');
    expect(callArg.create.policyVersion).toBe('policy-v1');
  });

  it('upserts idempotently on the same traceId (no duplicate)', async () => {
    const traceId = randomUUID();
    const base = {
      trace_id: traceId,
      session_id: randomUUID(),
      acting_user_id: 'user-z',
      agent_name: 'tutor',
      prompt_hash: 'sha256:abc',
      policy_version: 'policy-v1',
      prompt_version: 'tutor-v1',
    };
    const body1 = JSON.stringify(base);
    await request(app.getHttpServer())
      .post(target)
      .set(sign('POST', target, body1))
      .set('content-type', 'application/json')
      .set(IDEMPOTENCY_KEY_HEADER, 'e2e-dt-upsert-1')
      .set('Idempotency-Key', 'e2e-dt-upsert-1')
      .send(body1)
      .expect(201);

    const updated = { ...base, policy_version: 'policy-v2' };
    const body2 = JSON.stringify(updated);
    await request(app.getHttpServer())
      .post(target)
      .set(sign('POST', target, body2))
      .set('content-type', 'application/json')
      .set(IDEMPOTENCY_KEY_HEADER, 'e2e-dt-upsert-2')
      .set('Idempotency-Key', 'e2e-dt-upsert-2')
      .send(body2)
      .expect(201);

    expect(decisionTraceUpsertMock).toHaveBeenCalledTimes(2);
    expect(traceStore.size).toBe(1);
    expect(traceStore.get(traceId).policyVersion).toBe('policy-v2');
  });

  it('rejects missing prompt_hash with 400 (zod required)', async () => {
    const body = JSON.stringify({
      trace_id: randomUUID(),
      acting_user_id: 'user-z',
      agent_name: 'tutor',
    });
    await request(app.getHttpServer())
      .post(target)
      .set(sign('POST', target, body))
      .set('content-type', 'application/json')
      .set(IDEMPOTENCY_KEY_HEADER, 'e2e-dt-400-1')
      .set('Idempotency-Key', 'e2e-dt-400-1')
      .send(body)
      .expect(400);
  });
});
