import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import {
  parseAliases,
  parseGoldenGraph,
  parseLinks,
} from '../src/v1/learner-model/concepts/concept-seed';
import { ConceptSeeder, ConceptSeedError } from '../src/v1/learner-model/concepts/concept-seeder';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL must be set');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const seedDir = path.resolve(__dirname, 'seed-data');
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(seedDir, name), 'utf8'));

async function main() {
  const report = await new ConceptSeeder(prisma).run({
    graph: parseGoldenGraph(read('golden-accounting-graph.json')),
    aliases: parseAliases(read('concept-aliases.json')),
    links: parseLinks(read('concept-curriculum-links.json')),
  });
  console.log(`Seeded ${report.concepts} concepts, ${report.prerequisites} prerequisites, ${report.aliases} alias rows, ${report.subTopicLinks} sub-topic links, ${report.lessonLinks} lesson links.`);
}

main()
  .catch((error) => {
    if (error instanceof ConceptSeedError) {
      console.error('seed-concepts refused the seed:\n' + error.issues.map((issue) => `  - ${issue}`).join('\n'));
    } else {
      console.error('seed-concepts failed:', error);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
