import { DEFAULT_STREAK_CONFIG, EMPTY_STREAK, StreakConfig, StreakState, daysBetween, foldQualifiedDay } from '../streaks/streak-fold';

export type CalendarDayState = 'done' | 'frozen' | 'missed' | 'today';

export interface CalendarDay {
  date: string;
  state: CalendarDayState;
}

export type StreakStatus = 'NONE' | 'DONE_TODAY' | 'AT_RISK' | 'SAVED_BY_FREEZE' | 'BROKEN';

export const shiftDate = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

const coveredDays = (dates: ReadonlyArray<string>, config: StreakConfig): Set<string> => {
  const covered = new Set<string>();
  let state: StreakState = EMPTY_STREAK;
  for (const date of [...new Set(dates)].sort()) {
    const step = foldQualifiedDay(state, date, config);
    if (step.freezesUsed > 0 && state.lastDate) {
      for (let n = 1; n <= step.freezesUsed; n += 1) covered.add(shiftDate(state.lastDate, n));
    }
    state = step.state;
  }
  return covered;
};

export const streakCalendar = (
  dates: ReadonlyArray<string>,
  today: string,
  length = 7,
  config: StreakConfig = DEFAULT_STREAK_CONFIG,
): CalendarDay[] => {
  const done = new Set(dates);
  const frozen = coveredDays(dates, config);
  return Array.from({ length }, (_, n) => {
    const date = shiftDate(today, n - (length - 1));
    if (done.has(date)) return { date, state: 'done' as const };
    if (frozen.has(date)) return { date, state: 'frozen' as const };
    return { date, state: date === today ? ('today' as const) : ('missed' as const) };
  });
};

export const streakStatus = (state: Pick<StreakState, 'current' | 'freezes' | 'lastDate'>, today: string): StreakStatus => {
  if (state.lastDate === null || state.current === 0) return 'NONE';
  const gap = daysBetween(state.lastDate, today);
  if (gap <= 0) return 'DONE_TODAY';
  if (gap === 1) return 'AT_RISK';
  return state.freezes >= gap - 1 ? 'SAVED_BY_FREEZE' : 'BROKEN';
};
