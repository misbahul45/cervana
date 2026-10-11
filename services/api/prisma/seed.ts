import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Role } from "@prisma/client";
import * as bcrypt from "bcrypt";

const connectionString = `${process.env.DATABASE_URL}`;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const BCRYPT_ROUNDS = 12;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;

const SEED_ACCOUNTS: ReadonlyArray<{ email: string; name: string; role: Role }> = [
  { email: "seed.student@reducera.local", name: "Seed Student", role: "STUDENT" },
  { email: "seed.teacher@reducera.local", name: "Seed Teacher", role: "TEACHER" },
  { email: "seed.reviewer@reducera.local", name: "Seed Reviewer", role: "REVIEWER" },
  { email: "seed.admin@reducera.local", name: "Seed Admin", role: "ADMIN" },
];

function readSeedPassword(): string {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed accounts must not be created with NODE_ENV=production");
  }
  const password = process.env.SEED_ACCOUNT_PASSWORD ?? "";
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw new Error(
      `SEED_ACCOUNT_PASSWORD must be ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters`,
    );
  }
  return password;
}

async function ensureSeedUsers(): Promise<void> {
  const password = await bcrypt.hash(readSeedPassword(), BCRYPT_ROUNDS);
  for (const account of SEED_ACCOUNTS) {
    await prisma.user.upsert({
      where: { email: account.email },
      update: {
        name: account.name,
        role: account.role,
        password,
        emailVerified: new Date(),
        isActive: true,
      },
      create: {
        ...account,
        password,
        emailVerified: new Date(),
      },
    });
  }
}

async function main(): Promise<void> {
  await ensureSeedUsers();
  await prisma.$disconnect();
  await import("./seed-golden-graph");
  await import("./seed-theme");
  await import("./seed-gamify");
}

main().catch(async (error: unknown) => {
  console.error("seed failed:", error);
  await prisma.$disconnect();
  process.exit(1);
});