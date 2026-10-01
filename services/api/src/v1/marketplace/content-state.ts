import { ContentStatus } from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';

export const CONTENT_TRANSITIONS: Readonly<Record<ContentStatus, readonly ContentStatus[]>> = {
  [ContentStatus.DRAFT]: [ContentStatus.PENDING_REVIEW, ContentStatus.ARCHIVED],
  [ContentStatus.PENDING_REVIEW]: [ContentStatus.PUBLISHED, ContentStatus.REJECTED, ContentStatus.DRAFT],
  [ContentStatus.REJECTED]: [ContentStatus.PENDING_REVIEW, ContentStatus.ARCHIVED],
  [ContentStatus.PUBLISHED]: [ContentStatus.SUSPENDED, ContentStatus.ARCHIVED],
  [ContentStatus.SUSPENDED]: [ContentStatus.PUBLISHED, ContentStatus.ARCHIVED],
  [ContentStatus.ARCHIVED]: [],
};

export const EDITABLE_CONTENT_STATES: readonly ContentStatus[] = [ContentStatus.DRAFT, ContentStatus.REJECTED];

export const READABLE_BY_BUYERS: readonly ContentStatus[] = [ContentStatus.PUBLISHED, ContentStatus.ARCHIVED];

export function canTransitionContent(from: ContentStatus, to: ContentStatus): boolean {
  return CONTENT_TRANSITIONS[from].includes(to);
}

export function assertContentTransition(from: ContentStatus, to: ContentStatus): void {
  if (!canTransitionContent(from, to)) {
    throw new AppError(
      `Content cannot move from ${from} to ${to}`,
      409,
      AppErrorCode.INVALID_STATE_TRANSITION,
    );
  }
}

export function assertEditable(status: ContentStatus): void {
  if (!EDITABLE_CONTENT_STATES.includes(status)) {
    throw new AppError(
      `Content in state ${status} cannot be edited`,
      409,
      AppErrorCode.CONTENT_LOCKED,
    );
  }
}
