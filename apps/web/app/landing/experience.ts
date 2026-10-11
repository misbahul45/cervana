export const SESSION_TIERS = [2, 5, 10, 20, 25] as const;

export type SessionMinutes = (typeof SESSION_TIERS)[number];
export type TeachingMode = 'explain' | 'socratic';
export type Difficulty = 1 | 2 | 3 | 4 | 5;
export type StageTheme = 'default' | 'futuristic';
export type MotionLevel = 'high' | 'low';

export interface ExperienceValues {
  readonly sessionMinutes: SessionMinutes;
  readonly teachingMode: TeachingMode;
  readonly difficulty: Difficulty;
  readonly theme: StageTheme;
  readonly motion: MotionLevel;
}

export type ExperienceDimension = keyof ExperienceValues;

export const EXPERIENCE_DIMENSIONS: readonly ExperienceDimension[] = [
  'sessionMinutes',
  'teachingMode',
  'difficulty',
  'theme',
  'motion',
];

export const DEFAULT_EXPERIENCE: ExperienceValues = {
  sessionMinutes: 20,
  teachingMode: 'explain',
  difficulty: 3,
  theme: 'default',
  motion: 'high',
};

export type ProposalOrigin = 'preset' | 'utterance' | 'external';

export interface ExperienceProposal {
  readonly origin: ProposalOrigin;
  readonly utterance: string;
  readonly changes: Readonly<Record<string, unknown>>;
}

export type RejectionReason = 'unknown_dimension' | 'invalid_value';

export interface RejectedChange {
  readonly key: string;
  readonly reason: RejectionReason;
}

export interface ProposalDecision {
  readonly accepted: Partial<ExperienceValues>;
  readonly rejected: readonly RejectedChange[];
}

export interface ExperienceSnapshot {
  readonly revision: number;
  readonly adaptations: number;
  readonly utterance: string;
  readonly values: ExperienceValues;
  readonly changed: readonly ExperienceDimension[];
  readonly previous: Partial<ExperienceValues>;
  readonly rejected: readonly RejectedChange[];
  readonly recognized: boolean;
}

export function snapSessionMinutes(minutes: number): SessionMinutes {
  let snapped: SessionMinutes = SESSION_TIERS[0];
  for (const tier of SESSION_TIERS) {
    if (tier <= minutes) snapped = tier;
  }
  return snapped;
}

function isDimension(key: string): key is ExperienceDimension {
  return (EXPERIENCE_DIMENSIONS as readonly string[]).includes(key);
}

function validateValue(key: ExperienceDimension, value: unknown): Partial<ExperienceValues> | null {
  switch (key) {
    case 'sessionMinutes':
      return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 180
        ? { sessionMinutes: snapSessionMinutes(value) }
        : null;
    case 'teachingMode':
      return value === 'explain' || value === 'socratic' ? { teachingMode: value } : null;
    case 'difficulty':
      return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
        ? { difficulty: value as Difficulty }
        : null;
    case 'theme':
      return value === 'default' || value === 'futuristic' ? { theme: value } : null;
    case 'motion':
      return value === 'high' || value === 'low' ? { motion: value } : null;
  }
}

export function validateProposal(proposal: ExperienceProposal): ProposalDecision {
  let accepted: Partial<ExperienceValues> = {};
  const rejected: RejectedChange[] = [];
  for (const [key, value] of Object.entries(proposal.changes)) {
    if (!isDimension(key)) {
      rejected.push({ key, reason: 'unknown_dimension' });
      continue;
    }
    const valid = validateValue(key, value);
    if (valid === null) {
      rejected.push({ key, reason: 'invalid_value' });
      continue;
    }
    accepted = { ...accepted, ...valid };
  }
  return { accepted, rejected };
}

export function initialSnapshot(values: ExperienceValues = DEFAULT_EXPERIENCE): ExperienceSnapshot {
  return {
    revision: 0,
    adaptations: 0,
    utterance: '',
    values,
    changed: [],
    previous: {},
    rejected: [],
    recognized: true,
  };
}

export function applyProposal(snapshot: ExperienceSnapshot, proposal: ExperienceProposal): ExperienceSnapshot {
  const decision = validateProposal(proposal);
  const changed: ExperienceDimension[] = [];
  const previous: { -readonly [K in ExperienceDimension]?: ExperienceValues[K] } = {};
  let next: ExperienceValues = snapshot.values;

  for (const key of EXPERIENCE_DIMENSIONS) {
    const incoming = decision.accepted[key];
    if (incoming !== undefined && incoming !== snapshot.values[key]) {
      changed.push(key);
      (previous as Record<string, unknown>)[key] = snapshot.values[key];
      next = { ...next, [key]: incoming };
    }
  }

  const recognized = Object.keys(proposal.changes).length > 0;

  return {
    revision: snapshot.revision + 1,
    adaptations: snapshot.adaptations + (changed.length > 0 ? 1 : 0),
    utterance: proposal.utterance,
    values: next,
    changed,
    previous,
    rejected: decision.rejected,
    recognized,
  };
}

const MINUTES_PATTERN = /(\d{1,3})\s*(menit|mnt|min|minutes?)\b/;
const SOCRATIC_PATTERN = /(tanya|pertanyaan|bertanya|socrat|ask me|questions?|quiz me)/;
const EXPLAIN_PATTERN = /(jelaskan|penjelasan|explain|explanation|lecture)/;
const HARDER_PATTERN =
  /(lebih (sulit|susah|menantang)|tambah tantangan|naikkan (tingkat|level|kesulitan)|harder|more challeng|tougher|make it hard)/;
const EASIER_PATTERN =
  /(lebih (mudah|gampang|ringan)|turunkan (tingkat|level|kesulitan)|easier|simpler|less challeng|make it easy)/;
const FUTURISTIC_PATTERN = /(futuristi|futuristic|sci-?fi|cyber)/;
const DEFAULT_THEME_PATTERN = /(tema (default|standar|biasa)|default theme|normal theme|reset theme)/;
const LESS_MOTION_PATTERN =
  /(kurangi animasi|kurang animasi|tanpa animasi|less animat|less motion|reduce motion|no animation|fewer animation)/;
const MORE_MOTION_PATTERN = /(lebih (banyak )?animasi|more animat|more motion)/;

export function interpretUtterance(text: string, current: ExperienceValues): ExperienceProposal {
  const normalized = text.toLowerCase().normalize('NFKC').slice(0, 200);
  const changes: Record<string, unknown> = {};

  const minutes = MINUTES_PATTERN.exec(normalized);
  if (minutes) changes.sessionMinutes = Number(minutes[1]);

  if (SOCRATIC_PATTERN.test(normalized)) changes.teachingMode = 'socratic';
  else if (EXPLAIN_PATTERN.test(normalized)) changes.teachingMode = 'explain';

  const harder = HARDER_PATTERN.test(normalized);
  const easier = EASIER_PATTERN.test(normalized);
  if (harder && !easier) changes.difficulty = Math.min(5, current.difficulty + 1);
  if (easier && !harder) changes.difficulty = Math.max(1, current.difficulty - 1);

  if (FUTURISTIC_PATTERN.test(normalized)) changes.theme = 'futuristic';
  else if (DEFAULT_THEME_PATTERN.test(normalized)) changes.theme = 'default';

  if (LESS_MOTION_PATTERN.test(normalized)) changes.motion = 'low';
  else if (MORE_MOTION_PATTERN.test(normalized)) changes.motion = 'high';

  return { origin: 'utterance', utterance: text.slice(0, 200), changes };
}

export function presetProposal(
  utterance: string,
  changes: Readonly<Record<string, unknown>>,
): ExperienceProposal {
  return { origin: 'preset', utterance, changes };
}
