import { randomUUID } from 'crypto';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { ThemeSeedError, ThemeSeeder, SeedTheme } from '@/v1/gamify/themes/theme-seeder';
import { THEME_ICON_NAMES, defaultThemeIcons } from '@/v1/gamify/themes/theme-icons';
import { ThemesRepo } from '@/v1/gamify/themes/themes.repo';
import { REGISTRY_SUITE_LOCK, databaseUrl, describeDb, holdSuiteLock } from '@/test-utils/pg-fixtures';

const tokens = {
  bg: '#FFFFFF', surface: '#FFFFFF', fg: '#3C3C3C', muted: '#6B6B6B', border: '#E5E5E5', borderStrong: '#8A8A8A',
  primary: '#2F7D00', primaryFg: '#FFFFFF', secondary: '#1D6FB8', secondaryFg: '#FFFFFF', accent: '#B85C00', focus: '#1D6FB8',
  foam: '#F7F7F7', sand: '#FFF4D6', primaryDepth: '#1F5A00',
};

const theme = (slug: string, overrides: Partial<SeedTheme> = {}): SeedTheme => ({
  slug,
  title: `Theme ${slug}`,
  primary: '#2F7D00',
  secondary: '#1D6FB8',
  mood: ['playful'],
  tokens: { light: tokens, dark: { ...tokens, bg: '#131F24' }, shape: { radius: 16, depth: 4 } },
  atmosphere: { motion: { intensity: 0.3 } },
  ...overrides,
});

describeDb('theme seeder (requires TEST_DATABASE_URL)', () => {
  let prisma: PrismaService;
  let seeder: ThemeSeeder;
  let releaseLock: () => Promise<void>;
  const tag = randomUUID().slice(0, 8);
  const slugA = `seed-a-${tag}`;
  const slugB = `seed-b-${tag}`;

  beforeAll(async () => {
    releaseLock = await holdSuiteLock(REGISTRY_SUITE_LOCK);
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    seeder = new ThemeSeeder(prisma);
  });

  afterAll(async () => {
    await prisma.theme.deleteMany({ where: { slug: { in: [slugA, slugB] } } });
    await prisma.$disconnect();
    await releaseLock();
  });

  it('creates published global themes, keeps the contract json, and makes exactly the chosen one the default', async () => {
    await seeder.run({ themes: [theme(slugA), theme(slugB)], defaultSlug: slugA, icons: {} });

    const rows = await prisma.theme.findMany({ where: { slug: { in: [slugA, slugB] } }, orderBy: { slug: 'asc' } });
    expect(rows.map((r) => [r.slug, r.status, r.scope, r.isDefault])).toEqual([
      [slugA, 'PUBLISHED', 'GLOBAL', true],
      [slugB, 'PUBLISHED', 'GLOBAL', false],
    ]);
    expect((rows[0].tokens as { shape: unknown }).shape).toEqual({ radius: 16, depth: 4 });
    expect(await prisma.theme.count({ where: { isDefault: true } })).toBe(1);
  });

  it('seeds one icon per vocabulary name for the themes that have icons, and serves them with the default theme', async () => {
    await seeder.run({ themes: [theme(slugA), theme(slugB)], defaultSlug: slugA, icons: { [slugA]: defaultThemeIcons(slugA) } });

    const found = await new ThemesRepo(prisma).findDefault();
    expect(found?.slug).toBe(slugA);
    expect(found?.icons.map((i) => i.name).sort()).toEqual([...THEME_ICON_NAMES].sort());
    const streak = found?.icons.find((i) => i.name === 'streak');
    expect(streak?.imageIcon).toEqual({ fileId: `bundled:${slugA}:streak`, url: `/themes/${slugA}/icons/streak.svg` });
  });

  it('is idempotent: a second run changes no row count and keeps the version', async () => {
    const before = await prisma.theme.findUniqueOrThrow({ where: { slug: slugA } });
    const iconsBefore = await prisma.themeIcon.count({ where: { themeId: before.id } });

    await seeder.run({ themes: [theme(slugA), theme(slugB)], defaultSlug: slugA, icons: { [slugA]: defaultThemeIcons(slugA) } });

    const after = await prisma.theme.findUniqueOrThrow({ where: { slug: slugA } });
    expect(after.version).toBe(before.version);
    expect(await prisma.themeIcon.count({ where: { themeId: after.id } })).toBe(iconsBefore);
  });

  it('bumps the version when the content changes and updates an icon in place', async () => {
    const before = await prisma.theme.findUniqueOrThrow({ where: { slug: slugA } });
    const changed = defaultThemeIcons(slugA).map((icon) => (icon.name === 'xp' ? { ...icon, url: `/themes/${slugA}/icons/xp-v2.svg` } : icon));

    await seeder.run({ themes: [theme(slugA, { title: 'Changed title' }), theme(slugB)], defaultSlug: slugA, icons: { [slugA]: changed } });

    const after = await prisma.theme.findUniqueOrThrow({ where: { slug: slugA } });
    expect(after.version).toBe(before.version + 1);
    expect(after.title).toBe('Changed title');
    const xpRows = await prisma.themeIcon.findMany({ where: { themeId: after.id, name: 'xp' } });
    expect(xpRows).toHaveLength(1);
    expect(xpRows[0].imageIcon).toMatchObject({ url: `/themes/${slugA}/icons/xp-v2.svg` });
  });

  it('moves the default flag when another theme is chosen', async () => {
    await seeder.run({ themes: [theme(slugA, { title: 'Changed title' }), theme(slugB)], defaultSlug: slugB, icons: {} });

    const rows = await prisma.theme.findMany({ where: { slug: { in: [slugA, slugB] } } });
    expect(Object.fromEntries(rows.map((r) => [r.slug, r.isDefault]))).toEqual({ [slugA]: false, [slugB]: true });
    expect(await prisma.theme.count({ where: { isDefault: true } })).toBe(1);
  });

  it('unsets the default flag of a theme that is not part of the seed', async () => {
    await prisma.theme.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    const outsider = await prisma.theme.create({
      data: { slug: `seed-c-${tag}`, title: 'Outsider', primary: '#2F7D00', secondary: '#1D6FB8', isDefault: true },
    });

    await seeder.run({ themes: [theme(slugA), theme(slugB)], defaultSlug: slugA, icons: {} });

    expect((await prisma.theme.findUniqueOrThrow({ where: { id: outsider.id } })).isDefault).toBe(false);
    await prisma.theme.delete({ where: { id: outsider.id } });
  });

  it('refuses an invalid theme, a missing default and icons of an unknown theme, and writes nothing', async () => {
    const countBefore = await prisma.theme.count();

    await expect(seeder.run({ themes: [theme(slugA, { primary: 'green' })], defaultSlug: slugA, icons: {} })).rejects.toBeInstanceOf(ThemeSeedError);
    await expect(seeder.run({ themes: [theme(slugA)], defaultSlug: 'nope', icons: {} })).rejects.toBeInstanceOf(ThemeSeedError);
    await expect(seeder.run({ themes: [theme(slugA)], defaultSlug: slugA, icons: { ghost: defaultThemeIcons('ghost') } })).rejects.toBeInstanceOf(ThemeSeedError);

    expect(await prisma.theme.count()).toBe(countBefore);
    expect((await prisma.theme.findUniqueOrThrow({ where: { slug: slugA } })).isDefault).toBe(true);
  });
});
