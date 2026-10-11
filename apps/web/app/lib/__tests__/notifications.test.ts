import { describe, expect, it } from 'vitest';
import { canMarkRead, formatNotificationTime, notificationIcon, sortNotifications } from '~/lib/notifications';

const n = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  userId: 'u-1',
  title: `Judul ${id}`,
  body: null,
  type: 'SYSTEM',
  isGlobal: false,
  readAt: null,
  createdAt: '2026-10-10T00:00:00.000Z',
  ...overrides,
});

describe('sortNotifications', () => {
  it('puts the newest first without changing the input', () => {
    const input = [n('a', { createdAt: '2026-10-01T00:00:00.000Z' }), n('b', { createdAt: '2026-10-09T00:00:00.000Z' }), n('c', { createdAt: '2026-10-05T00:00:00.000Z' })];

    expect(sortNotifications(input).map((item) => item.id)).toEqual(['b', 'c', 'a']);
    expect(input.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('survives a missing list and an unparsable date', () => {
    expect(sortNotifications(undefined)).toEqual([]);
    expect(sortNotifications([n('a', { createdAt: 'bukan tanggal' }), n('b')]).map((item) => item.id)).toEqual(['b', 'a']);
  });
});

describe('canMarkRead', () => {
  it('lets a learner mark only their own unread notification', () => {
    expect(canMarkRead(n('a'), 'u-1')).toBe(true);
    expect(canMarkRead(n('a', { readAt: '2026-10-10T01:00:00.000Z' }), 'u-1')).toBe(false);
    expect(canMarkRead(n('a', { userId: 'u-2' }), 'u-1')).toBe(false);
  });

  it('never offers it for a global announcement, which belongs to nobody', () => {
    expect(canMarkRead(n('a', { userId: null, isGlobal: true }), 'u-1')).toBe(false);
    expect(canMarkRead(n('a'), undefined)).toBe(false);
  });
});

describe('formatNotificationTime', () => {
  it('prints the same text on the server and in the browser by pinning the locale and the zone', () => {
    expect(formatNotificationTime('2026-10-10T00:00:00.000Z')).toBe('10 Okt 2026 07.00');
  });

  it('is empty for a missing or invalid date', () => {
    expect(formatNotificationTime(undefined)).toBe('');
    expect(formatNotificationTime('nope')).toBe('');
  });
});

describe('notificationIcon', () => {
  it('maps each kind to a theme icon or falls back to none', () => {
    expect(notificationIcon('STREAK')).toBe('streak');
    expect(notificationIcon('QUIZ')).toBe('xp');
    expect(notificationIcon('ACHIEVEMENT')).toBe('badge');
    expect(notificationIcon('SYSTEM')).toBeNull();
    expect(notificationIcon('UNKNOWN')).toBeNull();
  });
});
