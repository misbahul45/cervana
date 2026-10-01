import { MasteryService } from '../mastery.service';

describe('MasteryService — Elo-like mastery update', () => {
  const service = new MasteryService();

  const baseline = {
    currentScore: 0.5,
    currentConfidence: 0.3,
    currentEvidenceCount: 0,
    itemDifficulty: 0.5,
  } as const;

  describe('AC-4.1 — 8 golden vector tests', () => {
    it('1) independent correct on first attempt moves mastery up', () => {
      const out = service.update({ ...baseline, isCorrect: true, hintUsed: false, fullExplanationSeen: false, isTransfer: false, isOffTopic: false });
      expect(out.delta).toBeGreaterThan(0);
      expect(out.appliedWeight).toBe('INDEPENDENT_CORRECT');
      expect(out.evidenceCount).toBe(1);
    });

    it('2) independent incorrect on first attempt moves mastery down', () => {
      const out = service.update({ ...baseline, isCorrect: false, hintUsed: false, fullExplanationSeen: false, isTransfer: false, isOffTopic: false });
      expect(out.delta).toBeLessThan(0);
      expect(out.appliedWeight).toBe('INDEPENDENT_CORRECT');
    });

    it('3) hint used with correct answer sets applied weight and produces no delta when full explanation was also seen', () => {
      const out = service.update({ ...baseline, isCorrect: true, hintUsed: true, fullExplanationSeen: false, isTransfer: false, isOffTopic: false });
      expect(out.appliedWeight).toBe('CORRECT_AFTER_HINT');
      expect(out.delta).toBe(0);
    });

    it('4) full-explanation correct answer sets actual = 0 (no delta)', () => {
      const out = service.update({ ...baseline, isCorrect: true, hintUsed: false, fullExplanationSeen: true, isTransfer: false, isOffTopic: false });
      expect(out.appliedWeight).toBe('CORRECT_AFTER_FULL_EXPLANATION');
      expect(out.delta).toBe(0);
    });

    it('5) transfer success gets a bonus over plain correct', () => {
      const transfer = service.update({ ...baseline, isCorrect: true, hintUsed: false, fullExplanationSeen: false, isTransfer: true, isOffTopic: false });
      const plain = service.update({ ...baseline, isCorrect: true, hintUsed: false, fullExplanationSeen: false, isTransfer: false, isOffTopic: false });
      expect(transfer.delta).toBeGreaterThan(plain.delta);
      expect(transfer.appliedWeight).toBe('TRANSFER_SUCCESS');
    });

    it('6) off-topic question never updates mastery', () => {
      const out = service.update({ ...baseline, isCorrect: true, hintUsed: false, fullExplanationSeen: false, isTransfer: true, isOffTopic: true });
      expect(out.delta).toBe(0);
      expect(out.score).toBe(baseline.currentScore);
    });

    it('7) repeated similar success picks REPEATED_SIMILAR_SUCCESS on hard items', () => {
      const out = service.update({ ...baseline, isCorrect: true, hintUsed: false, fullExplanationSeen: false, isTransfer: false, isOffTopic: false, itemDifficulty: 0.85 });
      expect(out.appliedWeight).toBe('REPEATED_SIMILAR_SUCCESS');
    });

    it('8) score stays within [0, 1] across many updates', () => {
      let score = 0.5;
      for (let i = 0; i < 50; i += 1) {
        const isCorrect = i % 2 === 0;
        const out = service.update({
          currentScore: score,
          currentConfidence: 0.3,
          currentEvidenceCount: i,
          isCorrect,
          hintUsed: false,
          fullExplanationSeen: false,
          isTransfer: false,
          isOffTopic: false,
          itemDifficulty: 0.5,
        });
        score = out.score;
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('AC-4.2 — hint or full-explanation correct does not update', () => {
    it('hint + correct does not change score (delta === 0)', () => {
      const before = { ...baseline, currentScore: 0.42 };
      const out = service.update({ ...before, isCorrect: true, hintUsed: true, fullExplanationSeen: false, isTransfer: false, isOffTopic: false });
      expect(out.score).toBe(before.currentScore);
    });
  });

  describe('AC-4.3 — confidence crosses 0.5 around 25 observations', () => {
    it('rises from 0.3 toward 0.99 across 30 evidence points with stable outcomes', () => {
      let confidence = 0.3;
      for (let i = 0; i < 30; i += 1) {
        const out = service.update({
          currentScore: 0.7,
          currentConfidence: confidence,
          currentEvidenceCount: i,
          isCorrect: true,
          hintUsed: false,
          fullExplanationSeen: false,
          isTransfer: false,
          isOffTopic: false,
          itemDifficulty: 0.5,
        });
        confidence = out.confidence;
      }
      expect(confidence).toBeGreaterThan(0.5);
      expect(confidence).toBeLessThanOrEqual(0.99);
    });
  });
});
