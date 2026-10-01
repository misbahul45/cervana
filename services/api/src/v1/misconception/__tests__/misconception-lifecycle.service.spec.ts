import {
  MisconceptionLifecycleService,
  MISCONCEPTION_RULES,
} from '../misconception-lifecycle.service';

describe('MisconceptionLifecycleService', () => {
  const service = new MisconceptionLifecycleService();

  describe('AC-4.4 — auto-resolves after 5 consecutive correct', () => {
    it('returns RESOLVED when consecutiveCorrect >= 5', () => {
      const out = service.classify({
        count: 8,
        distinctEvidenceKeys: 2,
        consecutiveCorrect: 5,
        daysSinceLastSeen: 1,
      });
      expect(out.status).toBe('RESOLVED');
      expect(out.shouldAutoResolve).toBe(true);
    });
  });

  describe('one wrong answer is not a confirmed misconception', () => {
    it('returns TENTATIVE with low confidence and needsLlmConfirmation=false', () => {
      const out = service.classify({
        count: 1,
        distinctEvidenceKeys: 1,
        consecutiveCorrect: 0,
        daysSinceLastSeen: 0,
      });
      expect(out.status).toBe('TENTATIVE');
      expect(out.confidence).toBe(0.2);
      expect(out.needsLlmConfirmation).toBe(false);
    });

    it('isSlip() returns true on a single isolated observation', () => {
      expect(service.isSlip({ count: 1, distinctEvidenceKeys: 1 })).toBe(true);
    });
  });

  describe('CONFIRMED requires enough observations + distinct evidence', () => {
    it('CONFIRMED when count >= 4 and distinctEvidence >= 2', () => {
      const out = service.classify({
        count: 4,
        distinctEvidenceKeys: 2,
        consecutiveCorrect: 0,
        daysSinceLastSeen: 0,
      });
      expect(out.status).toBe('CONFIRMED');
      expect(out.needsLlmConfirmation).toBe(false);
    });

    it('remains TENTATIVE when count is high but evidence is single-source', () => {
      const out = service.classify({
        count: 5,
        distinctEvidenceKeys: 1,
        consecutiveCorrect: 0,
        daysSinceLastSeen: 0,
      });
      expect(out.status).toBe('TENTATIVE');
      expect(out.needsLlmConfirmation).toBe(true);
    });
  });

  describe('STALE — old without recent observation', () => {
    it('marks STALE when older than the threshold', () => {
      const out = service.classify({
        count: 3,
        distinctEvidenceKeys: 2,
        consecutiveCorrect: 0,
        daysSinceLastSeen: MISCONCEPTION_RULES.STALE_DAYS + 1,
      });
      expect(out.status).toBe('STALE');
    });
  });

  describe('TENTATIVE marks need LLM confirmation', () => {
    it('flags needsLlmConfirmation when count >= 2 but < 4', () => {
      const out = service.classify({
        count: 2,
        distinctEvidenceKeys: 1,
        consecutiveCorrect: 0,
        daysSinceLastSeen: 0,
      });
      expect(out.status).toBe('TENTATIVE');
      expect(out.needsLlmConfirmation).toBe(true);
    });
  });
});
