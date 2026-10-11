import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { GamifySeeder } from '../src/v1/gamify/seed/gamify-seeder';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL must be set');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const report = await new GamifySeeder(prisma).run();
  console.log(`Seeded ${report.rules} reward rules, ${report.levels} level thresholds and ${report.achievements} achievements.`);
}

main()
  .catch((error) => {
    console.error('seed-gamify failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
