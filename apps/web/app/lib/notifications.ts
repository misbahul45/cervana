import type { ThemeIconName } from '~/theme/icons';

export interface NotificationLike {
  id: string;
  userId?: string | null;
  isGlobal?: boolean;
  readAt?: string | Date | null;
  createdAt: string | Date;
}

const time = (value: string | Date): number => {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const sortNotifications = <T extends NotificationLike>(list: ReadonlyArray<T> | null | undefined): T[] =>
  [...(list ?? [])].sort((a, b) => time(b.createdAt) - time(a.createdAt));

export const canMarkRead = (notification: NotificationLike, userId: string | undefined): boolean =>
  Boolean(userId) && notification.userId === userId && !notification.isGlobal && !notification.readAt;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'] as const;
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const two = (value: number): string => String(value).padStart(2, '0');

export const formatNotificationTime = (value: string | Date | null | undefined): string => {
  if (!value) return '';
  const instant = new Date(value).getTime();
  if (Number.isNaN(instant)) return '';
  const local = new Date(instant + JAKARTA_OFFSET_MS);
  return `${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]} ${local.getUTCFullYear()} ${two(local.getUTCHours())}.${two(local.getUTCMinutes())}`;
};

const ICONS: Record<string, ThemeIconName> = { STREAK: 'streak', QUIZ: 'xp', ACHIEVEMENT: 'badge' };

export const notificationIcon = (type: string): ThemeIconName | null => ICONS[type] ?? null;
