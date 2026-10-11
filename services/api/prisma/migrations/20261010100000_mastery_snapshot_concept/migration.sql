ALTER TABLE "MasterySnapshot" RENAME COLUMN "topicId" TO "conceptId";
ALTER INDEX "MasterySnapshot_topicId_snapshotAt_idx" RENAME TO "MasterySnapshot_conceptId_snapshotAt_idx";
