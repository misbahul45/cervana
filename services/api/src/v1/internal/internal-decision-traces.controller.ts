import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { InternalOnly } from '@/common/authz/internal-service.guard';
import { RequireIdempotencyKey } from '@/common/idempotency/require-idempotency-key.decorator';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { z } from 'zod';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

const DecisionTraceCreateSchema = z
  .object({
    trace_id: z.string().min(1),
    session_id: z.string().min(1).optional(),
    acting_user_id: z.string().min(1),
    tenant_id: z.string().min(1).optional(),
    idempotency_key: z.string().min(1).optional(),

    agent_name: z.string().min(1),
    agent_scope: z.string().min(1).optional(),

    prompt_hash: z.string().min(1),
    response_hash: z.string().optional(),

    tool_calls: z.array(z.record(z.string(), z.unknown())).optional(),
    deterministic_outputs: z.record(z.string(), z.unknown()).optional(),

    policy_version: z.string().min(1).default('unknown-v0'),
    prompt_version: z.string().min(1).default('unknown-v0'),

    reason_codes: z.array(z.string()).optional(),
    selected_action: z.string().optional(),

    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

@Controller('internal/decision-traces')
@InternalOnly()
export class InternalDecisionTracesController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(201)
  @RequireIdempotencyKey()
  async create(
    @Body(new ZodPipe(DecisionTraceCreateSchema))
    body: z.infer<typeof DecisionTraceCreateSchema>,
  ) {
    const strategy = {
      agentName: body.agent_name,
      agentScope: body.agent_scope ?? null,
      toolCalls: body.tool_calls ?? [],
      deterministicOutputs: body.deterministic_outputs ?? {},
      reasonCodes: body.reason_codes ?? [],
      selectedAction: body.selected_action ?? null,
      promptHash: body.prompt_hash,
      responseHash: body.response_hash ?? null,
      tenantId: body.tenant_id ?? null,
      idempotencyKey: body.idempotency_key ?? null,
      metadata: body.metadata ?? {},
    };

    const trace = await this.prisma.decisionTrace.upsert({
      where: { traceId: body.trace_id },
      create: {
        traceId: body.trace_id,
        userId: body.acting_user_id,
        sessionId: body.session_id ?? null,
        agentVersion: body.agent_scope
          ? `${body.agent_name}:${body.agent_scope}`
          : body.agent_name,
        promptVersion: body.prompt_version,
        policyVersion: body.policy_version,
        modelName: 'unknown-v0',
        strategyJson: strategy as Prisma.InputJsonValue,
        retrievedMemory: {} as Prisma.InputJsonValue,
        retrievedChunks: {} as Prisma.InputJsonValue,
        responseText: '',
      },
      update: {
        agentVersion: body.agent_scope
          ? `${body.agent_name}:${body.agent_scope}`
          : body.agent_name,
        promptVersion: body.prompt_version,
        policyVersion: body.policy_version,
        strategyJson: strategy as Prisma.InputJsonValue,
      },
      select: { id: true, traceId: true, createdAt: true },
    });

    return {
      decisionTraceId: trace.id,
      traceId: trace.traceId,
      requestId: randomUUID(),
    };
  }
}
