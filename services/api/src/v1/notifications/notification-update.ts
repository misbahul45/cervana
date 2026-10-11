import { Role } from '@prisma/client';
import { z } from 'zod';
import { UpdateNotificationDto, UpdateNotificationType } from './notifications.dto';

const ReadOnlyUpdate = z.object({ readAt: z.string().datetime().optional() }).strict();

export type NotificationChange =
  | { kind: 'read'; readAt: Date }
  | { kind: 'edit'; values: UpdateNotificationType };

const asRead = (readAt: string | undefined, now: Date): NotificationChange => ({
  kind: 'read',
  readAt: readAt ? new Date(readAt) : now,
});

export const parseNotificationUpdate = (role: Role, body: unknown, now: Date = new Date()): NotificationChange => {
  if (role !== Role.ADMIN) {
    return asRead(ReadOnlyUpdate.parse(body ?? {}).readAt, now);
  }

  const onlyRead = ReadOnlyUpdate.safeParse(body ?? {});
  if (onlyRead.success) return asRead(onlyRead.data.readAt, now);

  return { kind: 'edit', values: UpdateNotificationDto.parse(body) };
};
