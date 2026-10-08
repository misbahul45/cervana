import { randomUUID } from 'crypto';
import * as request from 'supertest';
import {
  IDEMPOTENCY_KEY_HEADER,
  SERVICE_ID_HEADER,
  SERVICE_SIGNATURE_HEADER,
  SERVICE_TIMESTAMP_HEADER,
  computeSignature,
} from '@/common/authz/internal-signature';
import { InternalEpisodesController } from '../internal-episodes.controller';
import { createHttpApp } from '@/test-utils/http-harness';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { IdempotencyService } from '@/common/idempotency/idempotency.service';
import { RedisService } from '@/common/config/redis/redis.service';

const TEST_SECRET = 'test-internal-secret-32chars-long-padding';
const SERVICE_ID = 'ai-api';
const target = '/internal/episodes';

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

describe('InternalEpisodesController', () => {
  let app: Awaited<ReturnType<typeof createHttpApp>>;
  const episodeStore: any[] = [];
  const episodeCreateMock = jest.fn(async ({ data }: any) => {
    const row = { id: randomUUID(), createdAt: new Date(), ...data };
    episodeStore.push(row);
    return { id: row.id, createdAt: row.createdAt };
  });

  beforeEach(async () => {
    episodeStore.length = 0;
    episodeCreateMock.mockClear();
    fakeRedis.set.mockReset();
    fakeRedis.set.mockResolvedValue('OK');
    app = await createHttpApp({
      controllers: [InternalEpisodesController],
      rawBody: true,
      providers: [
        { provide: ConfigService, useValue: { get: (key: string) => (key === 'INTERNAL_AI_API_SECRET' ? TEST_SECRET : undefined) } },
        { provide: PrismaService, useValue: { episode: { create: episodeCreateMock } } },
        { provide: IdempotencyService, useValue: { execute: jest.fn(async (_ctx: any, fn: () => Promise<any>) => fn()) } },
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

  it('rejects unknown fields via .strict() with 400', async () => {
    const body = JSON.stringify({
      trace_id: randomUUID(),
      acting_user_id: 'user-x',
      agent: 'tutor',
      unknown_field: 'should fail',
    });
    await request(app.getHttpServer())
      .post(target)
      .set(sign('POST', target, body))
      .set('content-type', 'application/json')
      .set(IDEMPOTENCY_KEY_HEADER, 'e2e-strict-001')
      .set('Idempotency-Key', 'e2e-strict-001')
      .send(body)
      .expect(400);
  });

  it('creates an episode and returns 201 with episodeId', async () => {
    const payload = {
      trace_id: randomUUID(),
      session_id: randomUUID(),
      acting_user_id: 'user-y',
      tenant_id: 'tenant-test',
      agent: 'tutor',
      intent: 'explain_journal',
      lesson_id: 'lesson-journal',
      step_id: 'step-debit-credit',
      task: 'balance a journal entry',
      response_excerpt: 'sum(debits) == sum(credits)',
      citations: [{ lessonId: 'lesson-journal', score: 0.9, source: 'curriculum' }],
      tokens_in: 100,
      tokens_out: 80,
      cost_usd: 0.001,
      latency_ms: 700,
      prompt_version: 'tutor-v1',
      policy_version: 'policy-v1',
      model: 'gemini-test',
      retrieval_version: 'rag-v1',
      status: 'completed',
      metadata: { e2e: true },
    };
    const body = JSON.stringify(payload);
    const res = await request(app.getHttpServer())
      .post(target)
      .set(sign('POST', target, body))
      .set('content-type', 'application/json')
      .set(IDEMPOTENCY_KEY_HEADER, 'e2e-create-001')
      .set('Idempotency-Key', 'e2e-create-001')
      .send(body)
      .expect(201);
    expect(res.body.episodeId).toBeDefined();
    expect(res.body.traceId).toBe(payload.trace_id);
    expect(episodeCreateMock).toHaveBeenCalledTimes(1);
    const arg = episodeCreateMock.mock.calls[0][0];
    expect(arg.data.userId).toBe('user-y');
    expect(arg.data.taskType).toBe('tutor');
    expect(arg.data.inputTokens).toBe(100);
    expect(arg.data.costUsd).toBe(0.001);
    expect(arg.data.latencyMs).toBe(700);
    expect(arg.data.strategy.traceId).toBe(payload.trace_id);
    expect(arg.data.strategy.tenantId).toBe('tenant-test');
  });

  it('rejects missing acting_user_id with 400 (zod validation)', async () => {
    const body = JSON.stringify({ trace_id: randomUUID(), agent: 'tutor' });
    await request(app.getHttpServer())
      .post(target)
      .set(sign('POST', target, body))
      .set('content-type', 'application/json')
      .set(IDEMPOTENCY_KEY_HEADER, 'e2e-missing-001')
      .set('Idempotency-Key', 'e2e-missing-001')
      .send(body)
      .expect(400);
  });
});
