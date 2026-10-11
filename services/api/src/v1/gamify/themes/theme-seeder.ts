import { Prisma, PrismaClient } from '@prisma/client';
import { normalizedThemeSchema } from './theme.schema';
import { BundledThemeIcon } from './theme-icons';

export interface SeedTheme {
  slug: string;
  title: string;
  description?: string;
  primary: string;
  secondary: string;
  tertiary?: string;
  quaternary?: string;
  mood?: string[];
  tokens: unknown;
  atmosphere?: unknown;
  variants?: unknown;
}

export interface ThemeSeedInput {
  themes: SeedTheme[];
  defaultSlug: string;
  icons: Record<string, BundledThemeIcon[]>;
}

export interface ThemeSeedReport {
  themes: number;
  icons: number;
  defaultSlug: string;
}

export class ThemeSeedError extends Error {}

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
};

const asJson = (value: unknown): Prisma.InputJsonValue | undefined => (value === undefined ? undefined : (value as Prisma.InputJsonValue));

export class ThemeSeeder {
  constructor(private readonly prisma: Pick<PrismaClient, '$transaction'>) {}

  async run(input: ThemeSeedInput): Promise<ThemeSeedReport> {
    const parsed = this.validate(input);
    const now = new Date();
    let iconRows = 0;

    await this.prisma.$transaction(async (tx) => {
      await tx.theme.updateMany({ where: { isDefault: true, slug: { notIn: [input.defaultSlug] } }, data: { isDefault: false } });

      for (const theme of parsed) {
        const isDefault = theme.slug === input.defaultSlug;
        const content = {
          title: theme.title,
          description: theme.description ?? null,
          primary: theme.primary,
          secondary: theme.secondary,
          tertiary: theme.tertiary ?? null,
          quaternary: theme.quaternary ?? null,
          mood: theme.mood,
          tokens: theme.tokens,
          atmosphere: theme.atmosphere ?? null,
          variants: theme.variants ?? null,
        };
        const data = {
          title: content.title,
          description: content.description,
          primary: content.primary,
          secondary: content.secondary,
          tertiary: content.tertiary,
          quaternary: content.quaternary,
          mood: content.mood,
          tokens: asJson(theme.tokens),
          atmosphere: asJson(theme.atmosphere),
          variants: asJson(theme.variants),
          status: 'PUBLISHED' as const,
          scope: 'GLOBAL' as const,
          isDefault,
        };

        const existing = await tx.theme.findUnique({ where: { slug: theme.slug } });
        let themeId: string;
        if (!existing) {
          themeId = (await tx.theme.create({ data: { slug: theme.slug, ...data, version: 1, publishedAt: now } })).id;
        } else {
          themeId = existing.id;
          const stored = {
            title: existing.title,
            description: existing.description,
            primary: existing.primary,
            secondary: existing.secondary,
            tertiary: existing.tertiary,
            quaternary: existing.quaternary,
            mood: existing.mood,
            tokens: existing.tokens,
            atmosphere: existing.atmosphere,
            variants: existing.variants,
          };
          const changed = canonical(stored) !== canonical(content);
          await tx.theme.update({
            where: { slug: theme.slug },
            data: { ...data, ...(changed ? { version: { increment: 1 } } : {}), publishedAt: existing.publishedAt ?? now },
          });
        }

        for (const icon of input.icons[theme.slug] ?? []) {
          const imageIcon = { fileId: icon.fileId, url: icon.url };
          const found = await tx.themeIcon.findFirst({ where: { themeId, name: icon.name } });
          if (found) {
            if (canonical(found.imageIcon) !== canonical(imageIcon)) {
              await tx.themeIcon.update({ where: { id: found.id }, data: { imageIcon } });
            }
          } else {
            await tx.themeIcon.create({ data: { themeId, name: icon.name, imageIcon } });
          }
          iconRows += 1;
        }
      }
    });

    return { themes: parsed.length, icons: iconRows, defaultSlug: input.defaultSlug };
  }

  private validate(input: ThemeSeedInput) {
    const parsed = input.themes.map((theme) => {
      const result = normalizedThemeSchema.safeParse(theme);
      if (!result.success) {
        const detail = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
        throw new ThemeSeedError(`theme ${theme.slug} is invalid: ${detail}`);
      }
      return { ...result.data, description: theme.description, tokens: result.data.tokens };
    });

    const slugs = new Set(parsed.map((theme) => theme.slug));
    if (!slugs.has(input.defaultSlug)) {
      throw new ThemeSeedError(`default theme ${input.defaultSlug} is not among the themes to seed`);
    }
    for (const slug of Object.keys(input.icons)) {
      if (!slugs.has(slug)) throw new ThemeSeedError(`icons given for unknown theme ${slug}`);
    }
    return parsed;
  }
}
