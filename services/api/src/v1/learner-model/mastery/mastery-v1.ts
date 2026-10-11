import { ASSESSMENT_COMPLETED, assessmentPayloadSchema } from './assessment-payload';

export const MASTERY_MODEL_VERSION = 'mastery-v1';

const UNCERTAINTY_START = 1;
const UNCERTAINTY_DECAY = 0.05;
const HINT_FACTOR = 0.6;
const HINT_CAP = 3;
const ITEMS_CAP = 5;
const RETAKE_DECAY = 0.5;
const THETA_LIMIT = 6;
const DIFFICULTY_LIMIT = 3;

export interface ConceptState {
  theta: number;
  evidenceCount: number;
  score: number;
  confidence: number;
  lastEventAt: Date | null;
  lastSeq: number;
}

export interface AssessmentEvidence {
  score: number;
  items: number;
  hintsUsed: number;
  share: number;
  attemptNumber: number;
  difficulty?: number;
}

export interface FoldMeta {
  occurredAt: Date;
  streamSeq: number;
}

export interface StoredEvent {
  streamSeq: number;
  conceptId: string | null;
  eventType: string;
  payload: unknown;
  occurredAt: Date;
}

export interface SkippedEvent {
  streamSeq: number;
  reason: string;
}

export interface ReplayResult {
  states: Map<string, ConceptState>;
  skipped: SkippedEvent[];
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
const uncertaintyAt = (evidenceCount: number) => UNCERTAINTY_START / (1 + UNCERTAINTY_DECAY * evidenceCount);

export const EMPTY_CONCEPT_STATE: ConceptState = Object.freeze({
  theta: 0,
  evidenceCount: 0,
  score: 0.5,
  confidence: 0,
  lastEventAt: null,
  lastSeq: 0,
});

export const foldAssessment = (state: ConceptState, evidence: AssessmentEvidence, meta: FoldMeta): ConceptState => {
  const difficulty = clamp(evidence.difficulty ?? 0, DIFFICULTY_LIMIT);
  const expected = sigmoid(state.theta - difficulty);
  const weight =
    evidence.share * (Math.min(evidence.items, ITEMS_CAP) / ITEMS_CAP) * RETAKE_DECAY ** (evidence.attemptNumber - 1);

  let delta = uncertaintyAt(state.evidenceCount) * weight * (evidence.score - expected);
  if (delta > 0) delta *= HINT_FACTOR ** Math.min(evidence.hintsUsed, HINT_CAP);

  const theta = clamp(state.theta + delta, THETA_LIMIT);
  const evidenceCount = state.evidenceCount + 1;

  return {
    theta,
    evidenceCount,
    score: sigmoid(theta),
    confidence: 1 - uncertaintyAt(evidenceCount) / UNCERTAINTY_START,
    lastEventAt: meta.occurredAt,
    lastSeq: meta.streamSeq,
  };
};

export const replay = (events: StoredEvent[]): ReplayResult => {
  const states = new Map<string, ConceptState>();
  const skipped: SkippedEvent[] = [];

  for (const event of [...events].sort((a, b) => a.streamSeq - b.streamSeq)) {
    if (event.eventType !== ASSESSMENT_COMPLETED) continue;
    if (!event.conceptId) {
      skipped.push({ streamSeq: event.streamSeq, reason: 'missing concept' });
      continue;
    }
    const parsed = assessmentPayloadSchema.safeParse(event.payload);
    if (!parsed.success) {
      skipped.push({ streamSeq: event.streamSeq, reason: 'invalid payload' });
      continue;
    }
    const current = states.get(event.conceptId) ?? EMPTY_CONCEPT_STATE;
    states.set(
      event.conceptId,
      foldAssessment(current, parsed.data, { occurredAt: event.occurredAt, streamSeq: event.streamSeq }),
    );
  }

  return { states, skipped };
};
