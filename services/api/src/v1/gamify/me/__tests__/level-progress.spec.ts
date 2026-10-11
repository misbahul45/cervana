import { DEFAULT_LEVELS, levelProgress } from '../level-progress';

describe('levelProgress', () => {
  it('keeps the twelve default thresholds of the previous constants', () => {
    expect(DEFAULT_LEVELS.map((l) => [l.level, l.xp])).toEqual([
      [1, 0], [2, 100], [3, 150], [4, 250], [5, 400], [6, 600], [7, 900], [8, 1300], [9, 1800], [10, 2500], [11, 3500], [12, 4500],
    ]);
  });

  it('is level 1 at zero xp with the floor, the next threshold and no progress', () => {
    expect(levelProgress(0, DEFAULT_LEVELS)).toEqual({ level: 1, floor: 0, next: 100, progress: 0, toNext: 100 });
  });

  it('moves up exactly at a threshold and measures progress inside the level', () => {
    expect(levelProgress(99, DEFAULT_LEVELS)).toMatchObject({ level: 1, progress: 0.99, toNext: 1 });
    expect(levelProgress(100, DEFAULT_LEVELS)).toMatchObject({ level: 2, floor: 100, next: 150, progress: 0, toNext: 50 });
    expect(levelProgress(125, DEFAULT_LEVELS)).toMatchObject({ level: 2, progress: 0.5, toNext: 25 });
  });

  it('stays at the top level with a full bar and no next threshold', () => {
    expect(levelProgress(4500, DEFAULT_LEVELS)).toEqual({ level: 12, floor: 4500, next: null, progress: 1, toNext: null });
    expect(levelProgress(99_999, DEFAULT_LEVELS)).toMatchObject({ level: 12, next: null, progress: 1 });
  });

  it('works from any set of rows, in any order, and treats a negative xp as zero', () => {
    const rows = [{ level: 3, xp: 500 }, { level: 1, xp: 0 }, { level: 2, xp: 200 }];

    expect(levelProgress(250, rows)).toMatchObject({ level: 2, floor: 200, next: 500 });
    expect(levelProgress(-40, rows)).toEqual({ level: 1, floor: 0, next: 200, progress: 0, toNext: 200 });
  });

  it('has a single level when it has a single row', () => {
    expect(levelProgress(10, [{ level: 1, xp: 0 }])).toEqual({ level: 1, floor: 0, next: null, progress: 1, toNext: null });
  });
});
