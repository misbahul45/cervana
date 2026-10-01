export type ThemeStateKey = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'SUSPENDED' | 'ARCHIVED';

export const THEME_TRANSITIONS: Readonly<Record<ThemeStateKey, ReadonlyArray<ThemeStateKey>>> = {
  DRAFT: ['REVIEW', 'ARCHIVED'],
  REVIEW: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
  PUBLISHED: ['SUSPENDED', 'ARCHIVED'],
  SUSPENDED: ['PUBLISHED', 'ARCHIVED'],
  ARCHIVED: [],
};

export function canTransition(from: ThemeStateKey, to: ThemeStateKey): boolean {
  return THEME_TRANSITIONS[from].includes(to);
}

export interface TransitionContext {
  current: ThemeStateKey;
  next: ThemeStateKey;
  hasReferencingCurriculum: boolean;
}

export function nextState(input: TransitionContext): ThemeStateKey {
  if (!canTransition(input.current, input.next)) {
    throw new Error(
      `illegal theme transition: ${input.current} -> ${input.next}; allowed from ${input.current}: ${THEME_TRANSITIONS[input.current].join(', ') || '(none)'}`,
    );
  }
  return input.next;
}

export function canDelete(current: ThemeStateKey, hasReferencingCurriculum: boolean): boolean {
  return current === 'DRAFT' && !hasReferencingCurriculum;
}
