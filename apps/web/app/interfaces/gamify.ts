export type StreakStatus = 'NONE' | 'DONE_TODAY' | 'AT_RISK' | 'SAVED_BY_FREEZE' | 'BROKEN';

export type CalendarDayState = 'done' | 'frozen' | 'missed' | 'today';

export interface CalendarDay {
  date: string;
  state: CalendarDayState;
}

export interface LevelProgress {
  level: number;
  floor: number;
  next: number | null;
  progress: number;
  toNext: number | null;
}

export interface GamifyMe {
  xp: number;
  level: LevelProgress;
  stars: number;
  streak: {
    current: number;
    longest: number;
    freezes: number;
    lastDate: string | null;
    today: string;
    status: StreakStatus;
    week: CalendarDay[];
  };
  board: { optedIn: boolean; handle: string | null };
}

export interface AchievementItem {
  code: string;
  title: string;
  description: string | null;
  iconName: string | null;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: { value: number; target: number };
}

export interface AchievementList {
  unlocked: number;
  total: number;
  achievements: AchievementItem[];
}

export interface BoardEntry {
  rank: number;
  handle: string;
  score: number;
  you: boolean;
}

export interface TopicBoard {
  topicId: string;
  window: { startDate: string; kind: 'week' };
  entries: BoardEntry[];
  me: { optedIn: boolean; rank: number | null; score: number };
}

export interface AssessmentGamify {
  xpGained: number;
  starsGained: number;
  streak: { current: number; longest: number; freezes: number; extended: boolean; freezeEarned: boolean; freezesUsed: number; bonusPoints: number };
  achievements: Array<{ code: string; title: string; iconName: string | null }>;
}
