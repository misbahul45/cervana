import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { ASSESSMENT_COMPLETED, AssessmentPayload, assessmentPayloadSchema } from '../mastery/assessment-payload';
import {
  ConceptState,
  EMPTY_CONCEPT_STATE,
  MASTERY_MODEL_VERSION,
  SkippedEvent,
  foldAssessment,
  replay,
} from '../mastery/mastery-v1';

const SCHEMA_VERSION = 1;
const strictAssessmentPayload = assessmentPayloadSchema.strict();

export interface AppendAssessmentInput {
  userId: string;
  conceptId: string;
  idempotencyKey: string;
  occurredAt?: Date;
  payload: AssessmentPayload;
}

export interface AppendResult {
  eventId: string;
  streamSeq: number;
  duplicate: boolean;
  state: ConceptState;
}

export interface RebuildResult {
  changed: string[];
  removed: string[];
  skipped: SkippedEvent[];
}

interface StreamHead {
  lastSeq: number;
  modelVersion: string;
}

interface MasteryRecord {
  theta: number;
  score: number;
  confidence: number;
  evidenceCount: number;
  lastEventAt: Date;
  lastSeq: number;
  modelVersion: string;
}

const toState = (row: MasteryRecord): ConceptState => ({
  theta: row.theta,
  evidenceCount: row.evidenceCount,
  score: row.score,
  confidence: row.confidence,
  lastEventAt: row.lastEventAt,
  lastSeq: row.lastSeq,
});

const projectionValues = (state: ConceptState) => ({
  theta: state.theta,
  score: state.score,
  confidence: state.confidence,
  evidenceCount: state.evidenceCount,
  lastEventAt: state.lastEventAt ?? new Date(0),
  lastSeq: state.lastSeq,
  modelVersion: MASTERY_MODEL_VERSION,
});

const FLOAT_TOLERANCE = 1e-9;
const close = (a: number, b: number) => Math.abs(a - b) <= FLOAT_TOLERANCE;

const sameProjection = (row: MasteryRecord, state: ConceptState) => {
  const expected = projectionValues(state);
  return (
    close(row.theta, expected.theta) &&
    close(row.score, expected.score) &&
    close(row.confidence, expected.confidence) &&
    row.evidenceCount === expected.evidenceCount &&
    row.lastSeq === expected.lastSeq &&
    row.modelVersion === expected.modelVersion &&
    row.lastEventAt.getTime() === expected.lastEventAt.getTime()
  );
};

const internal = (message: string) => new AppError(message, 500, AppErrorCode.INTERNAL_SERVER_ERROR);

@Injectable()
export class LearnerEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async append(input: AppendAssessmentInput, tx?: Prisma.TransactionClient): Promise<AppendResult> {
    const parsed = strictAssessmentPayload.safeParse(input.payload);
    if (!parsed.success) {
      throw internal(`Invalid learning event payload: ${parsed.error.issues.map((i) => i.path.join('.') || i.message).join(', ')}`);
    }
    const work = (client: Prisma.TransactionClient) => this.appendWithin(client, input, parsed.data);
    return tx ? work(tx) : this.prisma.$transaction(work);
  }

  rebuild(userId: string): Promise<RebuildResult> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockStream(tx, userId);
      return this.rebuildWithin(tx, userId);
    });
  }

  private async appendWithin(tx: Prisma.TransactionClient, input: AppendAssessmentInput, payload: AssessmentPayload): Promise<AppendResult> {
    const concept = await tx.concept.findUnique({ where: { id: input.conceptId }, select: { status: true } });
    if (!concept) throw internal(`Unknown concept ${input.conceptId}`);
    if (concept.status !== 'ACTIVE') throw internal(`Concept ${input.conceptId} is deprecated and takes no new evidence`);

    const head = await this.lockStream(tx, input.userId);
    if (head.modelVersion !== MASTERY_MODEL_VERSION) {
      await this.rebuildWithin(tx, input.userId);
    }

    const existing = await tx.learningEvent.findUnique({
      where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } },
    });
    if (existing) {
      const row = await tx.conceptMastery.findUnique({ where: { userId_conceptId: { userId: input.userId, conceptId: input.conceptId } } });
      return {
        eventId: existing.id,
        streamSeq: existing.streamSeq ?? 0,
        duplicate: true,
        state: row ? toState(row) : EMPTY_CONCEPT_STATE,
      };
    }

    const current = await tx.learnerStream.findUniqueOrThrow({ where: { userId: input.userId }, select: { lastSeq: true } });
    const streamSeq = current.lastSeq + 1;
    const occurredAt = input.occurredAt ?? new Date();

    const stored = await tx.learningEvent.create({
      data: {
        userId: input.userId,
        eventType: ASSESSMENT_COMPLETED,
        conceptId: input.conceptId,
        streamSeq,
        schemaVersion: SCHEMA_VERSION,
        idempotencyKey: input.idempotencyKey,
        occurredAt,
        entityType: 'QUIZ_ATTEMPT',
        entityId: payload.attemptId,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });

    const key = { userId_conceptId: { userId: input.userId, conceptId: input.conceptId } };
    const row = await tx.conceptMastery.findUnique({ where: key });
    const state = foldAssessment(row ? toState(row) : EMPTY_CONCEPT_STATE, payload, { occurredAt, streamSeq });
    await tx.conceptMastery.upsert({
      where: key,
      create: { userId: input.userId, conceptId: input.conceptId, ...projectionValues(state) },
      update: projectionValues(state),
    });
    await tx.learnerStream.update({ where: { userId: input.userId }, data: { lastSeq: streamSeq } });

    return { eventId: stored.id, streamSeq, duplicate: false, state };
  }

  private async lockStream(tx: Prisma.TransactionClient, userId: string): Promise<StreamHead> {
    await tx.$executeRaw`INSERT INTO "LearnerStream" ("userId", "lastSeq", "modelVersion", "updatedAt") VALUES (${userId}, 0, ${MASTERY_MODEL_VERSION}, now()) ON CONFLICT ("userId") DO NOTHING`;
    const rows = await tx.$queryRaw<StreamHead[]>`SELECT "lastSeq", "modelVersion" FROM "LearnerStream" WHERE "userId" = ${userId} FOR UPDATE`;
    return rows[0];
  }

  private async rebuildWithin(tx: Prisma.TransactionClient, userId: string): Promise<RebuildResult> {
    const stored = await tx.learningEvent.findMany({
      where: { userId, streamSeq: { not: null } },
      orderBy: { streamSeq: 'asc' },
      select: { streamSeq: true, conceptId: true, eventType: true, payload: true, occurredAt: true },
    });
    const { states, skipped } = replay(stored.map((event) => ({ ...event, streamSeq: event.streamSeq as number })));
    const rows = await tx.conceptMastery.findMany({ where: { userId } });
    const byConcept = new Map(rows.map((row) => [row.conceptId, row]));

    const changed: string[] = [];
    for (const [conceptId, state] of states) {
      const row = byConcept.get(conceptId);
      if (row && sameProjection(row, state)) continue;
      await tx.conceptMastery.upsert({
        where: { userId_conceptId: { userId, conceptId } },
        create: { userId, conceptId, ...projectionValues(state) },
        update: projectionValues(state),
      });
      changed.push(conceptId);
    }

    const removed = rows.map((row) => row.conceptId).filter((conceptId) => !states.has(conceptId));
    if (removed.length > 0) {
      await tx.conceptMastery.deleteMany({ where: { userId, conceptId: { in: removed } } });
    }

    const lastSeq = stored.reduce((max, event) => Math.max(max, event.streamSeq ?? 0), 0);
    await tx.learnerStream.update({ where: { userId }, data: { lastSeq, modelVersion: MASTERY_MODEL_VERSION } });

    return { changed: changed.sort(), removed: removed.sort(), skipped };
  }
}
