import { randomUUID } from 'crypto';
import { TutorService } from '../tutor.service';
import { LearnerPolicyService } from '../../learner-model/policy/learner-policy.service';
import { MisconceptionLifecycleService } from '../../misconception/misconception-lifecycle.service';
import { QuestionUnderstandingService } from '../../question-intelligence/question-understanding.service';
import { QuestionBlueprintService, ThreeValuedValidatorService } from '../../question-intelligence/question-blueprint.service';
import { PersonalPolicyService } from '../../policy/personal-policy.service';

describe('TutorService — integration', () => {
  const userId = '00000000-0000-0000-0000-000000000001';
  const misconception = new MisconceptionLifecycleService();
  const questionUnderstanding = new QuestionUnderstandingService();
  const blueprint = new QuestionBlueprintService();
  const validator = new ThreeValuedValidatorService();
  const policy = new LearnerPolicyService();
  const personalPolicy = new PersonalPolicyService();

  const fakePrisma = {
    misconception: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(null),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    episode: {
      create: jest.fn().mockImplementation(async ({ data }) => ({ id: randomUUID(), ...data })),
    },
    decisionTrace: {
      create: jest.fn().mockImplementation(async ({ data }) => ({ id: randomUUID(), ...data })),
    },
  } as never;

  const conceptState = (overrides: { score?: number; evidenceCount?: number; prerequisiteMasteryMet?: boolean } = {}) => ({
    conceptId: 'l1-t03-journal-entries',
    title: 'Journal Entries',
    level: 1,
    mastery: { score: overrides.score ?? 0.4, confidence: 0.1, evidenceCount: overrides.evidenceCount ?? 2, lastEventAt: null },
    prerequisites: [],
    prerequisiteMasteryMet: overrides.prerequisiteMasteryMet ?? true,
  });

  const learnerState = { conceptState: jest.fn().mockResolvedValue(conceptState()) };

  const service = new TutorService(
    fakePrisma,
    learnerState as never,
    misconception,
    questionUnderstanding,
    blueprint,
    validator,
    policy,
    personalPolicy,
  );

  it('AC-201: full pipeline returns traceId, episodeId, response', async () => {
    const out = await service.respond({
      userId,
      text: 'Bagaimana cara mencatat jurnal umum?',
      domain: 'accounting',
      recentTopic: 'journal-entries',
    });
    expect(out.traceId).toBeDefined();
    expect(out.episodeId).toBeDefined();
    expect(out.responseText.length).toBeGreaterThan(0);
    expect(out.intent).toBeDefined();
    expect(out.strategy).toBeDefined();
    expect(out.stopReason).toMatch(/^(OK|CLARIFICATION_NEEDED|HIGH_AMBIGUITY|BUDGET)$/);
  });

  it('AC-208: each response produces a DecisionTrace row (verified by fake prisma call)', async () => {
    const fakeEp = { create: jest.fn().mockResolvedValue({ id: randomUUID() }) };
    const fakeDt = { create: jest.fn().mockResolvedValue({ id: randomUUID() }) };
    const prisma = Object.assign({}, fakePrisma, {
      episode: fakeEp,
      decisionTrace: fakeDt,
    });
    const svc = new TutorService(
      prisma as never,
      learnerState as never,
      misconception,
      questionUnderstanding,
      blueprint,
      validator,
      policy,
      personalPolicy,
    );
    await svc.respond({
      userId,
      text: 'Apa itu debit?',
      domain: 'accounting',
      conceptKey: 'journal-entries',
    });
    expect(fakeEp.create).toHaveBeenCalledTimes(1);
    expect(fakeDt.create).toHaveBeenCalledTimes(1);
    const dtArgs = fakeDt.create.mock.calls[0][0];
    expect(dtArgs.data.strategyJson).toBeDefined();
    expect(dtArgs.data.responseText).toBeDefined();
  });

  it('AC-163: short input triggers high ambiguity + clarifying question', async () => {
    const out = await service.respond({
      userId,
      text: 'apa?',
      domain: 'accounting',
    });
    expect(out.stopReason).toBe('CLARIFICATION_NEEDED');
    expect(out.clarifyingQuestion).toBeDefined();
  });

  it('AC-204: produces a structured AdaptiveTutoringStrategy in invariants', async () => {
    const out = await service.respond({
      userId,
      text: 'Mengapa debit meningkatkan aset?',
      domain: 'accounting',
      recentTopic: 'journal-entries',
    });
    expect(out.invariants).toHaveProperty('difficultyInZone');
    expect(out.invariants).toHaveProperty('masteryStable');
    expect(out.invariants).toHaveProperty('policyEvidenceSufficient');
    expect(typeof out.invariants.difficultyInZone).toBe('boolean');
  });

  describe('learner state comes from the concept mastery', () => {
    const build = (state: unknown) => {
      const reader = { conceptState: jest.fn().mockResolvedValue(state) };
      const svc = new TutorService(fakePrisma, reader as never, misconception, questionUnderstanding, blueprint, validator, policy, personalPolicy);
      return { svc, reader };
    };
    const ask = (svc: TutorService, conceptKey?: string) =>
      svc.respond({ userId, text: 'Mengapa debit meningkatkan aset?', domain: 'accounting', conceptKey });

    it('asks for the state of the concept named in the request, for this learner only', async () => {
      const { svc, reader } = build(conceptState());

      await ask(svc, 'l1-t03-journal-entries');

      expect(reader.conceptState).toHaveBeenCalledWith(userId, 'l1-t03-journal-entries');
    });

    it('does not read learner state when no concept is named', async () => {
      const { svc, reader } = build(conceptState());

      const out = await ask(svc);

      expect(reader.conceptState).not.toHaveBeenCalled();
      expect(out.reasonCodes).toContain('INSUFFICIENT_EVIDENCE');
    });

    it('treats a concept the registry does not know as a learner without evidence', async () => {
      const { svc } = build(null);

      const out = await ask(svc, 'free-text-key');

      expect(out.invariants.masteryStable).toBe(false);
      expect(out.reasonCodes).toContain('INSUFFICIENT_EVIDENCE');
    });

    it('marks mastery stable and drops the evidence warning once three events back it', async () => {
      const { svc } = build(conceptState({ evidenceCount: 6, score: 0.8 }));

      const out = await ask(svc, 'l1-t03-journal-entries');

      expect(out.invariants.masteryStable).toBe(true);
      expect(out.reasonCodes).not.toContain('INSUFFICIENT_EVIDENCE');
    });

    it('remediates a new concept whose prerequisites are not passed', async () => {
      const { svc } = build(conceptState({ prerequisiteMasteryMet: false, evidenceCount: 6 }));

      const out = await ask(svc, 'l1-t03-journal-entries');

      expect(out.intent).toBe('NEW_LEARNING');
      expect(out.strategy).toBe('REMEDIATE');
      expect(out.reasonCodes).toContain('PREREQUISITE_NOT_MET');
    });

    it('uses a different strategy for the same question once the prerequisites are passed', async () => {
      const { svc } = build(conceptState({ prerequisiteMasteryMet: true, evidenceCount: 6, score: 0.2 }));

      const out = await ask(svc, 'l1-t03-journal-entries');

      expect(out.strategy).toBe('WORKED_EXAMPLE');
      expect(out.reasonCodes).toContain('LOW_MASTERY');
    });

    it('returns the reason codes and keeps rationale as their readable form', async () => {
      const { svc } = build(conceptState());

      const out = await ask(svc, 'l1-t03-journal-entries');

      expect(out.rationale).toBe(out.reasonCodes.join(', '));
    });

    it('stores the reason codes in the decision trace', async () => {
      const decisionTrace = { create: jest.fn().mockResolvedValue({ id: randomUUID() }) };
      const prisma = Object.assign({}, fakePrisma, { decisionTrace, episode: { create: jest.fn().mockResolvedValue({ id: randomUUID() }) } });
      const reader = { conceptState: jest.fn().mockResolvedValue(conceptState()) };
      const svc = new TutorService(prisma as never, reader as never, misconception, questionUnderstanding, blueprint, validator, policy, personalPolicy);

      await ask(svc, 'l1-t03-journal-entries');

      expect(decisionTrace.create.mock.calls[0][0].data.strategyJson.reasonCodes).toEqual(expect.arrayContaining([expect.any(String)]));
    });
  });
});
