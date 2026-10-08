import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { InternalOnly } from '@/common/authz/internal-service.guard';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { z } from 'zod';
import { createHash, randomUUID } from 'crypto';

const AGENT_SESSION_TTL_MS = 5 * 60 * 1000;
const MAX_AGENT_SESSIONS = 10_000;

interface AgentSessionRecord {
  sessionId: string;
  actingUserId: string;
  tenantId: string;
  traceId: string | null;
  idempotencyKey: string | null;
  issuedAtMs: number;
  expiresAtMs: number;
}

const AgentSessionMintSchema = z
  .object({
    acting_user_id: z.string().min(1),
    trace_id: z.string().min(1).optional(),
    idempotency_key: z.string().min(1).optional(),
    ttl_seconds: z.number().int().positive().max(900).optional(),
  })
  .strict();

const AgentSessionResolveSchema = z
  .object({
    session_id: z.string().min(1),
  })
  .strict();

@Controller('internal/agent-sessions')
@InternalOnly()
export class InternalAgentSessionsController {
  private readonly sessions = new Map<string, AgentSessionRecord>();

  private prune(): void {
    const now = Date.now();
    for (const [k, v] of this.sessions) {
      if (v.expiresAtMs <= now) this.sessions.delete(k);
    }
    if (this.sessions.size > MAX_AGENT_SESSIONS) {
      const ordered = Array.from(this.sessions.entries()).sort(
        (a, b) => a[1].issuedAtMs - b[1].issuedAtMs,
      );
      const toDrop = this.sessions.size - MAX_AGENT_SESSIONS;
      for (let i = 0; i < toDrop; i += 1) {
        this.sessions.delete(ordered[i][0]);
      }
    }
  }

  @Post()
  @HttpCode(201)
  mint(@Body(new ZodPipe(AgentSessionMintSchema)) body: z.infer<typeof AgentSessionMintSchema>) {
    this.prune();
    const now = Date.now();
    const ttl = body.ttl_seconds ? body.ttl_seconds * 1000 : AGENT_SESSION_TTL_MS;
    const sessionId = randomUUID();
    const tenantId = deriveTenant(body.acting_user_id);
    const record: AgentSessionRecord = {
      sessionId,
      actingUserId: body.acting_user_id,
      tenantId,
      traceId: body.trace_id ?? null,
      idempotencyKey: body.idempotency_key ?? null,
      issuedAtMs: now,
      expiresAtMs: now + ttl,
    };
    this.sessions.set(sessionId, record);
    return this.toResponse(record);
  }

  @Post('resolve')
  @HttpCode(200)
  resolve(@Body(new ZodPipe(AgentSessionResolveSchema)) body: z.infer<typeof AgentSessionResolveSchema>) {
    const record = this.sessions.get(body.session_id);
    if (!record || record.expiresAtMs <= Date.now()) {
      if (record) this.sessions.delete(body.session_id);
      return { found: false as const, sessionId: body.session_id };
    }
    return { found: true as const, ...this.toResponse(record) };
  }

  @Get(':id/resolve')
  resolveByPath(@Param('id') id: string) {
    const record = this.sessions.get(id);
    if (!record || record.expiresAtMs <= Date.now()) {
      if (record) this.sessions.delete(id);
      return { found: false as const, sessionId: id };
    }
    return { found: true as const, ...this.toResponse(record) };
  }

  private toResponse(record: AgentSessionRecord) {
    return {
      sessionId: record.sessionId,
      actingUserId: record.actingUserId,
      tenantId: record.tenantId,
      traceId: record.traceId,
      idempotencyKey: record.idempotencyKey,
      issuedAtMs: record.issuedAtMs,
      expiresAtMs: record.expiresAtMs,
    };
  }
}

function deriveTenant(actingUserId: string): string {
  return createHash('sha256').update(actingUserId).digest('hex').slice(0, 16);
}
