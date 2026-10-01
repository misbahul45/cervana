import { QuestionUnderstandingService } from '../question-understanding.service';

describe('QuestionUnderstandingService', () => {
  const service = new QuestionUnderstandingService();

  describe('AC-161: identifies conceptual confusion, does not assert misconception certainty', () => {
    it('detects doubt intent on a transactional question without claiming CONFIRMED misconception', () => {
      const out = service.understand({
        text: 'Kenapa equipment itu di-debit ketika kas keluar?',
        domain: 'accounting',
        recentTopic: 'journal-entries',
      });
      expect(out.intent).toBe('DOUBT');
      expect(out.misconceptionHypotheses).toEqual([]);
    });

    it('produces misconception hypotheses only when error tokens are present', () => {
      const withError = service.understand({
        text: 'Kenapa ini salah? Apakah jawaban saya benar?',
        domain: 'accounting',
      });
      expect(withError.misconceptionHypotheses.length).toBeGreaterThan(0);
      expect(withError.misconceptionHypotheses[0].confidence).toBeLessThanOrEqual(0.5);
    });
  });

  describe('AC-162: WHY -> COUNTEREXAMPLE -> TRANSFER -> REFLECTION for low-depth learner', () => {
    it('classifies WHY questions as cognitive demand WHY', () => {
      const out = service.understand({
        text: 'Mengapa debit meningkatkan aset?',
        domain: 'accounting',
      });
      expect(out.cognitiveDemand).toBe('WHY');
    });

    it('classifies counterfactual questions as COUNTERFACTUAL', () => {
      const out = service.understand({
        text: 'Bagaimana jika kita tidak mencatat transaksi?',
        domain: 'accounting',
      });
      expect(out.cognitiveDemand).toBe('COUNTERFACTUAL');
    });

    it('classifies transfer questions as TRANSFER', () => {
      const out = service.understand({
        text: 'Terapkan konsep double-entry pada kasus lain',
        domain: 'accounting',
      });
      expect(out.intent).toBe('TRANSFER');
    });
  });

  describe('AC-23 schema completeness', () => {
    it('produces a fully populated structure with all required keys', () => {
      const out = service.understand({
        text: 'Apa itu debit?',
        domain: 'accounting',
        conceptIds: ['c-1'],
        prerequisiteIds: ['c-0'],
      });
      expect(out.intent).toBeDefined();
      expect(out.domain).toBe('accounting');
      expect(out.conceptIds).toEqual(['c-1']);
      expect(out.prerequisiteIds).toEqual(['c-0']);
      expect(out.cognitiveDemand).toBeDefined();
      expect(out.ambiguity).toBeGreaterThanOrEqual(0);
      expect(out.difficultyEstimate).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(out.misconceptionHypotheses)).toBe(true);
      expect(typeof out.requestedHelp).toBe('boolean');
      expect(typeof out.needsDomainTool).toBe('boolean');
      expect(Array.isArray(out.evidenceRequired)).toBe(true);
    });
  });

  describe('Unresolved concept triggers clarifying question', () => {
    it('produces clarifyingQuestion when conceptIds empty', () => {
      const out = service.understand({
        text: 'Kenapa?',
        domain: 'accounting',
      });
      expect(out.conceptIds).toEqual([]);
      expect(out.clarifyingQuestion).toBeDefined();
      expect(out.clarifyingQuestion!.length).toBeGreaterThan(0);
    });
  });

  describe('High ambiguity triggers diagnostic question', () => {
    it('produces diagnostic clarifying question when ambiguity > 0.6', () => {
      const out = service.understand({
        text: 'huh?',
        domain: 'accounting',
      });
      expect(out.ambiguity).toBeGreaterThan(0.6);
      expect(out.clarifyingQuestion).toBeDefined();
      expect(out.clarifyingQuestion).toContain('share more detail');
    });
  });

  describe('Domain tool detection', () => {
    it('flags needsDomainTool for accounting journal question', () => {
      const out = service.understand({
        text: 'Bagaimana cara mencatat jurnal umum?',
        domain: 'accounting',
      });
      expect(out.needsDomainTool).toBe(true);
    });

    it('does not flag domain tool for non-accounting', () => {
      const out = service.understand({
        text: 'Bagaimana cara menghitung integral?',
        domain: 'mathematics',
      });
      expect(out.needsDomainTool).toBe(false);
    });
  });
});
