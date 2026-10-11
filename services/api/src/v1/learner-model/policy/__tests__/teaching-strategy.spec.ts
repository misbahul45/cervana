import { LearnerPolicyService } from '../learner-policy.service';
import { PolicyDecisionInput, TEACHING_STRATEGIES, TeachingStrategy } from '../policy.types';

const emptyEvidence = () =>
  Object.fromEntries(TEACHING_STRATEGIES.map((s) => [s, { successes: 0, attempts: 0 }])) as Record<
    TeachingStrategy,
    { successes: number; attempts: number }
  >;

interface InputOverrides {
  intent?: PolicyDecisionInput['intent'];
  learner?: Partial<PolicyDecisionInput['learner']>;
  concept?: Partial<PolicyDecisionInput['concept']>;
  policy?: PolicyDecisionInput['policy'];
}

const input = (overrides: InputOverrides = {}): PolicyDecisionInput => ({
  intent: overrides.intent ?? 'NEW_LEARNING',
  policy: overrides.policy ?? { strategyEvidence: emptyEvidence() },
  learner: {
    mastery: 0.5,
    evidenceCount: 5,
    openMisconceptionCount: 0,
    daysSinceLastReview: 1,
    recentItemDifficulty: 0.5,
    ...overrides.learner,
  },
  concept: { prerequisiteMasteryMet: true, isTransferEligible: true, difficulty: 0.5, ...overrides.concept },
});

describe('LearnerPolicyService.teachingStrategy', () => {
  const service = new LearnerPolicyService();

  describe('output ranges', () => {
    const out = service.teachingStrategy(input());

    it('keeps the difficulty target inside the unit interval, the hint level in 0..3 and at least one attempt', () => {
      expect(out.difficultyTarget).toBeGreaterThanOrEqual(0);
      expect(out.difficultyTarget).toBeLessThanOrEqual(1);
      expect([0, 1, 2, 3]).toContain(out.hintLevel);
      expect(out.maxAttempts).toBeGreaterThanOrEqual(1);
      expect(['MINIMAL', 'MEDIUM', 'HIGH']).toContain(out.scaffoldLevel);
    });

    it('always says why, with codes and no free text', () => {
      expect(out.reasonCodes.length).toBeGreaterThan(0);
      for (const code of out.reasonCodes) expect(code).toMatch(/^[A-Z_]+$/);
    });
  });

  describe('difficulty stays in the zone of proximal development', () => {
    it('sits near a low mastery', () => {
      const out = service.teachingStrategy(input({ learner: { mastery: 0.3, recentItemDifficulty: 0.3 }, concept: { difficulty: 0.4 } }));

      expect(out.difficultyTarget).toBeGreaterThanOrEqual(0.2);
      expect(out.difficultyTarget).toBeLessThanOrEqual(0.5);
    });

    it('sits near a high mastery without passing 0.95', () => {
      const out = service.teachingStrategy(input({ learner: { mastery: 0.8, recentItemDifficulty: 0.8 }, concept: { difficulty: 0.7 } }));

      expect(out.difficultyTarget).toBeGreaterThanOrEqual(0.7);
      expect(out.difficultyTarget).toBeLessThanOrEqual(0.95);
    });

    it('flags the invariant when the last item was far from the target', () => {
      const near = service.teachingStrategy(input({ learner: { mastery: 0.5, recentItemDifficulty: 0.5 } }));
      const far = service.teachingStrategy(input({ learner: { mastery: 0.5, recentItemDifficulty: 0.05 } }));

      expect(near.invariants.difficultyInZoneOfProximalDevelopment).toBe(true);
      expect(far.invariants.difficultyInZoneOfProximalDevelopment).toBe(false);
    });
  });

  describe('misconceptions', () => {
    it('two or more open misconceptions mean remediation with high scaffolding', () => {
      const out = service.teachingStrategy(input({ learner: { openMisconceptionCount: 2 } }));

      expect(out).toMatchObject({ strategy: 'REMEDIATE', scaffoldLevel: 'HIGH' });
      expect(out.reasonCodes).toContain('OPEN_MISCONCEPTIONS');
    });

    it('one open misconception raises scaffolding to medium without forcing remediation', () => {
      const out = service.teachingStrategy(input({ learner: { openMisconceptionCount: 1 } }));

      expect(out.scaffoldLevel).toBe('MEDIUM');
      expect(out.strategy).not.toBe('REMEDIATE');
    });
  });

  describe('by intent', () => {
    it('a doubt with low mastery gets a worked example', () => {
      const out = service.teachingStrategy(input({ intent: 'DOUBT', learner: { mastery: 0.2 } }));

      expect(out.strategy).toBe('WORKED_EXAMPLE');
      expect(out.reasonCodes).toContain('LOW_MASTERY');
    });

    it.each([
      [0.2, 'WORKED_EXAMPLE', 'LOW_MASTERY'],
      [0.45, 'GUIDED_EXAMPLE', 'MID_MASTERY'],
      [0.8, 'SOCRATIC', 'HIGH_MASTERY'],
    ] as const)('a doubt at mastery %s gets %s', (mastery, strategy, code) => {
      const out = service.teachingStrategy(input({ intent: 'DOUBT', learner: { mastery } }));

      expect(out.strategy).toBe(strategy);
      expect(out.reasonCodes).toContain(code);
    });

    it.each([
      [0.3, 'WORKED_EXAMPLE', 'LOW_MASTERY'],
      [0.55, 'GUIDED_EXAMPLE', 'MID_MASTERY'],
      [0.85, 'EXPLAIN', 'HIGH_MASTERY'],
    ] as const)('new learning at mastery %s gets %s', (mastery, strategy, code) => {
      const out = service.teachingStrategy(input({ learner: { mastery } }));

      expect(out.strategy).toBe(strategy);
      expect(out.reasonCodes).toContain(code);
    });

    it('new learning without its prerequisites is remediation', () => {
      const out = service.teachingStrategy(input({ concept: { prerequisiteMasteryMet: false } }));

      expect(out.strategy).toBe('REMEDIATE');
      expect(out.reasonCodes).toContain('PREREQUISITE_NOT_MET');
    });

    it('a transfer intent on an eligible concept is transfer, and on an ineligible one it is not', () => {
      const eligible = service.teachingStrategy(input({ intent: 'TRANSFER' }));
      const ineligible = service.teachingStrategy(input({ intent: 'TRANSFER', concept: { isTransferEligible: false } }));

      expect(eligible).toMatchObject({ strategy: 'TRANSFER' });
      expect(eligible.reasonCodes).toContain('INTENT_TRANSFER');
      expect(ineligible.strategy).not.toBe('TRANSFER');
    });

    it('a challenge intent is a challenge', () => {
      const out = service.teachingStrategy(input({ intent: 'CHALLENGE' }));

      expect(out.strategy).toBe('CHALLENGE');
      expect(out.reasonCodes).toContain('INTENT_CHALLENGE');
    });

    it('practice is review after a week away and plain practice otherwise', () => {
      const away = service.teachingStrategy(input({ intent: 'PRACTICE', learner: { daysSinceLastReview: 9 } }));
      const fresh = service.teachingStrategy(input({ intent: 'PRACTICE', learner: { daysSinceLastReview: 2 } }));

      expect(away).toMatchObject({ strategy: 'REVIEW' });
      expect(away.reasonCodes).toContain('REVIEW_DUE');
      expect(fresh).toMatchObject({ strategy: 'PRACTICE' });
      expect(fresh.reasonCodes).toContain('INTENT_PRACTICE');
    });

    it('a doubt keeps priority below remediation', () => {
      const out = service.teachingStrategy(input({ intent: 'DOUBT', learner: { mastery: 0.2, openMisconceptionCount: 2 } }));

      expect(out.strategy).toBe('REMEDIATE');
    });
  });

  describe('evidence', () => {
    it('says so when fewer than three events back the mastery, and does not when three do', () => {
      const thin = service.teachingStrategy(input({ learner: { evidenceCount: 2 } }));
      const enough = service.teachingStrategy(input({ learner: { evidenceCount: 3 } }));

      expect(thin.reasonCodes).toContain('INSUFFICIENT_EVIDENCE');
      expect(thin.invariants.masteryStable).toBe(false);
      expect(enough.reasonCodes).not.toContain('INSUFFICIENT_EVIDENCE');
      expect(enough.invariants.masteryStable).toBe(true);
    });

    it('does not follow a personal preference until the learner has enough evidence', () => {
      const evidence = { ...emptyEvidence(), SOCRATIC: { successes: 9, attempts: 10 } };

      const thin = service.teachingStrategy(input({ intent: 'PRACTICE', learner: { evidenceCount: 2 }, policy: { strategyEvidence: evidence } }));
      const enough = service.teachingStrategy(input({ intent: 'PRACTICE', learner: { evidenceCount: 6 }, policy: { strategyEvidence: evidence } }));

      expect(thin.strategy).toBe('PRACTICE');
      expect(enough).toMatchObject({ strategy: 'SOCRATIC' });
      expect(enough.reasonCodes).toContain('PERSONAL_STRATEGY_PREFERRED');
    });

    it('needs three attempts and a 70 percent success rate before a strategy counts as preferred', () => {
      const few = { ...emptyEvidence(), SOCRATIC: { successes: 2, attempts: 2 } };
      const weak = { ...emptyEvidence(), SOCRATIC: { successes: 6, attempts: 10 } };

      for (const strategyEvidence of [few, weak]) {
        const out = service.teachingStrategy(input({ intent: 'PRACTICE', learner: { evidenceCount: 6 }, policy: { strategyEvidence } }));
        expect(out.strategy).toBe('PRACTICE');
      }
    });

    it('reports whether the personal policy has enough observations to be trusted', () => {
      const trusted = { ...emptyEvidence(), EXPLAIN: { successes: 3, attempts: 5 } };

      expect(service.teachingStrategy(input()).invariants.policyEvidenceSufficient).toBe(false);
      expect(service.teachingStrategy(input({ policy: { strategyEvidence: trusted } })).invariants.policyEvidenceSufficient).toBe(true);
    });
  });

  describe('properties over many learner states', () => {
    it('always returns a documented strategy, an in-range difficulty and at least one reason', () => {
      let seed = 7;
      const random = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      const intents = ['NEW_LEARNING', 'PRACTICE', 'DOUBT', 'CHALLENGE', 'TRANSFER'] as const;

      for (let i = 0; i < 300; i += 1) {
        const out = service.teachingStrategy(
          input({
            intent: intents[Math.floor(random() * intents.length)],
            learner: {
              mastery: random(),
              evidenceCount: Math.floor(random() * 20),
              openMisconceptionCount: Math.floor(random() * 4),
              daysSinceLastReview: Math.floor(random() * 30),
              recentItemDifficulty: random(),
            },
            concept: { prerequisiteMasteryMet: random() > 0.5, isTransferEligible: random() > 0.5, difficulty: random() },
          }),
        );

        expect(TEACHING_STRATEGIES).toContain(out.strategy);
        expect(out.difficultyTarget).toBeGreaterThanOrEqual(0.1);
        expect(out.difficultyTarget).toBeLessThanOrEqual(0.95);
        expect(out.reasonCodes.length).toBeGreaterThan(0);
      }
    });
  });
});
