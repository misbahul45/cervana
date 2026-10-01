-- CreateEnum
CREATE TYPE "ThemeStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ThemeScope" AS ENUM ('GLOBAL', 'TENANT');

-- DropForeignKey
ALTER TABLE "Lesson" DROP CONSTRAINT "Lesson_themeId_fkey";

-- DropForeignKey
ALTER TABLE "Step" DROP CONSTRAINT "Step_themeId_fkey";

-- DropForeignKey
ALTER TABLE "SubTopic" DROP CONSTRAINT "SubTopic_themeId_fkey";

-- AlterTable
ALTER TABLE "Lesson" ALTER COLUMN "themeId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Step" ALTER COLUMN "themeId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Theme" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "atmosphere" JSONB,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mood" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "provenance" JSONB,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "scope" "ThemeScope" NOT NULL DEFAULT 'GLOBAL',
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "status" "ThemeStatus" NOT NULL DEFAULT 'PUBLISHED',
ADD COLUMN     "tenantId" TEXT,
ADD COLUMN     "tokens" JSONB,
ADD COLUMN     "variants" JSONB,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "themeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Theme_slug_key" ON "Theme"("slug");

-- CreateIndex
CREATE INDEX "Theme_status_scope_idx" ON "Theme"("status", "scope");

-- CreateIndex
CREATE INDEX "Theme_tenantId_idx" ON "Theme"("tenantId");

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubTopic" ADD CONSTRAINT "SubTopic_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Step" ADD CONSTRAINT "Step_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Theme" ADD CONSTRAINT "Theme_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "Theme" SET "slug" = 'legacy-' || "id", "publishedAt" = "createdAt" WHERE "slug" IS NULL;

CREATE UNIQUE INDEX "Theme_single_default" ON "Theme" ("isDefault") WHERE "isDefault";

ALTER TABLE "Theme" ADD CONSTRAINT "Theme_default_is_published_global" CHECK (NOT "isDefault" OR ("status" = 'PUBLISHED' AND "scope" = 'GLOBAL'));

ALTER TABLE "Theme" ADD CONSTRAINT "Theme_tenant_scope" CHECK (("scope" = 'GLOBAL' AND "tenantId" IS NULL) OR ("scope" = 'TENANT' AND "tenantId" IS NOT NULL));
