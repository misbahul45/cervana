import {
  AssessmentEvidence,
  ConceptState,
  EMPTY_CONCEPT_STATE,
  MASTERY_MODEL_VERSION,
  foldAssessment,
  replay,
} from '../mastery-v1';

const at = (n: number) => new Date(Date.UTC(2026, 9, n));

const evidence = (overrides: Partial<AssessmentEvidence> = {}): AssessmentEvidence => ({
  score: 1,
  items: 5,
  hintsUsed: 0,
  share: 1,
  attemptNumber: 1,
  ...overrides,
});

const run = (sequence: AssessmentEvidence[]): ConceptState[] => {
  const states: ConceptState[] = [];
  let state = EMPTY_CONCEPT_STATE;
  sequence.forEach((e, index) => {
    state = foldAssessment(state, e, { occurredAt: at(index + 1), streamSeq: index + 1 });
    states.push(state);
  });
  return states;
};

const scores = (sequence: AssessmentEvidence[]) => run(sequence).map((s) => s.score);

const repeat = (count: number, overrides: Partial<AssessmentEvidence> = {}) =>
  Array.from({ length: count }, () => evidence(overrides));

describe('mastery-v1', () => {
  it('is named so that stored projections can say which formula produced them', () => {
    expect(MASTERY_MODEL_VERSION).toBe('mastery-v1');
  });

  it('starts from no evidence: even odds, no confidence', () => {
    expect(EMPTY_CONCEPT_STATE).toMatchObject({ theta: 0, evidenceCount: 0, score: 0.5, confidence: 0, lastSeq: 0, lastEventAt: null });
  });

  describe('reference sequences (values computed independently in Python)', () => {
    const expectSequence = (actual: number[], expected: number[]) => {
      expect(actual).toHaveLength(expected.length);
      actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 3));
    };

    it('five attempts at 100 percent', () => {
      expectSequence(scores(repeat(5)), [0.622, 0.703, 0.756, 0.793, 0.82]);
    });

    it('three attempts at 70 percent converge towards 0.7 from below', () => {
      expectSequence(scores(repeat(3, { score: 0.7 })), [0.55, 0.585, 0.61]);
    });

    it('four attempts at 100 percent on the same quiz gain less each time', () => {
      const sequence = [1, 2, 3, 4].map((attemptNumber) => evidence({ attemptNumber }));

      expectSequence(scores(sequence), [0.622, 0.664, 0.681, 0.688]);
    });

    it('a failed attempt after eight perfect ones costs a visible but partial amount', () => {
      const states = scores([...repeat(8), evidence({ score: 0 })]);

      expect(states[7]).toBeCloseTo(0.869, 3);
      expect(states[8]).toBeCloseTo(0.78, 3);
    });

    it('hints shrink the first gain of theta from 0.5 to 0.3, 0.18 and 0.108', () => {
      const gains = [0, 1, 2, 3].map((hintsUsed) => run([evidence({ hintsUsed })])[0].theta);

      expectSequence(gains, [0.5, 0.3, 0.18, 0.108]);
    });

    it('a quiz shared by four concepts credits each a quarter', () => {
      expect(scores(repeat(5, { share: 0.25 }))[4]).toBeCloseTo(0.625, 3);
    });
  });

  describe('evidence weight', () => {
    const firstTheta = (overrides: Partial<AssessmentEvidence>) => run([evidence(overrides)])[0].theta;

    it('counts a one-question quiz a fifth of a five-question quiz', () => {
      expect(firstTheta({ items: 1 })).toBeCloseTo(firstTheta({ items: 5 }) / 5, 10);
    });

    it('stops counting items beyond five', () => {
      expect(firstTheta({ items: 12 })).toBeCloseTo(firstTheta({ items: 5 }), 10);
    });

    it('scales with the share of the attempt credited to the concept', () => {
      expect(firstTheta({ share: 0.5 })).toBeCloseTo(firstTheta({ share: 1 }) / 2, 10);
    });

    it('halves the weight with each retake of the same quiz', () => {
      expect(firstTheta({ attemptNumber: 2 })).toBeCloseTo(firstTheta({ attemptNumber: 1 }) / 2, 10);
      expect(firstTheta({ attemptNumber: 4 })).toBeCloseTo(firstTheta({ attemptNumber: 1 }) / 8, 10);
    });

    it('keeps the total credit of endless retakes small', () => {
      const retakes = Array.from({ length: 40 }, (_, i) => evidence({ attemptNumber: i + 1 }));

      expect(Math.max(...scores(retakes))).toBeLessThan(0.7);
    });
  });

  describe('hints', () => {
    const afterMastery = () => run(repeat(6)).at(-1)!;

    it('damp a gain for every hint up to three and no further', () => {
      const base = EMPTY_CONCEPT_STATE;
      const gain = (hintsUsed: number) =>
        foldAssessment(base, evidence({ hintsUsed }), { occurredAt: at(1), streamSeq: 1 }).theta - base.theta;

      expect(gain(3)).toBeCloseTo(gain(0) * 0.6 ** 3, 10);
      expect(gain(9)).toBeCloseTo(gain(3), 10);
    });

    it('never reduce what a wrong answer costs', () => {
      const state = afterMastery();
      const loss = (hintsUsed: number) =>
        state.theta - foldAssessment(state, evidence({ score: 0, hintsUsed }), { occurredAt: at(9), streamSeq: 9 }).theta;

      expect(loss(3)).toBeCloseTo(loss(0), 10);
      expect(loss(0)).toBeGreaterThan(0);
    });
  });

  describe('difficulty', () => {
    it('pays more for succeeding on a harder item and less for failing it', () => {
      const first = (difficulty: number, score: number) => run([evidence({ difficulty, score })])[0].theta;

      expect(first(1, 1)).toBeGreaterThan(first(0, 1));
      expect(first(1, 0)).toBeGreaterThan(first(0, 0));
      expect(first(-1, 0)).toBeLessThan(first(0, 0));
    });

    it('clamps the difficulty to three logits either way', () => {
      const first = (difficulty: number) => run([evidence({ difficulty })])[0].theta;

      expect(first(50)).toBeCloseTo(first(3), 10);
      expect(first(-50)).toBeCloseTo(first(-3), 10);
    });
  });

  describe('bounds and shape', () => {
    it('keeps theta within six logits and score and confidence inside the unit interval', () => {
      const states = run([...repeat(800), ...repeat(800, { score: 0 })]);

      for (const state of states) {
        expect(Math.abs(state.theta)).toBeLessThanOrEqual(6);
        expect(state.score).toBeGreaterThan(0);
        expect(state.score).toBeLessThan(1);
        expect(state.confidence).toBeGreaterThanOrEqual(0);
        expect(state.confidence).toBeLessThan(1);
      }
    });

    it('pulls a stored theta that lies outside the limit back to it', () => {
      const corrupt: ConceptState = { ...EMPTY_CONCEPT_STATE, theta: 9, evidenceCount: 3 };
      const low: ConceptState = { ...EMPTY_CONCEPT_STATE, theta: -9, evidenceCount: 3 };

      expect(foldAssessment(corrupt, evidence(), { occurredAt: at(1), streamSeq: 1 }).theta).toBe(6);
      expect(foldAssessment(low, evidence({ score: 0 }), { occurredAt: at(1), streamSeq: 1 }).theta).toBe(-6);
    });

    it('reports confidence as the share of the initial uncertainty already spent', () => {
      const states = run(repeat(20));

      expect(states[0].confidence).toBeCloseTo(0.05 / 1.05, 10);
      expect(states[19].confidence).toBeCloseTo(1 / 2, 10);
      expect(states[19].evidenceCount).toBe(20);
    });

    it('records when and where in the stream the state was last touched', () => {
      const [state] = run([evidence()]);

      expect(state.lastSeq).toBe(1);
      expect(state.lastEventAt).toEqual(at(1));
    });

    it('does not change the state it is given', () => {
      const frozen = Object.freeze({ ...EMPTY_CONCEPT_STATE });

      const next = foldAssessment(frozen, evidence(), { occurredAt: at(1), streamSeq: 1 });

      expect(next).not.toBe(frozen);
      expect(frozen).toEqual(EMPTY_CONCEPT_STATE);
    });

    it('never lowers theta for a perfect attempt nor raises it for a zero attempt, from any starting point', () => {
      for (let theta = -5; theta <= 5; theta += 0.5) {
        const state: ConceptState = { ...EMPTY_CONCEPT_STATE, theta, evidenceCount: 3 };
        const up = foldAssessment(state, evidence({ score: 1 }), { occurredAt: at(1), streamSeq: 1 });
        const down = foldAssessment(state, evidence({ score: 0 }), { occurredAt: at(1), streamSeq: 1 });

        expect(up.theta).toBeGreaterThanOrEqual(theta);
        expect(down.theta).toBeLessThanOrEqual(theta);
      }
    });

    it('orders outcomes: a better score never gives a lower theta', () => {
      let previous = -Infinity;
      for (let score = 0; score <= 1.0001; score += 0.1) {
        const { theta } = foldAssessment(EMPTY_CONCEPT_STATE, evidence({ score }), { occurredAt: at(1), streamSeq: 1 });

        expect(theta).toBeGreaterThan(previous);
        previous = theta;
      }
    });
  });

  describe('replay', () => {
    const event = (streamSeq: number, conceptId: string | null, payload: unknown, eventType = 'ASSESSMENT_COMPLETED') => ({
      streamSeq,
      conceptId,
      eventType,
      payload,
      occurredAt: at(streamSeq),
    });

    const payload = (overrides: Record<string, unknown> = {}) => ({
      attemptId: 'a-1',
      quizId: 'q-1',
      score: 1,
      items: 5,
      hintsUsed: 0,
      share: 1,
      attemptNumber: 1,
      ...overrides,
    });

    it('folds a learner stream per concept', () => {
      const { states, skipped } = replay([event(1, 'c1', payload()), event(2, 'c2', payload()), event(3, 'c1', payload())]);

      expect(skipped).toEqual([]);
      expect(states.get('c1')).toMatchObject({ evidenceCount: 2, lastSeq: 3 });
      expect(states.get('c2')).toMatchObject({ evidenceCount: 1, lastSeq: 2 });
      expect(states.get('c1')!.score).toBeCloseTo(0.703, 3);
    });

    it('applies events in stream order whatever order they are handed in', () => {
      const ordered = [event(1, 'c1', payload({ score: 0 })), event(2, 'c1', payload({ score: 1 }))];

      expect(replay([...ordered].reverse()).states.get('c1')).toEqual(replay(ordered).states.get('c1'));
    });

    it('equals the incremental fold of the same evidence', () => {
      const states = run([evidence({ score: 0.4 }), evidence({ score: 0.9, hintsUsed: 1 }), evidence({ score: 1, attemptNumber: 2 })]);
      const replayed = replay([
        event(1, 'c1', payload({ score: 0.4 })),
        event(2, 'c1', payload({ score: 0.9, hintsUsed: 1 })),
        event(3, 'c1', payload({ score: 1, attemptNumber: 2 })),
      ]).states.get('c1');

      expect(replayed).toEqual(states[2]);
    });

    it('skips an event of another type and says nothing about it', () => {
      const { states, skipped } = replay([event(1, 'c1', {}, 'SOMETHING_NEW'), event(2, 'c1', payload())]);

      expect(skipped).toEqual([]);
      expect(states.get('c1')).toMatchObject({ evidenceCount: 1, lastSeq: 2 });
    });

    it('ignores keys it does not know and defaults the ones an older event lacks', () => {
      const { states, skipped } = replay([event(1, 'c1', { attemptId: 'a', quizId: 'q', score: 1, items: 5, share: 1, attemptNumber: 1, added: 'later' })]);

      expect(skipped).toEqual([]);
      expect(states.get('c1')!.theta).toBeCloseTo(0.5, 10);
    });

    it('skips and reports an assessment whose payload cannot be read or that has no concept', () => {
      const { states, skipped } = replay([
        event(1, 'c1', payload({ score: 7 })),
        event(2, null, payload()),
        event(3, 'c1', payload()),
      ]);

      expect(skipped).toEqual([
        { streamSeq: 1, reason: 'invalid payload' },
        { streamSeq: 2, reason: 'missing concept' },
      ]);
      expect(states.get('c1')).toMatchObject({ evidenceCount: 1, lastSeq: 3 });
    });

    it('returns an empty map for an empty stream', () => {
      expect(replay([]).states.size).toBe(0);
    });
  });
});
