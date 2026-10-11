import type { AssessmentGamify, StreakStatus } from '~/interfaces/gamify';
import type { ThemeIconName } from '~/theme/icons';

export type StreakTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

export interface StreakCopy {
  title: string;
  hint: string;
  tone: StreakTone;
}

export interface RewardLine {
  kind: 'achievement' | 'star' | 'streak' | 'freeze' | 'xp';
  icon: ThemeIconName;
  text: string;
}

const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] as const;

const STREAK_COPY: Readonly<Record<StreakStatus, StreakCopy>> = {
  NONE: { title: 'Mulai streak-mu hari ini', hint: 'Selesaikan satu penilaian dengan bukti belajar untuk memulai streak.', tone: 'neutral' },
  DONE_TODAY: { title: 'Streak hari ini aman', hint: 'Penilaianmu hari ini sudah tercatat. Kembali besok untuk menambah satu hari.', tone: 'success' },
  AT_RISK: { title: 'Streak-mu menunggu hari ini', hint: 'Selesaikan satu penilaian hari ini agar streak tidak putus.', tone: 'warning' },
  SAVED_BY_FREEZE: { title: 'Pembeku streak siaga', hint: 'Hari yang terlewat akan ditutup pembeku streak begitu kamu menyelesaikan penilaian hari ini.', tone: 'info' },
  BROKEN: { title: 'Streak-mu terputus', hint: 'Mulai lagi dengan satu penilaian hari ini. Rekor terpanjangmu tetap tersimpan.', tone: 'danger' },
};

export const formatCount = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  const whole = Math.trunc(Math.abs(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return value < 0 ? `-${whole}` : whole;
};

const clampPercent = (fraction: number): number => Math.round(Math.min(1, Math.max(0, fraction)) * 100);

export const levelPercent = (progress: number): number => clampPercent(progress);

export const achievementPercent = (progress: { value: number; target: number }): number =>
  progress.target > 0 ? clampPercent(progress.value / progress.target) : 0;

export const weekdayShort = (isoDate: string): string => WEEKDAYS[new Date(`${isoDate}T00:00:00Z`).getUTCDay()] as string;

export const medalFor = (rank: number): 'gold' | 'silver' | 'bronze' | null => (rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : null);

export const streakCopy = (status: StreakStatus): StreakCopy => STREAK_COPY[status];

export const rewardHeadline = (outcome: AssessmentGamify): RewardLine[] => {
  const lines: RewardLine[] = outcome.achievements.map((a) => ({ kind: 'achievement', icon: 'badge', text: `Pencapaian baru: ${a.title}` }));
  if (outcome.starsGained > 0) lines.push({ kind: 'star', icon: 'star', text: `+${formatCount(outcome.starsGained)} bintang` });
  if (outcome.streak.extended) lines.push({ kind: 'streak', icon: 'streak', text: `Streak ${formatCount(outcome.streak.current)} hari` });
  if (outcome.streak.freezesUsed > 0) lines.push({ kind: 'freeze', icon: 'freeze', text: 'Pembeku streak menyelamatkan streak-mu' });
  if (outcome.streak.freezeEarned) lines.push({ kind: 'freeze', icon: 'freeze', text: 'Pembeku streak baru' });
  if (outcome.xpGained > 0) lines.push({ kind: 'xp', icon: 'xp', text: `+${formatCount(outcome.xpGained)} XP` });
  return lines;
};
