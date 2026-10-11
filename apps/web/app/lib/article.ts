export type PaywallKind = 'none' | 'login' | 'purchase';

export function paywallKind(input: { fullAccess: boolean; signedIn: boolean; accessType: 'FREE' | 'PAID' }): PaywallKind {
  if (input.fullAccess) return 'none';
  if (!input.signedIn) return 'login';
  return input.accessType === 'PAID' ? 'purchase' : 'none';
}

export function readingTimeLabel(minutes: number | null | undefined): string {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) return '';
  return `${Math.ceil(minutes)} menit baca`;
}

export function bylineParts(input: {
  author: string | null | undefined;
  tenant: string | null | undefined;
  publishedLabel: string;
  minutes: number | null | undefined;
}): string[] {
  const parts: string[] = [];
  const author = input.author?.trim();
  const tenant = input.tenant?.trim();
  if (author) parts.push(author);
  if (tenant && tenant !== author) parts.push(tenant);
  if (input.publishedLabel && input.publishedLabel !== '-') parts.push(input.publishedLabel);
  const reading = readingTimeLabel(input.minutes);
  if (reading) parts.push(reading);
  return parts;
}

export function articleSubtitle(excerpt: string | null | undefined): string {
  return (excerpt ?? '').replace(/\s+/g, ' ').trim();
}

const WORDS_PER_MINUTE = 200;

export function estimateMinutes(text: string): number {
  const words = text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
