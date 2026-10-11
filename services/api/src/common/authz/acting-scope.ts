import { ForbiddenException } from '@nestjs/common';

export const resolveActingUserScope = (actingUserId: string, requestedUserId?: unknown): string => {
  if (requestedUserId === undefined) return actingUserId;
  if (typeof requestedUserId !== 'string' || requestedUserId !== actingUserId) {
    throw new ForbiddenException('Access to this resource is not permitted');
  }
  return actingUserId;
};
