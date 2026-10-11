export interface StreakConfig {
  freezeEvery: number;
  freezeMax: number;
}

export interface StreakState {
  current: number;
  longest: number;
  freezes: number;
  lastDate: string | null;
}

export interface StreakStep {
  state: StreakState;
  extended: boolean;
  freezeEarned: boolean;
  freezesUsed: number;
}

export const DEFAULT_STREAK_CONFIG: StreakConfig = { freezeEvery: 7, freezeMax: 2 };

export const EMPTY_STREAK: StreakState = { current: 0, longest: 0, freezes: 0, lastDate: null };

const FALLBACK_ZONE = 'Asia/Jakarta';

const formatterFor = (timeZone: string): Intl.DateTimeFormat => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: FALLBACK_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
  }
};

export const localDateOf = (at: Date, timeZone: string): string => formatterFor(timeZone).format(at);

export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

const unchanged = (state: StreakState): StreakStep => ({ state, extended: false, freezeEarned: false, freezesUsed: 0 });

export const foldQualifiedDay = (state: StreakState, date: string, config: StreakConfig = DEFAULT_STREAK_CONFIG): StreakStep => {
  let current: number;
  let freezes = state.freezes;
  let freezesUsed = 0;

  if (state.lastDate === null) {
    current = 1;
  } else {
    const gap = daysBetween(state.lastDate, date);
    if (gap <= 0) return unchanged(state);
    const missed = gap - 1;
    if (missed === 0) {
      current = state.current + 1;
    } else if (freezes >= missed) {
      current = state.current + 1;
      freezes -= missed;
      freezesUsed = missed;
    } else {
      current = 1;
    }
  }

  const freezeEarned = current > 1 && current % config.freezeEvery === 0 && freezes < config.freezeMax;
  if (freezeEarned) freezes += 1;

  return {
    state: { current, longest: Math.max(state.longest, current), freezes, lastDate: date },
    extended: true,
    freezeEarned,
    freezesUsed,
  };
};

export const replayStreak = (
  dates: ReadonlyArray<string>,
  config: StreakConfig = DEFAULT_STREAK_CONFIG,
  initial: StreakState = EMPTY_STREAK,
): StreakState => {
  const ordered = [...new Set(dates)].sort();
  return ordered.reduce((state, date) => foldQualifiedDay(state, date, config).state, initial);
};
