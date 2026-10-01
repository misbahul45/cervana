import * as fs from 'fs';
import * as path from 'path';
import "dotenv/config";
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = `${process.env.DATABASE_URL}`;
if (!connectionString) {
  throw new Error('DATABASE_URL must be set');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

interface ThemeJson {
  slug: string;
  title: string;
  description?: string;
  primary: string;
  secondary: string;
  tertiary?: string;
  quaternary?: string;
  mood?: string[];
  tokens?: unknown;
  atmosphere?: unknown;
  variants?: unknown;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function assertHex(name: string, value: string | undefined) {
  if (value !== undefined && !HEX.test(value)) {
    throw new Error(`seed-theme: ${name} must match #RRGGBB, got ${value}`);
  }
}

function validate(payload: ThemeJson) {
  assertHex('primary', payload.primary);
  assertHex('secondary', payload.secondary);
  assertHex('tertiary', payload.tertiary);
  assertHex('quaternary', payload.quaternary);
  if (!payload.slug) {
    throw new Error('seed-theme: slug is required');
  }
  if (!payload.title) {
    throw new Error('seed-theme: title is required');
  }
}

async function main() {
  const file = path.resolve(__dirname, 'seed-data', 'reducera-ocean.theme.json');
  const raw = fs.readFileSync(file, 'utf8');
  const payload = JSON.parse(raw) as ThemeJson;
  validate(payload);

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.theme.updateMany({
      where: {
        isDefault: true,
        NOT: { slug: payload.slug },
      },
      data: { isDefault: false },
    });

    const existing = await tx.theme.findUnique({ where: { slug: payload.slug } });

    if (existing) {
      await tx.theme.update({
        where: { slug: payload.slug },
        data: {
          title: payload.title,
          description: payload.description,
          primary: payload.primary,
          secondary: payload.secondary,
          tertiary: payload.tertiary,
          quaternary: payload.quaternary,
          status: 'PUBLISHED',
          scope: 'GLOBAL',
          isDefault: true,
          version: { increment: 1 },
          mood: payload.mood ?? [],
          tokens: payload.tokens ?? undefined,
          atmosphere: payload.atmosphere ?? undefined,
          variants: payload.variants ?? undefined,
          publishedAt: now,
        },
      });
    } else {
      await tx.theme.create({
        data: {
          slug: payload.slug,
          title: payload.title,
          description: payload.description,
          primary: payload.primary,
          secondary: payload.secondary,
          tertiary: payload.tertiary,
          quaternary: payload.quaternary,
          status: 'PUBLISHED',
          scope: 'GLOBAL',
          isDefault: true,
          version: 1,
          mood: payload.mood ?? [],
          tokens: payload.tokens ?? undefined,
          atmosphere: payload.atmosphere ?? undefined,
          variants: payload.variants ?? undefined,
          publishedAt: now,
        },
      });
    }
  });

  const result = await prisma.theme.findUnique({
    where: { slug: payload.slug },
    select: {
      slug: true,
      isDefault: true,
      status: true,
      scope: true,
      version: true,
      publishedAt: true,
    },
  });

  console.log('✅ Default theme upserted:', result);
}

main()
  .catch((error) => {
    console.error('seed-theme failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
