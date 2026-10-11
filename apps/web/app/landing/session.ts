import type { SessionMinutes } from './experience';

export type SessionStepKind =
  | 'misconception'
  | 'concept'
  | 'practice'
  | 'scenario'
  | 'reflection'
  | 'confidence'
  | 'mastery';

export interface SessionStep {
  readonly kind: SessionStepKind;
  readonly minutes: number;
}

const TIER_STEPS: Readonly<Record<SessionMinutes, readonly SessionStep[]>> = {
  2: [
    { kind: 'misconception', minutes: 1 },
    { kind: 'confidence', minutes: 1 },
  ],
  5: [
    { kind: 'misconception', minutes: 1 },
    { kind: 'concept', minutes: 1 },
    { kind: 'practice', minutes: 2 },
    { kind: 'confidence', minutes: 1 },
  ],
  10: [
    { kind: 'misconception', minutes: 2 },
    { kind: 'concept', minutes: 2 },
    { kind: 'practice', minutes: 4 },
    { kind: 'reflection', minutes: 1 },
    { kind: 'confidence', minutes: 1 },
  ],
  20: [
    { kind: 'misconception', minutes: 2 },
    { kind: 'concept', minutes: 4 },
    { kind: 'practice', minutes: 6 },
    { kind: 'scenario', minutes: 5 },
    { kind: 'reflection', minutes: 2 },
    { kind: 'mastery', minutes: 1 },
  ],
  25: [
    { kind: 'misconception', minutes: 3 },
    { kind: 'concept', minutes: 5 },
    { kind: 'practice', minutes: 6 },
    { kind: 'scenario', minutes: 6 },
    { kind: 'reflection', minutes: 3 },
    { kind: 'mastery', minutes: 2 },
  ],
};

export function composeSession(minutes: SessionMinutes, hasActiveMisconception: boolean): SessionStep[] {
  const steps = TIER_STEPS[minutes];
  if (hasActiveMisconception) return steps.map((step) => ({ ...step }));

  const freed = steps.find((step) => step.kind === 'misconception')?.minutes ?? 0;
  const remaining = steps.filter((step) => step.kind !== 'misconception');
  const practiceIndex = remaining.findIndex((step) => step.kind === 'practice');
  const target = practiceIndex >= 0 ? practiceIndex : 0;
  return remaining.map((step, index) =>
    index === target ? { kind: step.kind, minutes: step.minutes + freed } : { ...step },
  );
}

export function totalMinutes(steps: readonly SessionStep[]): number {
  return steps.reduce((sum, step) => sum + step.minutes, 0);
}
