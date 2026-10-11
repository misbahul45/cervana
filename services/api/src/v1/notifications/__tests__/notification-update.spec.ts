import { Role } from '@prisma/client';
import { parseNotificationUpdate } from '@/v1/notifications/notification-update';

const NOW = new Date('2026-10-11T08:00:00.000Z');

describe('parseNotificationUpdate for a learner', () => {
  it('can only mark the notification as read, now when no time is given', () => {
    expect(parseNotificationUpdate(Role.STUDENT, {}, NOW)).toEqual({ kind: 'read', readAt: NOW });
  });

  it('accepts a read time and turns it into a date', () => {
    expect(parseNotificationUpdate(Role.STUDENT, { readAt: '2026-10-11T07:00:00.000Z' }, NOW)).toEqual({
      kind: 'read',
      readAt: new Date('2026-10-11T07:00:00.000Z'),
    });
  });

  it('refuses every other field, so a learner cannot rewrite a notification, re-address it or make it global', () => {
    for (const body of [
      { title: 'Hadiah untukmu' },
      { body: 'klik tautan ini' },
      { userId: '2f1c7b36-6a8a-4d1a-9d0f-0f8f2f9b1a11' },
      { isGlobal: true },
      { type: 'SYSTEM' },
      { readAt: '2026-10-11T07:00:00.000Z', isGlobal: true },
    ]) {
      expect(() => parseNotificationUpdate(Role.STUDENT, body, NOW)).toThrow();
    }
  });

  it('refuses a read time that is not a datetime', () => {
    expect(() => parseNotificationUpdate(Role.STUDENT, { readAt: 'kemarin' }, NOW)).toThrow();
  });

  it('applies to a teacher the same as to a learner', () => {
    expect(() => parseNotificationUpdate(Role.TEACHER, { isGlobal: true }, NOW)).toThrow();
  });
});

describe('parseNotificationUpdate for an admin', () => {
  it('may edit the content', () => {
    expect(parseNotificationUpdate(Role.ADMIN, { title: 'Pengumuman baru', isGlobal: true }, NOW)).toEqual({
      kind: 'edit',
      values: { title: 'Pengumuman baru', isGlobal: true },
    });
  });

  it('treats a body with only a read time as a read', () => {
    expect(parseNotificationUpdate(Role.ADMIN, { readAt: '2026-10-11T07:00:00.000Z' }, NOW)).toEqual({
      kind: 'read',
      readAt: new Date('2026-10-11T07:00:00.000Z'),
    });
  });

  it('still validates the content', () => {
    expect(() => parseNotificationUpdate(Role.ADMIN, { title: '' }, NOW)).toThrow();
    expect(() => parseNotificationUpdate(Role.ADMIN, { type: 'NOT_A_TYPE' }, NOW)).toThrow();
  });
});
