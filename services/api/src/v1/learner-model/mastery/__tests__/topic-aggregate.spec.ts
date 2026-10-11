import {
  ConceptEvidence,
  ELIGIBILITY_SCORE,
  MASTERED_SCORE,
  aggregateTopic,
  hasPassed,
  isCreatorEligible,
  skillNodeState,
} from '../topic-aggregate';

const evidence = (score: number, evidenceCount = 3, lastEventAt: Date | null = new Date(Date.UTC(2026, 9, 1))): ConceptEvidence => ({
  score,
  evidenceCount,
  lastEventAt,
});

const rows = (entries: Record<string, ConceptEvidence>) => new Map(Object.entries(entries));

describe('hasPassed', () => {
  it('needs the pass score and the minimum evidence together', () => {
    expect(hasPassed({ score: 0.7, evidenceCount: 3 })).toBe(true);
    expect(hasPassed({ score: 0.6999, evidenceCount: 3 })).toBe(false);
    expect(hasPassed({ score: 0.95, evidenceCount: 2 })).toBe(false);
  });
});

describe('aggregateTopic', () => {
  it('has no score for a topic without concepts', () => {
    expect(aggregateTopic([], rows({}))).toEqual({
      score: null,
      passedConcepts: 0,
      totalConcepts: 0,
      evidenceCount: 0,
      lastEventAt: null,
    });
  });

  it('counts a concept without evidence as zero, not as the prior', () => {
    const aggregate = aggregateTopic(['a', 'b'], rows({ a: evidence(0.9) }));
    expect(aggregate.score).toBeCloseTo(0.45, 10);
    expect(aggregate.totalConcepts).toBe(2);
    expect(aggregate.passedConcepts).toBe(1);
  });

  it('averages the concepts of the topic and ignores concepts of other topics', () => {
    const aggregate = aggregateTopic(['a', 'b'], rows({ a: evidence(0.9), b: evidence(0.7), z: evidence(0.1) }));
    expect(aggregate.score).toBeCloseTo(0.8, 10);
    expect(aggregate.evidenceCount).toBe(6);
  });

  it('counts a concept once when it is listed twice', () => {
    const aggregate = aggregateTopic(['a', 'a'], rows({ a: evidence(0.9) }));
    expect(aggregate.totalConcepts).toBe(1);
    expect(aggregate.score).toBeCloseTo(0.9, 10);
  });

  it('reports the latest event time of the topic concepts', () => {
    const early = new Date(Date.UTC(2026, 9, 1));
    const late = new Date(Date.UTC(2026, 9, 5));
    const aggregate = aggregateTopic(['a', 'b'], rows({ a: evidence(0.9, 3, early), b: evidence(0.9, 3, late) }));
    expect(aggregate.lastEventAt).toEqual(late);
  });

  it('does not count a passed score with too little evidence as passed', () => {
    const aggregate = aggregateTopic(['a'], rows({ a: evidence(0.95, 2) }));
    expect(aggregate.passedConcepts).toBe(0);
  });
});

describe('isCreatorEligible', () => {
  it('uses the threshold of 0.85 and accepts it exactly', () => {
    expect(ELIGIBILITY_SCORE).toBe(0.85);
    expect(isCreatorEligible(aggregateTopic(['a'], rows({ a: evidence(0.85) })))).toBe(true);
    expect(isCreatorEligible(aggregateTopic(['a'], rows({ a: evidence(0.8499) })))).toBe(false);
  });

  it('is never eligible without concepts', () => {
    expect(isCreatorEligible(aggregateTopic([], rows({})))).toBe(false);
  });

  it('is not eligible when one concept carries the topic', () => {
    const aggregate = aggregateTopic(['a', 'b'], rows({ a: evidence(1), b: evidence(0.6) }));
    expect(aggregate.score).toBeCloseTo(0.8, 10);
    expect(isCreatorEligible(aggregate)).toBe(false);
  });

  it('is not eligible when the mean is high but one concept has too little evidence', () => {
    const aggregate = aggregateTopic(['a', 'b'], rows({ a: evidence(0.99), b: evidence(0.99, 2) }));
    expect(aggregate.score).toBeGreaterThanOrEqual(ELIGIBILITY_SCORE);
    expect(isCreatorEligible(aggregate)).toBe(false);
  });

  it('is eligible when every concept passed and the mean reaches the threshold', () => {
    const aggregate = aggregateTopic(['a', 'b'], rows({ a: evidence(0.9), b: evidence(0.85) }));
    expect(isCreatorEligible(aggregate)).toBe(true);
  });
});

describe('skillNodeState', () => {
  const passed = { score: 0.8, evidenceCount: 3 };

  it('locks a concept whose prerequisites are not passed, whatever its own score', () => {
    expect(skillNodeState({ prerequisitesPassed: false, own: passed })).toBe('LOCKED');
    expect(skillNodeState({ prerequisitesPassed: false, own: null })).toBe('LOCKED');
  });

  it('makes a concept without evidence available once the prerequisites are passed', () => {
    expect(skillNodeState({ prerequisitesPassed: true, own: null })).toBe('AVAILABLE');
    expect(skillNodeState({ prerequisitesPassed: true, own: { score: 0.5, evidenceCount: 0 } })).toBe('AVAILABLE');
  });

  it('keeps a concept in progress until it is passed and reaches the mastered score', () => {
    expect(MASTERED_SCORE).toBe(0.9);
    expect(skillNodeState({ prerequisitesPassed: true, own: { score: 0.4, evidenceCount: 1 } })).toBe('IN_PROGRESS');
    expect(skillNodeState({ prerequisitesPassed: true, own: passed })).toBe('IN_PROGRESS');
    expect(skillNodeState({ prerequisitesPassed: true, own: { score: 0.95, evidenceCount: 2 } })).toBe('IN_PROGRESS');
  });

  it('masters a concept that is passed and at the mastered score, exactly', () => {
    expect(skillNodeState({ prerequisitesPassed: true, own: { score: 0.9, evidenceCount: 3 } })).toBe('MASTERED');
    expect(skillNodeState({ prerequisitesPassed: true, own: { score: 0.8999, evidenceCount: 3 } })).toBe('IN_PROGRESS');
  });
});
