export class AiServiceError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'AiServiceError';
  }
}

export const isRetryableStatus = (status: number): boolean =>
  status === 408 || status === 429 || status >= 500;
