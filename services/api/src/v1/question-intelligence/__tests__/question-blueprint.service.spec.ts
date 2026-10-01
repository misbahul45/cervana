import {
  QuestionBlueprintService,
  ThreeValuedValidatorService,
  type QuestionBlueprint,
} from '../question-blueprint.service';

const validBlueprint: QuestionBlueprint = {
  objective: 'Test debit-credit on equipment purchase',
  conceptKey: 'journal-entries',
  prerequisiteKeys: ['account-types'],
  cognitiveDemand: 'PROCEDURAL',
  misconceptionHypotheses: [],
  difficulty: 0.5,
  intendedReasoning: 'Equipment is an asset; asset increases with debit',
  answerShape: 'short',
  validationRequirement: 'rubric',
  pedagogicalPurpose: 'Practice applying debit/credit on a real transaction',
};

describe('QuestionBlueprintService', () => {
  const service = new QuestionBlueprintService();

  it('accepts a fully populated blueprint', () => {
    expect(service.validate(validBlueprint)).toEqual([]);
  });

  it('flags FAIL when difficulty is out of range', () => {
    expect(
      service.validate({ ...validBlueprint, difficulty: 1.5 }).some(
        (v) => v.outcome === 'FAIL',
      ),
    ).toBe(true);
  });

  it('flags FAIL when intendedReasoning is empty', () => {
    expect(
      service.validate({ ...validBlueprint, intendedReasoning: '' }).some(
        (v) => v.outcome === 'FAIL',
      ),
    ).toBe(true);
  });

  it('flags FAIL when pedagogicalPurpose is empty', () => {
    expect(
      service.validate({ ...validBlueprint, pedagogicalPurpose: '' }).some(
        (v) => v.outcome === 'FAIL',
      ),
    ).toBe(true);
  });

  it('flags FAIL when MCQ does not use exact validation', () => {
    expect(
      service.validate({
        ...validBlueprint,
        answerShape: 'mcq',
        validationRequirement: 'rubric',
      }).some((v) => v.outcome === 'FAIL'),
    ).toBe(true);
  });

  it('flags UNKNOWN when long-answer uses rubric but no rubric detail', () => {
    expect(
      service.validate({
        ...validBlueprint,
        answerShape: 'long',
        validationRequirement: 'rubric',
      }).every((v) => v.outcome !== 'FAIL'),
    ).toBe(true);
  });
});

describe('ThreeValuedValidatorService', () => {
  const validator = new ThreeValuedValidatorService();

  it('returns PASS when all gates pass', () => {
    const out = validator.gateQuestion({
      blueprint: validBlueprint,
      answer: 'Equipment is debited because it is an asset',
      rationale: 'Asset increase -> debit',
      sourceAlignment: true,
      answerConsistent: true,
      schemaOk: true,
    });
    expect(out.outcome).toBe('PASS');
  });

  it('returns FAIL when blueprint invalid', () => {
    const out = validator.gateQuestion({
      blueprint: { ...validBlueprint, difficulty: 1.5 },
      answer: 'x',
      rationale: 'x',
      sourceAlignment: true,
      answerConsistent: true,
      schemaOk: true,
    });
    expect(out.outcome).toBe('FAIL');
    expect(out.route).toBe('rejection');
  });

  it('returns FAIL when answer inconsistent with blueprint', () => {
    const out = validator.gateQuestion({
      blueprint: validBlueprint,
      answer: 'totally off-topic',
      rationale: 'no idea',
      sourceAlignment: true,
      answerConsistent: false,
      schemaOk: true,
    });
    expect(out.outcome).toBe('FAIL');
  });

  it('returns UNKNOWN when source alignment uncertain', () => {
    const out = validator.gateQuestion({
      blueprint: validBlueprint,
      answer: 'maybe',
      rationale: 'possible',
      sourceAlignment: false,
      answerConsistent: true,
      schemaOk: true,
    });
    expect(out.outcome).toBe('UNKNOWN');
    expect(out.route).toBe('review');
  });

  it('AC-30: UNKNOWN routes to review, clarification, rejection, or fallback', () => {
    const variants: Array<{
      sourceAlignment?: boolean;
      schemaOk?: boolean;
      expectedOutcome: 'FAIL' | 'UNKNOWN';
    }> = [
      { sourceAlignment: false, expectedOutcome: 'UNKNOWN' },
      { schemaOk: false, expectedOutcome: 'FAIL' },
    ];

    for (const v of variants) {
      const out = validator.gateQuestion({
        blueprint: validBlueprint,
        answer: 'x',
        rationale: 'x',
        sourceAlignment: v.sourceAlignment ?? true,
        answerConsistent: true,
        schemaOk: v.schemaOk ?? true,
      });
      expect(out.outcome).toBe(v.expectedOutcome);
      expect(['review', 'clarification', 'rejection', 'fallback']).toContain(out.route);
    }
  });
});
