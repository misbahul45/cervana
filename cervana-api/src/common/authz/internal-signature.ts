import { createHash, createHmac, timingSafeEqual } from 'crypto';

export const SERVICE_ID_HEADER = 'x-service-id';
export const SERVICE_TIMESTAMP_HEADER = 'x-service-timestamp';
export const SERVICE_SIGNATURE_HEADER = 'x-service-signature';
export const TRACE_ID_HEADER = 'x-trace-id';
export const IDEMPOTENCY_KEY_HEADER = 'x-idempotency-key';
export const ACTING_USER_HEADER = 'x-acting-user-id';

export interface SignatureInput {
  secret: string;
  timestamp: string;
  method: string;
  target: string;
  body: Buffer | string;
}

export const canonicalString = (input: Omit<SignatureInput, 'secret'>): string =>
  [
    input.timestamp,
    input.method.toUpperCase(),
    input.target,
    createHash('sha256').update(input.body).digest('hex'),
  ].join('\n');

export const computeSignature = (input: SignatureInput): string =>
  createHmac('sha256', input.secret).update(canonicalString(input)).digest('hex');

export const signaturesMatch = (expected: string, provided: string): boolean => {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
};
