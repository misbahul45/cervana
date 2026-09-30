import { AppError, AppErrorCode } from '@/common/lib/error';

export interface UploadedFileRef {
  url: string;
  fileId: string;
}

export interface FileOwnershipChecker {
  ownsFile(actor: { id: string; role: string }, fileId: string): boolean;
}

export function assertOwnedUploadedFile(
  checker: FileOwnershipChecker,
  actor: { id: string; role: string },
  ref: UploadedFileRef,
  label = 'File',
): void {
  let parsed: URL;
  try {
    parsed = new URL(ref.url);
  } catch {
    throw new AppError(`${label} URL is invalid`, 422, AppErrorCode.VALIDATION_ERROR);
  }

  let path = parsed.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    path = parsed.pathname;
  }

  if (parsed.protocol !== 'https:' || !path.includes(ref.fileId) || !checker.ownsFile(actor, ref.fileId)) {
    throw new AppError(`${label} must be a file you uploaded`, 422, AppErrorCode.VALIDATION_ERROR);
  }
}
