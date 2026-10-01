import { ClassFormat, ClassSessionStatus } from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';

export interface SessionLinks {
  status: ClassSessionStatus;
  meetingUrl: string | null;
  recordingUrl: string | null;
}

export function assertClassReady(format: ClassFormat, sessions: SessionLinks[]): void {
  const live = sessions.filter((session) => session.status !== ClassSessionStatus.CANCELLED);
  if (live.length === 0) {
    throw new AppError('Add at least one session before review', 422, AppErrorCode.VALIDATION_ERROR);
  }
  const hasMeeting = live.some((session) => session.meetingUrl);
  const hasRecording = live.some((session) => session.recordingUrl);
  if ((format === ClassFormat.LIVE || format === ClassFormat.HYBRID) && !hasMeeting) {
    throw new AppError('A live class needs a meeting link on at least one session', 422, AppErrorCode.VALIDATION_ERROR);
  }
  if ((format === ClassFormat.RECORDED || format === ClassFormat.HYBRID) && !hasRecording) {
    throw new AppError('A recorded class needs a recording link on at least one session', 422, AppErrorCode.VALIDATION_ERROR);
  }
}
