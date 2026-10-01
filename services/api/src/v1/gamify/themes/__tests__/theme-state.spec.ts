import { canTransition, nextState, canDelete } from '../theme-state';

describe('theme state machine', () => {
  describe('canTransition', () => {
    it.each([
      ['DRAFT', 'REVIEW', true],
      ['DRAFT', 'ARCHIVED', true],
      ['DRAFT', 'PUBLISHED', false],
      ['DRAFT', 'SUSPENDED', false],
      ['REVIEW', 'DRAFT', true],
      ['REVIEW', 'PUBLISHED', true],
      ['REVIEW', 'ARCHIVED', true],
      ['REVIEW', 'SUSPENDED', false],
      ['PUBLISHED', 'SUSPENDED', true],
      ['PUBLISHED', 'ARCHIVED', true],
      ['PUBLISHED', 'DRAFT', false],
      ['PUBLISHED', 'REVIEW', false],
      ['SUSPENDED', 'PUBLISHED', true],
      ['SUSPENDED', 'ARCHIVED', true],
      ['SUSPENDED', 'DRAFT', false],
      ['ARCHIVED', 'DRAFT', false],
      ['ARCHIVED', 'REVIEW', false],
      ['ARCHIVED', 'PUBLISHED', false],
    ] as const)('%s -> %s = %s', (from, to, expected) => {
      expect(canTransition(from, to)).toBe(expected);
    });
  });

  describe('nextState', () => {
    it('returns the next state for an allowed transition', () => {
      expect(
        nextState({
          current: 'DRAFT',
          next: 'REVIEW',
          hasReferencingCurriculum: false,
        }),
      ).toBe('REVIEW');
    });

    it('throws on an illegal transition with allowed-from list', () => {
      expect(() =>
        nextState({
          current: 'DRAFT',
          next: 'PUBLISHED',
          hasReferencingCurriculum: false,
        }),
      ).toThrow(/illegal theme transition: DRAFT -> PUBLISHED.*REVIEW, ARCHIVED/);
    });
  });

  describe('canDelete', () => {
    it('allows deleting an unreferenced DRAFT', () => {
      expect(canDelete('DRAFT', false)).toBe(true);
    });

    it('blocks deleting a DRAFT referenced by curriculum', () => {
      expect(canDelete('DRAFT', true)).toBe(false);
    });

    it('blocks deleting PUBLISHED', () => {
      expect(canDelete('PUBLISHED', false)).toBe(false);
    });

    it('blocks deleting ARCHIVED', () => {
      expect(canDelete('ARCHIVED', false)).toBe(false);
    });
  });
});
