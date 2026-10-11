import { EMPTY_CONCEPT_STATE, foldAssessment } from '@/v1/learner-model/mastery/mastery-v1';
import {
  REWARD_RULES,
  RewardGrant,
  conceptPassedKey,
  evaluateAssessment,
  masteryProgressKey,
  masteryProgressPoints,
  streakBonus,
} from '../reward-rules';

const at = (n: number) => new Date(Date.UTC(2026, 9, n));

interface Attempt {
  score: number;
  attemptNumber?: number;
  items?: number;
  hintsUsed?: number;
}

const play = (attempts: Attempt[], conceptId = 'c1') => {
  let state = EMPTY_CONCEPT_STATE;
  let paid = 0;
  const grants: RewardGrant[][] = [];
  attempts.forEach((attempt, index) => {
    state = foldAssessment(
      state,
      { score: attempt.score, items: attempt.items ?? 5, hintsUsed: attempt.hintsUsed ?? 0, share: 1, attemptNumber: attempt.attemptNumber ?? 1 },
      { occurredAt: at(index + 1), streamSeq: index + 1 },
    );
    const result = evaluateAssessment({ userId: 'u1', conceptId, eventId: `e${index + 1}`, after: state, alreadyPaidProgress: paid });
    paid += result.filter((g) => g.ruleId === 'MASTERY_PROGRESS').reduce((sum, g) => sum + g.points, 0);
    grants.push(result);
  });
  return { grants, paid, state };
};

const progress = (grants: RewardGrant[]) => grants.filter((g) => g.ruleId === 'MASTERY_PROGRESS').reduce((s, g) => s + g.points, 0);
const total = (all: RewardGrant[][]) => all.flat().reduce((s, g) => s + g.points, 0);

describe('reward rules', () => {
  it('names each rule with a version so that a stored entry says which rule paid it', () => {
    expect(REWARD_RULES.MASTERY_PROGRESS).toEqual({ id: 'MASTERY_PROGRESS', version: 1 });
    expect(REWARD_RULES.CONCEPT_PASSED).toEqual({ id: 'CONCEPT_PASSED', version: 1 });
    expect(REWARD_RULES.STREAK_BONUS_7).toEqual({ id: 'STREAK_BONUS_7', version: 1 });
  });

  describe('masteryProgressPoints', () => {
    it.each([
      [0.5, 0, 0],
      [0.42, 0, 0],
      [0.622, 0, 12],
      [0.703, 12, 8],
      [0.8198, 29, 2],
      [1, 0, 50],
      [1, 50, 0],
    ])('score %s with %s already paid pays %s', (score, paid, expected) => {
      expect(masteryProgressPoints(score, paid)).toBe(expected);
    });

    it('never pays more than the remaining cap of 50 per concept, even for a corrupt score or payment', () => {
      expect(masteryProgressPoints(7, 0)).toBe(50);
      expect(masteryProgressPoints(0.9, 80)).toBe(0);
      expect(masteryProgressPoints(Number.NaN, 0)).toBe(0);
    });
  });

  describe('reference run: five perfect five-question attempts on one concept', () => {
    const run = play(Array.from({ length: 5 }, () => ({ score: 1 })));

    it('pays progress 12, 8, 5, 4 and 2', () => {
      expect(run.grants.map((g) => progress(g))).toEqual([12, 8, 5, 4, 2]);
    });

    it('offers the pass grant from the third attempt on, never before, always under the same key', () => {
      const offered = run.grants.map((g) => g.filter((x) => x.ruleId === 'CONCEPT_PASSED'));

      expect(offered.map((g) => g.length)).toEqual([0, 0, 1, 1, 1]);
      expect(new Set(offered.flat().map((g) => g.idempotencyKey))).toEqual(new Set(['reward:CONCEPT_PASSED:v1:u1:c1']));
      expect(offered[2][0]).toMatchObject({ points: 50, sourceId: 'e3' });
    });

    it('totals 81 points once the ledger has dropped the repeated pass grants: 31 of progress and 50 for passing', () => {
      const unique = new Map(run.grants.flat().map((g) => [g.idempotencyKey, g.points]));

      expect(run.paid).toBe(31);
      expect([...unique.values()].reduce((sum, points) => sum + points, 0)).toBe(81);
    });
  });

  describe('properties', () => {
    it('pays no more than 50 progress points per concept whatever the sequence', () => {
      const run = play(Array.from({ length: 200 }, () => ({ score: 1 })));

      expect(run.paid).toBeLessThanOrEqual(50);
    });

    it('pays the progress of the highest score reached and nothing for regaining a score', () => {
      const run = play([{ score: 1 }, { score: 1 }, { score: 0 }, { score: 0 }, { score: 1 }, { score: 1 }]);

      expect(run.paid).toBe(20);
      expect(run.grants.slice(2).map((g) => g.filter((x) => x.ruleId === 'MASTERY_PROGRESS').length)).toEqual([0, 0, 0, 0]);
    });

    it('pays exactly floor(100 x (peak - 0.5)) in total for any sequence of scores', () => {
      let seed = 11;
      const random = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      for (let round = 0; round < 40; round += 1) {
        const attempts = Array.from({ length: 12 }, () => ({ score: Math.round(random() * 4) / 4, items: 1 + Math.floor(random() * 6) }));
        let state = EMPTY_CONCEPT_STATE;
        let peak = 0.5;
        attempts.forEach((a, i) => {
          state = foldAssessment(state, { ...a, hintsUsed: 0, share: 1, attemptNumber: 1 }, { occurredAt: at(1), streamSeq: i + 1 });
          peak = Math.max(peak, state.score);
        });

        expect(play(attempts).paid).toBe(Math.floor(100 * (peak - 0.5)));
      }
    });

    it('keeps eight retakes of one quiz below 20 points and without the pass grant', () => {
      const run = play(Array.from({ length: 8 }, (_, i) => ({ score: 1, attemptNumber: i + 1 })));

      expect(run.paid).toBeLessThan(20);
      expect(run.grants.flat().some((g) => g.ruleId === 'CONCEPT_PASSED')).toBe(false);
    });

    it('pays nothing for a failed first attempt and nothing for a score below even odds', () => {
      const run = play([{ score: 0 }, { score: 0.2 }]);

      expect(run.grants.flat()).toEqual([]);
    });

    it('does not reach the pass grant on two events however good they are', () => {
      const run = play([{ score: 1 }, { score: 1 }]);

      expect(run.grants.flat().some((g) => g.ruleId === 'CONCEPT_PASSED')).toBe(false);
    });
  });

  describe('grant shape', () => {
    const grants = evaluateAssessment({
      userId: 'u1',
      conceptId: 'c1',
      eventId: 'evt-9',
      after: { score: 0.8, evidenceCount: 4 },
      alreadyPaidProgress: 0,
    });

    it('derives the key of a progress grant from the event, so replaying the event pays once', () => {
      expect(masteryProgressKey('evt-9')).toBe('reward:MASTERY_PROGRESS:v1:evt-9');
      expect(grants.find((g) => g.ruleId === 'MASTERY_PROGRESS')).toMatchObject({
        points: 30,
        ruleVersion: 1,
        idempotencyKey: 'reward:MASTERY_PROGRESS:v1:evt-9',
        sourceType: 'LEARNING_EVENT',
        sourceId: 'evt-9',
        conceptId: 'c1',
      });
    });

    it('derives the key of the pass grant from the learner and the concept, so it is paid once ever', () => {
      expect(conceptPassedKey('u1', 'c1')).toBe('reward:CONCEPT_PASSED:v1:u1:c1');
      expect(grants.find((g) => g.ruleId === 'CONCEPT_PASSED')).toMatchObject({ points: 50, sourceType: 'LEARNING_EVENT', sourceId: 'evt-9', conceptId: 'c1' });
    });

    it('omits a grant that would be worth nothing', () => {
      const none = evaluateAssessment({ userId: 'u1', conceptId: 'c1', eventId: 'e', after: { score: 0.45, evidenceCount: 1 }, alreadyPaidProgress: 0 });

      expect(none).toEqual([]);
    });
  });

  describe('streakBonus', () => {
    it('pays 50 on every seventh consecutive day and nothing otherwise', () => {
      expect([1, 6, 7, 8, 13, 14, 21].map((n) => streakBonus('u1', n, at(9))?.points ?? 0)).toEqual([0, 0, 50, 0, 0, 50, 50]);
    });

    it('is keyed by the learner and the day, so one day pays once even when the request is repeated', () => {
      expect(streakBonus('u1', 7, new Date(Date.UTC(2026, 9, 9, 3)))).toMatchObject({
        ruleId: 'STREAK_BONUS_7',
        ruleVersion: 1,
        idempotencyKey: 'reward:STREAK_BONUS_7:v1:u1:2026-10-09',
        sourceType: 'STREAK',
      });
      expect(streakBonus('u1', 7, new Date(Date.UTC(2026, 9, 9, 23)))?.idempotencyKey).toBe('reward:STREAK_BONUS_7:v1:u1:2026-10-09');
    });
  });
});
