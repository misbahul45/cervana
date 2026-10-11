import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { ThemeSeeder, SeedTheme } from '../src/v1/gamify/themes/theme-seeder';
import { defaultThemeIcons } from '../src/v1/gamify/themes/theme-icons';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL must be set');
}

const DEFAULT_SLUG = 'reducera-play';
const ICON_THEMES = ['reducera-play'];

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const seedDir = path.resolve(__dirname, 'seed-data');

const themes = (): SeedTheme[] =>
  fs
    .readdirSync(seedDir)
    .filter((file) => file.endsWith('.theme.json'))
    .sort()
    .map((file) => JSON.parse(fs.readFileSync(path.join(seedDir, file), 'utf8')) as SeedTheme);

async function main() {
  const report = await new ThemeSeeder(prisma).run({
    themes: themes(),
    defaultSlug: DEFAULT_SLUG,
    icons: Object.fromEntries(ICON_THEMES.map((slug) => [slug, defaultThemeIcons(slug)])),
  });
  const defaults = await prisma.theme.findMany({ where: { isDefault: true }, select: { slug: true, version: true, status: true, scope: true } });
  console.log(`Seeded ${report.themes} themes and ${report.icons} icons; default: ${report.defaultSlug}`, defaults);
}

main()
  .catch((error) => {
    console.error('seed-theme failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
