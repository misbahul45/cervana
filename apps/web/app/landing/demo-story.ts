import { applyProposal, initialSnapshot, presetProposal, type ExperienceSnapshot } from './experience';
import { decideNextTopic, type NextTopicDecision } from './policy';
import { composeSession, type SessionStep } from './session';

export const EQUATION_TOPIC_ID = 'l1-t01-accounting-equation';
export const DEBIT_CREDIT_TOPIC_ID = 'l1-t02-debits-credits';
export const JOURNAL_TOPIC_ID = 'l1-t03-journal-entries';

export interface DemoLearner {
  readonly mastery: Readonly<Record<string, number>>;
  readonly misconceptionTopicIds: readonly string[];
  readonly resolvedMisconceptions: number;
  readonly coreConceptsMastered: number;
  readonly scenariosPassed: number;
}

export const HERO_LEARNER: DemoLearner = {
  mastery: { [EQUATION_TOPIC_ID]: 0.82, [DEBIT_CREDIT_TOPIC_ID]: 0.42 },
  misconceptionTopicIds: [DEBIT_CREDIT_TOPIC_ID],
  resolvedMisconceptions: 0,
  coreConceptsMastered: 1,
  scenariosPassed: 0,
};

const STORY_START_LEARNER: DemoLearner = {
  mastery: { [EQUATION_TOPIC_ID]: 0.82, [DEBIT_CREDIT_TOPIC_ID]: 0.55 },
  misconceptionTopicIds: [],
  resolvedMisconceptions: 0,
  coreConceptsMastered: 1,
  scenariosPassed: 0,
};

export type StoryStepId =
  | 'minutes'
  | 'repeatedError'
  | 'recover'
  | 'socratic'
  | 'harder'
  | 'mastered'
  | 'creator';

export interface StoryStep {
  readonly id: StoryStepId;
  readonly speaker: 'learner' | 'system';
}

export const STORY_STEPS: readonly StoryStep[] = [
  { id: 'minutes', speaker: 'learner' },
  { id: 'repeatedError', speaker: 'learner' },
  { id: 'recover', speaker: 'system' },
  { id: 'socratic', speaker: 'learner' },
  { id: 'harder', speaker: 'learner' },
  { id: 'mastered', speaker: 'learner' },
  { id: 'creator', speaker: 'system' },
];

export interface StoryFrame {
  readonly index: number;
  readonly experience: ExperienceSnapshot;
  readonly learner: DemoLearner;
  readonly decision: NextTopicDecision;
  readonly session: readonly SessionStep[];
  readonly rewardVisible: boolean;
  readonly creatorVisible: boolean;
}

function decisionFor(learner: DemoLearner): NextTopicDecision {
  return decideNextTopic({
    mastery: learner.mastery,
    activeMisconceptionTopicIds: learner.misconceptionTopicIds,
  });
}

export function frameAt(index: number): StoryFrame {
  const bounded = Math.max(0, Math.min(STORY_STEPS.length - 1, index));
  let experience = initialSnapshot();
  let learner = STORY_START_LEARNER;
  let rewardVisible = false;
  let creatorVisible = false;

  for (let step = 0; step <= bounded; step += 1) {
    const id = STORY_STEPS[step]!.id;
    if (id === 'minutes') {
      experience = applyProposal(experience, presetProposal(id, { sessionMinutes: 5 }));
    } else if (id === 'repeatedError') {
      learner = {
        ...learner,
        mastery: { ...learner.mastery, [DEBIT_CREDIT_TOPIC_ID]: 0.42 },
        misconceptionTopicIds: [DEBIT_CREDIT_TOPIC_ID],
      };
    } else if (id === 'socratic') {
      experience = applyProposal(experience, presetProposal(id, { teachingMode: 'socratic' }));
    } else if (id === 'harder') {
      experience = applyProposal(experience, presetProposal(id, { difficulty: experience.values.difficulty + 1 }));
    } else if (id === 'mastered') {
      learner = {
        ...learner,
        mastery: { ...learner.mastery, [DEBIT_CREDIT_TOPIC_ID]: 0.78 },
        misconceptionTopicIds: [],
        resolvedMisconceptions: 1,
        coreConceptsMastered: 2,
      };
      rewardVisible = true;
    } else if (id === 'creator') {
      creatorVisible = true;
    }
  }

  return {
    index: bounded,
    experience,
    learner,
    decision: decisionFor(learner),
    session: composeSession(experience.values.sessionMinutes, learner.misconceptionTopicIds.length > 0),
    rewardVisible,
    creatorVisible,
  };
}
