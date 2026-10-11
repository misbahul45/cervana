import { UnrecoverableError } from 'bullmq';
import { AiServiceError } from '@/common/ai-client/ai-service.error';

export const asJobError = (error: unknown): unknown =>
  error instanceof AiServiceError && !error.retryable ? new UnrecoverableError(error.message) : error;
