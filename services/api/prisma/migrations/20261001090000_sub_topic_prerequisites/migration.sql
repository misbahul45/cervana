-- CreateTable
CREATE TABLE "SubTopicPrerequisite" (
    "id" TEXT NOT NULL,
    "subTopicId" TEXT NOT NULL,
    "requiresId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubTopicPrerequisite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubTopicPrerequisite_subTopicId_idx" ON "SubTopicPrerequisite"("subTopicId");

-- CreateIndex
CREATE INDEX "SubTopicPrerequisite_requiresId_idx" ON "SubTopicPrerequisite"("requiresId");

-- CreateIndex
CREATE UNIQUE INDEX "SubTopicPrerequisite_subTopicId_requiresId_key" ON "SubTopicPrerequisite"("subTopicId", "requiresId");

-- AddForeignKey
ALTER TABLE "SubTopicPrerequisite" ADD CONSTRAINT "SubTopicPrerequisite_subTopicId_fkey" FOREIGN KEY ("subTopicId") REFERENCES "SubTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubTopicPrerequisite" ADD CONSTRAINT "SubTopicPrerequisite_requiresId_fkey" FOREIGN KEY ("requiresId") REFERENCES "SubTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add CHECK constraint: no self-edge
ALTER TABLE "SubTopicPrerequisite" ADD CONSTRAINT "SubTopicPrerequisite_no_self_edge" CHECK ("subTopicId" <> "requiresId");
