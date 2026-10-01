import { PersonalPolicyService } from '../personal-policy.service';
import type { TeachingStrategy } from '../adaptive-policy.service';

describe('PersonalPolicyService — reflection loop', () => {
  const service = new PersonalPolicyService();
  const userId = 'user-1';

  describe('AC-41: prevents oscillation', () => {
    it('does not flip preferred strategy on a single interaction when original has more evidence', () => {
      let policy = service.buildEmpty(userId);
      for (let i = 0; i < 5; i += 1) {
        policy = service.recordOutcome(policy, {
          strategy: 'EXPLAIN',
          scoreDelta: 0.05,
          wasCorrect: true,
        });
      }
      expect(policy.preferredStrategy).toBe('EXPLAIN');
      const beforeVersion = policy.version;
      const beforePreferred = policy.preferredStrategy;
      policy = service.recordOutcome(policy, {
        strategy: 'ASK',
        scoreDelta: 0.04,
        wasCorrect: false,
      });
      expect(policy.preferredStrategy).toBe(beforePreferred);
      expect(policy.version).toBe(beforeVersion + 1);
    });

    it('keeps strategy at GLOBAL confidence when evidence is thin', () => {
      const policy = service.recordOutcome(service.buildEmpty(userId), {
        strategy: 'EXPLAIN',
        scoreDelta: 0.05,
        wasCorrect: true,
      });
      expect(policy.preferredStrategy).toBeUndefined();
      expect(policy.confidence).toBeLessThan(0.5);
    });
  });

  describe('AC-42: reset clears personalization', () => {
    it('reset returns a fresh policy with version 1', () => {
      let policy = service.buildEmpty(userId);
      for (let i = 0; i < 10; i += 1) {
        policy = service.recordOutcome(policy, {
          strategy: 'EXPLAIN',
          scoreDelta: 0.05,
          wasCorrect: true,
        });
      }
      const reset = service.reset(userId);
      expect(reset.strategyEvidence.EXPLAIN.attempts).toBe(0);
      expect(reset.version).toBe(1);
      expect(reset.preferredStrategy).toBeUndefined();
    });

    it('preserves authoritative progress: hasSufficientEvidence returns false after reset', () => {
      let policy = service.buildEmpty(userId);
      for (let i = 0; i < 20; i += 1) {
        policy = service.recordOutcome(policy, {
          strategy: 'EXPLAIN',
          scoreDelta: 0.05,
          wasCorrect: true,
        });
      }
      expect(service.hasSufficientEvidence(policy)).toBe(true);
      const reset = service.reset(userId);
      expect(service.hasSufficientEvidence(reset)).toBe(false);
    });
  });

  describe('AC-160: PersonalPolicy ON vs OFF behavior', () => {
    it('records influence the policy when ON', () => {
      let policy = service.buildEmpty(userId);
      for (let i = 0; i < 8; i += 1) {
        policy = service.recordOutcome(policy, {
          strategy: 'GUIDED_EXAMPLE',
          scoreDelta: 0.05,
          wasCorrect: true,
        });
      }
      expect(policy.preferredStrategy).toBe('GUIDED_EXAMPLE');
      expect(service.hasSufficientEvidence(policy)).toBe(true);
    });
  });

  describe('AC-157: across 20 sessions, strategy evidence accumulates', () => {
    it('tracks per-strategy attempts across 20 updates', () => {
      let policy = service.buildEmpty(userId);
      const strategies: TeachingStrategy[] = ['EXPLAIN', 'ASK', 'HINT', 'PRACTICE'];
      for (let i = 0; i < 20; i += 1) {
        const strategy = strategies[i % strategies.length]!;
        policy = service.recordOutcome(policy, {
          strategy,
          scoreDelta: strategy === 'PRACTICE' ? 0.08 : 0.02,
          wasCorrect: i % 3 !== 0,
        });
      }
      const total = Object.values(policy.strategyEvidence).reduce(
        (sum, e) => sum + e.attempts,
        0,
      );
      expect(total).toBe(20);
    });
  });

  describe('AC-159: PersonalPolicy OFF still works', () => {
    it('buildEmpty + reset produce equivalent baseline', () => {
      const empty = service.buildEmpty(userId);
      const reset = service.reset(userId);
      expect(empty.strategyEvidence).toEqual(reset.strategyEvidence);
      expect(empty.preferredStrategy).toBeUndefined();
      expect(reset.preferredStrategy).toBeUndefined();
    });
  });

  describe('consecutive failure tracking', () => {
    it('resets consecutiveFailures on correct', () => {
      let policy = service.buildEmpty(userId);
      policy = service.recordOutcome(policy, { strategy: 'EXPLAIN', scoreDelta: -0.05, wasCorrect: false });
      policy = service.recordOutcome(policy, { strategy: 'EXPLAIN', scoreDelta: -0.05, wasCorrect: false });
      expect(policy.strategyEvidence.EXPLAIN.consecutiveFailures).toBe(2);
      policy = service.recordOutcome(policy, { strategy: 'EXPLAIN', scoreDelta: 0.05, wasCorrect: true });
      expect(policy.strategyEvidence.EXPLAIN.consecutiveFailures).toBe(0);
    });
  });
});
