import type { CreatorProfileView, MarketplaceArticleView, MarketplaceClassView } from '~/interfaces/commerce';
import { formatDate, formatMoney } from '~/lib/format';
import { coverInitial, coverTone, plainText } from '~/lib/topics';

export interface CatalogCard {
  kind: 'article' | 'class';
  id: string;
  title: string;
  summary: string;
  creator: string;
  priceLabel: string;
  free: boolean;
  meta: string;
  to: string;
  coverUrl: string | null;
  tone: number;
  initial: string;
}

const DIFFICULTY: Record<string, string> = { BEGINNER: 'Pemula', INTERMEDIATE: 'Menengah', ADVANCED: 'Mahir' };
const FORMAT: Record<string, string> = { LIVE: 'Live', RECORDED: 'Rekaman', HYBRID: 'Hibrida' };

export function priceText(accessType: 'FREE' | 'PAID', price: string | number | null, currency: string): string {
  if (accessType === 'FREE') return 'Gratis';
  const value = typeof price === 'number' ? price : Number.parseFloat(String(price ?? ''));
  if (!Number.isFinite(value) || value <= 0) return 'Harga belum diatur';
  return formatMoney(value, currency);
}

const SUMMARY_LENGTH = 140;

export function articleCard(article: MarketplaceArticleView): CatalogCard {
  const published = article.publishedAt ? formatDate(article.publishedAt) : '';
  return {
    kind: 'article',
    id: article.id,
    title: article.title,
    summary: plainText(article.excerpt, SUMMARY_LENGTH),
    creator: article.author?.name ?? article.tenant?.name ?? '',
    priceLabel: priceText(article.accessType, article.price, article.currency),
    free: article.accessType === 'FREE',
    meta: published ? `Artikel · ${published}` : 'Artikel',
    to: `/marketplace/articles/${article.id}`,
    coverUrl: article.coverImage?.url ?? null,
    tone: coverTone(article.title),
    initial: coverInitial(article.title),
  };
}

export function classCard(item: MarketplaceClassView): CatalogCard {
  const parts = ['Kelas', ...classMeta(item)];
  return {
    kind: 'class',
    id: item.id,
    title: item.title,
    summary: plainText(item.description, SUMMARY_LENGTH),
    creator: item.instructor?.name ?? item.tenant?.name ?? '',
    priceLabel: priceText(item.accessType, item.price, item.currency),
    free: item.accessType === 'FREE',
    meta: parts.join(' · '),
    to: `/marketplace/classes/${item.id}`,
    coverUrl: item.coverImage?.url ?? null,
    tone: coverTone(item.title),
    initial: coverInitial(item.title),
  };
}

export function interleave<T>(first: readonly T[], second: readonly T[]): T[] {
  const result: T[] = [];
  const longest = Math.max(first.length, second.length);
  for (let index = 0; index < longest; index += 1) {
    if (index < first.length) result.push(first[index]!);
    if (index < second.length) result.push(second[index]!);
  }
  return result;
}

export function catalogPages(first: { totalPages: number } | undefined, second: { totalPages: number } | undefined): number {
  return Math.max(1, first?.totalPages ?? 0, second?.totalPages ?? 0);
}

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Terbaru' },
  { value: 'price_asc', label: 'Harga terendah' },
  { value: 'price_desc', label: 'Harga tertinggi' },
  { value: 'title', label: 'Judul A–Z' },
] as const;

export type ClassActionKind = 'enrolled' | 'full' | 'login' | 'enroll' | 'buy';

export function classAction(input: {
  accessType: 'FREE' | 'PAID';
  signedIn: boolean;
  accessible: boolean;
  seatsLeft: number | null;
}): { kind: ClassActionKind; label: string } {
  if (input.accessible) return { kind: 'enrolled', label: 'Kamu sudah terdaftar' };
  if (input.seatsLeft !== null && input.seatsLeft <= 0) return { kind: 'full', label: 'Kelas penuh' };
  const free = input.accessType === 'FREE';
  if (!input.signedIn) return { kind: 'login', label: free ? 'Masuk untuk mendaftar' : 'Masuk untuk membeli' };
  return free ? { kind: 'enroll', label: 'Daftar gratis' } : { kind: 'buy', label: 'Beli kelas' };
}

export function externalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^https?:\/\/[^\s]+$/i.test(value) ? value : null;
}

export function classMeta(item: Pick<MarketplaceClassView, 'difficulty' | 'format' | 'durationMinutes'>): string[] {
  return [
    DIFFICULTY[item.difficulty] ?? item.difficulty,
    FORMAT[item.format] ?? item.format,
    ...(item.durationMinutes ? [`${item.durationMinutes} menit`] : []),
  ];
}

export function creatorCards(profile: CreatorProfileView): CatalogCard[] {
  const author = { id: profile.id, name: profile.fullName, image: null };
  const articles = profile.articles.map((article) =>
    articleCard({ ...article, category: null, author, tenant: null }),
  );
  const classes = profile.classes.map((item) =>
    classCard({ ...item, capacity: null, seatsLeft: null, instructor: author, tenant: null }),
  );
  return interleave(articles, classes);
}
