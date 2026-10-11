import { describe, expect, it } from 'vitest';
import { achievementPercent, formatCount, levelPercent, medalFor, rewardHeadline, streakCopy, weekdayShort } from '~/lib/gamify';
import type { AssessmentGamify } from '~/interfaces/gamify';

describe('formatCount', () => {
  it('groups thousands the Indonesian way and keeps small numbers as they are', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(950)).toBe('950');
    expect(formatCount(1234)).toBe('1.234');
    expect(formatCount(1_250_000)).toBe('1.250.000');
  });

  it('is zero for a number that is not finite', () => {
    expect(formatCount(Number.NaN)).toBe('0');
    expect(formatCount(Number.POSITIVE_INFINITY)).toBe('0');
  });
});

describe('levelPercent and achievementPercent', () => {
  it('turn a fraction or a value over a target into a whole percent between 0 and 100', () => {
    expect(levelPercent(0.5)).toBe(50);
    expect(levelPercent(0.996)).toBe(100);
    expect(levelPercent(-0.2)).toBe(0);
    expect(levelPercent(3)).toBe(100);
    expect(achievementPercent({ value: 2, target: 5 })).toBe(40);
    expect(achievementPercent({ value: 9, target: 5 })).toBe(100);
    expect(achievementPercent({ value: 0, target: 0 })).toBe(0);
  });
});

describe('weekdayShort', () => {
  it('gives the Indonesian short weekday of an ISO date without any time zone shift', () => {
    expect(weekdayShort('2026-10-05')).toBe('Sen');
    expect(weekdayShort('2026-10-06')).toBe('Sel');
    expect(weekdayShort('2026-10-07')).toBe('Rab');
    expect(weekdayShort('2026-10-08')).toBe('Kam');
    expect(weekdayShort('2026-10-09')).toBe('Jum');
    expect(weekdayShort('2026-10-10')).toBe('Sab');
    expect(weekdayShort('2026-10-11')).toBe('Min');
  });
});

describe('medalFor', () => {
  it('rewards the first three ranks only', () => {
    expect(medalFor(1)).toBe('gold');
    expect(medalFor(2)).toBe('silver');
    expect(medalFor(3)).toBe('bronze');
    expect(medalFor(4)).toBeNull();
    expect(medalFor(0)).toBeNull();
  });
});

describe('streakCopy', () => {
  it('says something honest and specific for every status, with a tone', () => {
    for (const status of ['NONE', 'DONE_TODAY', 'AT_RISK', 'SAVED_BY_FREEZE', 'BROKEN'] as const) {
      const copy = streakCopy(status);
      expect(copy.title.length).toBeGreaterThan(5);
      expect(copy.hint.length).toBeGreaterThan(10);
      expect(['success', 'warning', 'info', 'danger', 'neutral']).toContain(copy.tone);
    }
  });

  it('asks for a graded assessment, never for a login or a chat, when the streak is at risk', () => {
    const copy = streakCopy('AT_RISK');

    expect(copy.hint.toLowerCase()).toContain('penilaian');
    expect(`${copy.title} ${copy.hint}`.toLowerCase()).not.toMatch(/login|masuk|chat/);
    expect(copy.tone).toBe('warning');
  });

  it('is calm when the streak is safe for today and clear when it is lost', () => {
    expect(streakCopy('DONE_TODAY').tone).toBe('success');
    expect(streakCopy('BROKEN').tone).toBe('danger');
    expect(streakCopy('SAVED_BY_FREEZE').tone).toBe('info');
  });
});

describe('rewardHeadline', () => {
  const base: AssessmentGamify = {
    xpGained: 0,
    starsGained: 0,
    streak: { current: 1, longest: 1, freezes: 0, extended: false, freezeEarned: false, freezesUsed: 0, bonusPoints: 0 },
    achievements: [],
  };

  it('lists only what really happened, most important first', () => {
    const outcome: AssessmentGamify = {
      xpGained: 62,
      starsGained: 1,
      streak: { current: 7, longest: 7, freezes: 1, extended: true, freezeEarned: true, freezesUsed: 0, bonusPoints: 50 },
      achievements: [{ code: 'streak-7', title: 'Seminggu Penuh', iconName: 'streak' }],
    };

    expect(rewardHeadline(outcome)).toEqual([
      { kind: 'achievement', icon: 'badge', text: 'Pencapaian baru: Seminggu Penuh' },
      { kind: 'star', icon: 'star', text: '+1 bintang' },
      { kind: 'streak', icon: 'streak', text: 'Streak 7 hari' },
      { kind: 'freeze', icon: 'freeze', text: 'Pembeku streak baru' },
      { kind: 'xp', icon: 'xp', text: '+62 XP' },
    ]);
  });

  it('is empty when nothing was earned, and says streak only when it grew', () => {
    expect(rewardHeadline(base)).toEqual([]);
    expect(rewardHeadline({ ...base, xpGained: 5 })).toEqual([{ kind: 'xp', icon: 'xp', text: '+5 XP' }]);
    expect(rewardHeadline({ ...base, streak: { ...base.streak, extended: true, current: 2 } }).map((r) => r.text)).toEqual(['Streak 2 hari']);
  });

  it('mentions a freeze that was used to save the streak', () => {
    const used = { ...base, streak: { ...base.streak, extended: true, current: 8, freezesUsed: 1 } };

    expect(rewardHeadline(used).map((r) => r.text)).toContain('Pembeku streak menyelamatkan streak-mu');
  });
});
