import { DEFAULT_STREAK_CONFIG, EMPTY_STREAK, StreakState, daysBetween, foldQualifiedDay, localDateOf, replayStreak } from '../streak-fold';

const run = (dates: string[], config = DEFAULT_STREAK_CONFIG): StreakState => replayStreak(dates, config);

const consecutive = (start: string, count: number): string[] => {
  const base = Date.parse(`${start}T00:00:00Z`);
  return Array.from({ length: count }, (_, n) => new Date(base + n * 86_400_000).toISOString().slice(0, 10));
};

describe('localDateOf', () => {
  it('uses the local calendar day of the time zone, not the UTC day', () => {
    const lateJakarta = new Date('2026-10-10T18:30:00Z');
    expect(localDateOf(lateJakarta, 'Asia/Jakarta')).toBe('2026-10-11');
    expect(localDateOf(lateJakarta, 'UTC')).toBe('2026-10-10');
    expect(localDateOf(new Date('2026-10-10T03:00:00Z'), 'America/Los_Angeles')).toBe('2026-10-09');
  });

  it('falls back to Asia/Jakarta for an unknown zone', () => {
    expect(localDateOf(new Date('2026-10-10T18:30:00Z'), 'Nowhere/Land')).toBe('2026-10-11');
  });
});

describe('daysBetween', () => {
  it('counts whole calendar days across month and year ends', () => {
    expect(daysBetween('2026-10-10', '2026-10-11')).toBe(1);
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-10-10', '2026-10-10')).toBe(0);
  });
});

describe('foldQualifiedDay', () => {
  it('starts a streak at 1 on the first qualified day', () => {
    const { state, extended } = foldQualifiedDay(EMPTY_STREAK, '2026-10-10');

    expect(state).toMatchObject({ current: 1, longest: 1, freezes: 0, lastDate: '2026-10-10' });
    expect(extended).toBe(true);
  });

  it('counts a second event of the same day as nothing', () => {
    const first = foldQualifiedDay(EMPTY_STREAK, '2026-10-10').state;

    const again = foldQualifiedDay(first, '2026-10-10');

    expect(again.state).toEqual(first);
    expect(again.extended).toBe(false);
  });

  it('ignores a day older than the last one: history is not rewritten', () => {
    const state = run(consecutive('2026-10-10', 3));

    const late = foldQualifiedDay(state, '2026-10-09');

    expect(late.state).toEqual(state);
    expect(late.extended).toBe(false);
  });

  it('extends on consecutive days and tracks the longest', () => {
    expect(run(consecutive('2026-10-01', 5))).toMatchObject({ current: 5, longest: 5 });
  });

  it('resets after a missed day when no freeze is held, and keeps the longest streak', () => {
    const state = run([...consecutive('2026-10-01', 3), '2026-10-05']);

    expect(state).toMatchObject({ current: 1, longest: 3, freezes: 0 });
  });

  it('earns a freeze on the 7th consecutive day and again on the 14th', () => {
    expect(run(consecutive('2026-10-01', 6)).freezes).toBe(0);
    expect(run(consecutive('2026-10-01', 7))).toMatchObject({ current: 7, freezes: 1 });
    expect(run(consecutive('2026-10-01', 14))).toMatchObject({ current: 14, freezes: 2 });
  });

  it('holds at most two freezes', () => {
    expect(run(consecutive('2026-10-01', 28))).toMatchObject({ current: 28, freezes: 2 });
  });

  it('reports the freeze that a day earned', () => {
    const six = run(consecutive('2026-10-01', 6));

    const seventh = foldQualifiedDay(six, '2026-10-07');

    expect(seventh.freezeEarned).toBe(true);
    expect(seventh.state.freezes).toBe(1);
    expect(foldQualifiedDay(six, '2026-10-07').freezeEarned).toBe(true);
    expect(foldQualifiedDay(EMPTY_STREAK, '2026-10-01').freezeEarned).toBe(false);
  });

  it('spends one freeze on one missed day and the streak continues (GM-04)', () => {
    const week = run(consecutive('2026-10-01', 7));
    expect(week.freezes).toBe(1);

    const next = foldQualifiedDay(week, '2026-10-09');

    expect(next.state).toMatchObject({ current: 8, freezes: 0, lastDate: '2026-10-09' });
    expect(next.freezesUsed).toBe(1);
  });

  it('spends one freeze per missed day and resets when the freezes are not enough', () => {
    const fortnight = run(consecutive('2026-10-01', 14));
    expect(fortnight.freezes).toBe(2);

    const twoMissed = foldQualifiedDay(fortnight, '2026-10-17');
    expect(twoMissed.state).toMatchObject({ current: 15, freezes: 0 });
    expect(twoMissed.freezesUsed).toBe(2);

    const threeMissed = foldQualifiedDay(fortnight, '2026-10-18');
    expect(threeMissed.state).toMatchObject({ current: 1, longest: 14, freezes: 2 });
    expect(threeMissed.freezesUsed).toBe(0);
  });

  it('earns a new freeze when a streak that used one reaches the next multiple of 7', () => {
    const week = run(consecutive('2026-10-01', 7));
    const afterGap = foldQualifiedDay(week, '2026-10-09').state;

    const through = replayStreak(['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'], DEFAULT_STREAK_CONFIG, afterGap);

    expect(through).toMatchObject({ current: 14, freezes: 1 });
  });

  it('follows the configured interval and cap', () => {
    expect(run(consecutive('2026-10-01', 3), { freezeEvery: 3, freezeMax: 1 })).toMatchObject({ current: 3, freezes: 1 });
    expect(run(consecutive('2026-10-01', 9), { freezeEvery: 3, freezeMax: 1 })).toMatchObject({ current: 9, freezes: 1 });
  });
});

describe('replayStreak', () => {
  it('equals folding the days one by one', () => {
    const dates = [...consecutive('2026-10-01', 10), '2026-10-13', ...consecutive('2026-10-20', 3)];
    let state = EMPTY_STREAK;
    for (const date of dates) state = foldQualifiedDay(state, date).state;

    expect(run(dates)).toEqual(state);
  });

  it('sorts unordered input and ignores duplicates', () => {
    expect(run(['2026-10-03', '2026-10-01', '2026-10-02', '2026-10-02'])).toEqual(run(['2026-10-01', '2026-10-02', '2026-10-03']));
  });
});
