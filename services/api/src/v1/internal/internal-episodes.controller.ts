import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { InternalOnly } from '@/common/authz/internal-service.guard';
import { RequireIdempotencyKey } from '@/common/idempotency/require-idempotency-key.decorator';
import { IdempotencyService } from '@/common/idempotency/idempotency.service';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { z } from 'zod';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

const EpisodeCreateSchema = z
  .object({
    trace_id: z.string().min(1),
    session_id: z.string().min(1).optional(),
    acting_user_id: z.string().min(1),
    tenant_id: z.string().min(1).optional(),
    idempotency_key: z.string().min(1).optional(),

    agent: z.string().min(1),
    intent: z.string().min(1).optional(),

    lesson_id: z.string().min(1).optional(),
    step_id: z.string().min(1).optional(),
    topic_id: z.string().min(1).optional(),
    sub_topic_id: z.string().min(1).optional(),

    user_id: z.string().min(1).optional(),

    task: z.string().optional(),
    response_excerpt: z.string().optional(),

    citations: z
      .array(
        z.object({
          lessonId: z.string().min(1),
          chunkId: z.string().optional(),
          score: z.number().optional(),
          source: z.string().optional(),
        }),
      )
      .optional(),
    decision_trace_ref: z.string().optional(),

    tokens_in: z.number().int().nonnegative().optional(),
    tokens_out: z.number().int().nonnegative().optional(),
    cost_usd: z.number().nonnegative().optional(),
    latency_ms: z.number().int().nonnegative().optional(),

    prompt_version: z.string().min(1).default('unknown-v0'),
    policy_version: z.string().min(1).default('unknown-v0'),
    model: z.string().min(1).default('unknown-v0'),
    retrieval_version: z.string().min(1).default('unknown-v0'),

    status: z.string().min(1).default('completed'),
    error: z.string().optional(),

    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

@Controller('internal/episodes')
@InternalOnly()
export class InternalEpisodesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Post()
  @HttpCode(201)
  @RequireIdempotencyKey()
  async create(@Body(new ZodPipe(EpisodeCreateSchema)) body: z.infer<typeof EpisodeCreateSchema>) {
    const userId = body.user_id ?? body.acting_user_id;

    const inputPayload = {
      task: body.task ?? null,
      lessonId: body.lesson_id ?? null,
      stepId: body.step_id ?? null,
      topicId: body.topic_id ?? null,
      subTopicId: body.sub_topic_id ?? null,
      status: body.status,
      error: body.error ?? null,
      intent: body.intent ?? null,
    };

    const strategy = {
      promptVersion: body.prompt_version,
      policyVersion: body.policy_version,
      retrievalVersion: body.retrieval_version,
      decisionTraceRef: body.decision_trace_ref ?? null,
      sessionId: body.session_id ?? null,
      traceId: body.trace_id,
      tenantId: body.tenant_id ?? null,
      idempotencyKey: body.idempotency_key ?? null,
      metadata: body.metadata ?? {},
    };

    const episode = await this.prisma.episode.create({
      data: {
        userId,
        taskType: body.agent,
        inputPayload: inputPayload as Prisma.InputJsonValue,
        retrievedChunks: { citations: body.citations ?? [] } as Prisma.InputJsonValue,
        retrievedMemory: { retrievalVersion: body.retrieval_version } as Prisma.InputJsonValue,
        strategy: strategy as Prisma.InputJsonValue,
        promptVersion: body.prompt_version,
        modelName: body.model,
        response: body.response_excerpt ?? '',
        inputTokens: body.tokens_in ?? null,
        outputTokens: body.tokens_out ?? null,
        costUsd: body.cost_usd ?? null,
        latencyMs: body.latency_ms ?? null,
      },
      select: { id: true, createdAt: true },
    });

    return {
      episodeId: episode.id,
      traceId: body.trace_id,
      requestId: randomUUID(),
      storedAt: episode.createdAt.toISOString(),
    };
  }
}
