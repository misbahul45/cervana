import { toRupiah } from '~/lib/helper';

export interface CategoryLike {
  id: string;
  name: string;
}

export const plainText = (html: string | null | undefined, max = Number.POSITIVE_INFINITY): string => {
  if (!html) return '';
  const text = html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const boundary = text[max] === ' ' ? max : cut.lastIndexOf(' ');
  const base = (boundary > 0 ? text.slice(0, boundary) : cut).trimEnd();
  return `${base}…`;
};

export const priceLabel = (price: number | null | undefined): string => {
  if (typeof price !== 'number' || !Number.isFinite(price)) return '-';
  return price === 0 ? 'Gratis' : toRupiah(price);
};

export const visibleCategories = <T extends CategoryLike>(
  categories: ReadonlyArray<T> | null | undefined,
  max: number,
): { shown: T[]; hidden: number } => {
  const list = categories ?? [];
  return { shown: list.slice(0, max), hidden: Math.max(0, list.length - max) };
};

export const filterByCategory = <T extends { categories?: ReadonlyArray<CategoryLike> | null }>(
  topics: ReadonlyArray<T>,
  categoryName: string | null | undefined,
): T[] => {
  const wanted = categoryName?.trim().toLowerCase();
  if (!wanted) return [...topics];
  return topics.filter((topic) => (topic.categories ?? []).some((category) => category.name.trim().toLowerCase() === wanted));
};

export const COVER_TONES = 6;

export const coverTone = (title: string): number => {
  let hash = 0;
  for (let index = 0; index < title.length; index += 1) hash = (hash * 31 + title.charCodeAt(index)) >>> 0;
  return hash % COVER_TONES;
};

export const coverInitial = (title: string): string => {
  const first = title.trim().charAt(0);
  return first ? first.toUpperCase() : 'R';
};

export type UnlockAction =
  | { kind: 'login'; to: string }
  | { kind: 'learn'; to: string }
  | { kind: 'order'; to: string }
  | { kind: 'claim' };

export interface UnlockInput {
  id: string;
  slug: string;
  price: number | null | undefined;
  signedIn: boolean;
  hasAccess: boolean;
}

export const unlockAction = ({ id, slug, price, signedIn, hasAccess }: UnlockInput): UnlockAction => {
  if (!signedIn) return { kind: 'login', to: '/login' };
  if (hasAccess) return { kind: 'learn', to: `/my-learning/topics/${slug}` };
  if (price === 0) return { kind: 'claim' };
  return { kind: 'order', to: `/learn/topics/${id}/order` };
};

export type ClaimOutcome = 'opened' | 'pending' | 'failed';

export const claimOutcome = (response: { success?: boolean; data?: { status?: string } | null } | null | undefined): ClaimOutcome => {
  if (!response?.success) return 'failed';
  const status = response.data?.status;
  return status === 'PAID' || status === 'FULFILLED' ? 'opened' : 'pending';
};

export interface EnrolledPage {
  items: ReadonlyArray<{ topicId: string }>;
  totalPages: number;
}

export const collectEnrolledTopicIds = async (
  fetchPage: (page: number) => Promise<EnrolledPage | undefined>,
  maxPages = 20,
): Promise<string[]> => {
  const ids = new Set<string>();
  for (let page = 1; page <= maxPages; page += 1) {
    const result = await fetchPage(page);
    if (!result) break;
    for (const item of result.items) ids.add(item.topicId);
    if (page >= result.totalPages) break;
  }
  return [...ids];
};

export const listFromResponse = <T>(body: unknown): T[] => {
  if (Array.isArray(body)) return body as T[];
  if (body && typeof body === 'object') {
    const inner = (body as { data?: unknown }).data;
    if (Array.isArray(inner)) return inner as T[];
  }
  return [];
};
