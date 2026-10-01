import { randomUUID } from 'crypto';
import { TutorService } from '../tutor.service';
import { MasteryService } from '../../learner-model/services/mastery.service';
import { MisconceptionLifecycleService } from '../../misconception/misconception-lifecycle.service';
import { QuestionUnderstandingService } from '../../question-intelligence/question-understanding.service';
import { QuestionBlueprintService, ThreeValuedValidatorService } from '../../question-intelligence/question-blueprint.service';
import { AdaptivePolicyService } from '../../policy/adaptive-policy.service';
import { PersonalPolicyService } from '../../policy/personal-policy.service';

describe('TutorService — integration', () => {
  const userId = '00000000-0000-0000-0000-000000000001';
  const mastery = new MasteryService();
  const misconception = new MisconceptionLifecycleService();
  const questionUnderstanding = new QuestionUnderstandingService();
  const blueprint = new QuestionBlueprintService();
  const validator = new ThreeValuedValidatorService();
  const policy = new AdaptivePolicyService();
  const personalPolicy = new PersonalPolicyService();

  const fakePrisma = {
    topicMasteryRecord: {
      findUnique: jest.fn().mockResolvedValue({
        score: 0.4,
        confidence: 0.3,
        evidenceCount: 2,
      }),
    },
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

  const service = new TutorService(
    fakePrisma,
    mastery,
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
      mastery,
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
});
