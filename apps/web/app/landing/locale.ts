export const LOCALES = ['id', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'id';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

function fromAcceptLanguage(header: string | undefined): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const quality = params.map((param) => param.trim()).find((param) => param.startsWith('q='));
      return { tag: tag.toLowerCase(), q: quality ? Number(quality.slice(2)) || 0 : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    if (tag === 'id' || tag.startsWith('id-')) return 'id';
    if (tag === 'en' || tag.startsWith('en-')) return 'en';
  }
  return null;
}

export function resolveLocale(input: {
  readonly query?: unknown;
  readonly cookie?: unknown;
  readonly acceptLanguage?: string;
}): Locale {
  const query = Array.isArray(input.query) ? input.query[0] : input.query;
  if (isLocale(query)) return query;
  if (isLocale(input.cookie)) return input.cookie;
  return fromAcceptLanguage(input.acceptLanguage) ?? DEFAULT_LOCALE;
}
