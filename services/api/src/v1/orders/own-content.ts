import { AppError, AppErrorCode } from '@/common/lib/error';
import { ResolvedLine } from './order-catalog.service';

export function assertNotOwnContent(userId: string, lines: Pick<ResolvedLine, 'creatorId'>[]): void {
  if (lines.some((line) => line.creatorId === userId)) {
    throw new AppError('Creators cannot buy their own content', 403, AppErrorCode.FORBIDDEN);
  }
}
