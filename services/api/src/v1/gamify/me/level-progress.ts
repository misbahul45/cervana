export interface LevelRow {
  level: number;
  xp: number;
}

export interface LevelProgress {
  level: number;
  floor: number;
  next: number | null;
  progress: number;
  toNext: number | null;
}

export const DEFAULT_LEVELS: ReadonlyArray<LevelRow> = [
  { level: 1, xp: 0 },
  { level: 2, xp: 100 },
  { level: 3, xp: 150 },
  { level: 4, xp: 250 },
  { level: 5, xp: 400 },
  { level: 6, xp: 600 },
  { level: 7, xp: 900 },
  { level: 8, xp: 1300 },
  { level: 9, xp: 1800 },
  { level: 10, xp: 2500 },
  { level: 11, xp: 3500 },
  { level: 12, xp: 4500 },
];

export const levelProgress = (xp: number, rows: ReadonlyArray<LevelRow>): LevelProgress => {
  const ordered = [...rows].sort((a, b) => a.xp - b.xp);
  const total = Math.max(0, xp);
  let index = 0;
  ordered.forEach((row, i) => {
    if (total >= row.xp) index = i;
  });
  const current = ordered[index];
  const next = ordered[index + 1];
  if (!next) return { level: current.level, floor: current.xp, next: null, progress: 1, toNext: null };
  return {
    level: current.level,
    floor: current.xp,
    next: next.xp,
    progress: (total - current.xp) / (next.xp - current.xp),
    toNext: next.xp - total,
  };
};
