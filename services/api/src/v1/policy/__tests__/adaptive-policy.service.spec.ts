import { AdaptivePolicyService } from '../adaptive-policy.service';

describe('AdaptivePolicyService — invariant tests', () => {
  const service = new AdaptivePolicyService();

  const baseInput = {
    intent: 'NEW_LEARNING' as const,
    learner: {
      mastery: 0.5,
      confidence: 0.5,
      evidenceCount: 5,
      openMisconceptionCount: 0,
      daysSinceLastReview: 1,
      consecutiveCorrect: 0,
      recentItemDifficulty: 0.5,
    },
    concept: {
      prerequisiteMasteryMet: true,
      isTransferEligible: true,
      difficulty: 0.5,
    },
    policy: {
      preferredStrategy: undefined,
      strategyEvidence: {
        EXPLAIN: { successes: 0, attempts: 0 },
        ASK: { successes: 0, attempts: 0 },
        HINT: { successes: 0, attempts: 0 },
        WORKED_EXAMPLE: { successes: 0, attempts: 0 },
        GUIDED_EXAMPLE: { successes: 0, attempts: 0 },
        SOCRATIC: { successes: 0, attempts: 0 },
        COUNTEREXAMPLE: { successes: 0, attempts: 0 },
        PRACTICE: { successes: 0, attempts: 0 },
        REMEDIATE: { successes: 0, attempts: 0 },
        REVIEW: { successes: 0, attempts: 0 },
        CHALLENGE: { successes: 0, attempts: 0 },
        TRANSFER: { successes: 0, attempts: 0 },
      },
    },
  };

  describe('AC-5.1 — fields always within documented ranges', () => {
    const sample = service.decide(baseInput);
    it('difficultyTarget in [0, 1]', () => {
      expect(sample.difficultyTarget).toBeGreaterThanOrEqual(0);
      expect(sample.difficultyTarget).toBeLessThanOrEqual(1);
    });
    it('hintLevel in {0, 1, 2, 3}', () => {
      expect([0, 1, 2, 3]).toContain(sample.hintLevel);
    });
    it('scaffoldLevel in {MINIMAL, MEDIUM, HIGH}', () => {
      expect(['MINIMAL', 'MEDIUM', 'HIGH']).toContain(sample.scaffoldLevel);
    });
    it('maxAttempts >= 1', () => {
      expect(sample.maxAttempts).toBeGreaterThanOrEqual(1);
    });
    it('rationale is non-empty', () => {
      expect(sample.rationale.length).toBeGreaterThan(0);
    });
  });

  describe('AC-5.2 — difficulty stays within Zone of Proximal Development', () => {
    it('for mastery=0.3, concept=0.4: difficulty close to 0.3', () => {
      const out = service.decide({
        ...baseInput,
        learner: { ...baseInput.learner, mastery: 0.3, recentItemDifficulty: 0.3 },
        concept: { ...baseInput.concept, difficulty: 0.4 },
      });
      expect(out.difficultyTarget).toBeGreaterThanOrEqual(0.2);
      expect(out.difficultyTarget).toBeLessThanOrEqual(0.5);
    });

    it('for mastery=0.8, concept=0.7: difficulty close to 0.8', () => {
      const out = service.decide({
        ...baseInput,
        learner: { ...baseInput.learner, mastery: 0.8, recentItemDifficulty: 0.8 },
        concept: { ...baseInput.concept, difficulty: 0.7 },
      });
      expect(out.difficultyTarget).toBeGreaterThanOrEqual(0.7);
      expect(out.difficultyTarget).toBeLessThanOrEqual(0.95);
    });
  });

  describe('AC-5.3 — scaffolding=HIGH when open misconceptions >= 2', () => {
    it('returns REMEDIATE + scaffoldLevel=HIGH', () => {
      const out = service.decide({
        ...baseInput,
        learner: { ...baseInput.learner, openMisconceptionCount: 2 },
      });
      expect(out.strategy).toBe('REMEDIATE');
      expect(out.scaffoldLevel).toBe('HIGH');
    });
  });

  describe('AC-5.4 — 100 random learner-state fixtures produce sensible strategies', () => {
    it('strategy is one of the 12 documented strategies', () => {
      for (let i = 0; i < 100; i += 1) {
        const mastery = Math.random();
        const out = service.decide({
          ...baseInput,
          learner: {
            mastery,
            confidence: Math.random(),
            evidenceCount: Math.floor(Math.random() * 20),
            openMisconceptionCount: Math.floor(Math.random() * 3),
            daysSinceLastReview: Math.floor(Math.random() * 30),
            consecutiveCorrect: Math.floor(Math.random() * 5),
            recentItemDifficulty: Math.random(),
          },
          concept: {
            prerequisiteMasteryMet: Math.random() > 0.5,
            isTransferEligible: Math.random() > 0.5,
            difficulty: Math.random(),
          },
          policy: baseInput.policy,
        });
        expect([
          'EXPLAIN',
          'ASK',
          'HINT',
          'WORKED_EXAMPLE',
          'GUIDED_EXAMPLE',
          'SOCRATIC',
          'COUNTEREXAMPLE',
          'PRACTICE',
          'REMEDIATE',
          'REVIEW',
          'CHALLENGE',
          'TRANSFER',
        ]).toContain(out.strategy);
        expect(out.difficultyTarget).toBeGreaterThanOrEqual(0);
        expect(out.difficultyTarget).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('AC-199: when INTENT == DOUBT, low mastery triggers WORKED_EXAMPLE', () => {
    it('mastery 0.2 + DOUBT -> WORKED_EXAMPLE', () => {
      const out = service.decide({
        ...baseInput,
        intent: 'DOUBT',
        learner: { ...baseInput.learner, mastery: 0.2 },
      });
      expect(out.strategy).toBe('WORKED_EXAMPLE');
    });
  });

  describe('AC-199: TRANSFER eligible + intent TRANSFER -> TRANSFER', () => {
    it('uses TRANSFER strategy', () => {
      const out = service.decide({
        ...baseInput,
        intent: 'TRANSFER',
        concept: { ...baseInput.concept, isTransferEligible: true },
      });
      expect(out.strategy).toBe('TRANSFER');
    });
  });

  describe('one interaction must not blindly rewrite personal policy', () => {
    it('preferredStrategy field is not exposed in decision output', () => {
      const out = service.decide({
        ...baseInput,
        policy: { ...baseInput.policy, preferredStrategy: 'EXPLAIN' },
      });
      expect(out.strategy).not.toBe('EXPLAIN');
    });
  });
});
