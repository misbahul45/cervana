import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = `${process.env.DATABASE_URL}`;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function ensureSeedUsers(): Promise<void> {
  const teacherEmail = "seed.teacher@reducera.local";
  const existingTeacher = await prisma.user.findFirst({
    where: { role: "TEACHER" },
  });
  if (!existingTeacher) {
    await prisma.user.upsert({
      where: { email: teacherEmail },
      update: { role: "TEACHER" },
      create: {
        email: teacherEmail,
        name: "Seed Teacher",
        role: "TEACHER",
      },
    });
  }
  const existingAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
  });
  if (!existingAdmin) {
    await prisma.user.upsert({
      where: { email: "seed.admin@reducera.local" },
      update: { role: "ADMIN" },
      create: {
        email: "seed.admin@reducera.local",
        name: "Seed Admin",
        role: "ADMIN",
      },
    });
  }
}

async function main(): Promise<void> {
  await ensureSeedUsers();
  await prisma.$disconnect();
  await import("./seed-golden-graph");
  await import("./seed-theme");
}

main().catch(async (error: unknown) => {
  console.error("seed failed:", error);
  await prisma.$disconnect();
  process.exit(1);
});