CREATE TYPE "ConceptStatus" AS ENUM ('ACTIVE', 'DEPRECATED');

CREATE TYPE "ReviewStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED');

CREATE TYPE "AliasKind" AS ENUM ('EXACT', 'PART_OF', 'UMBRELLA', 'UNMATCHED');

ALTER TABLE "LearningEvent" ADD COLUMN     "conceptId" TEXT,
ADD COLUMN     "schemaVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "streamSeq" INTEGER;

CREATE TABLE "Concept" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'ACCOUNTING',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "level" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "estimatedMinutes" INTEGER,
    "status" "ConceptStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Concept_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConceptPrerequisite" (
    "conceptId" TEXT NOT NULL,
    "requiresId" TEXT NOT NULL,

    CONSTRAINT "ConceptPrerequisite_pkey" PRIMARY KEY ("conceptId","requiresId")
);

CREATE TABLE "ConceptAlias" (
    "id" TEXT NOT NULL,
    "scheme" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "conceptId" TEXT,
    "kind" "AliasKind" NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PROPOSED',
    "note" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ConceptAlias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConceptCurriculumLink" (
    "id" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "subTopicId" TEXT,
    "lessonId" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PROPOSED',

    CONSTRAINT "ConceptCurriculumLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearnerStream" (
    "userId" TEXT NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,
    "modelVersion" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearnerStream_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "ConceptMastery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "theta" DOUBLE PRECISION NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "evidenceCount" INTEGER NOT NULL,
    "lastEventAt" TIMESTAMP(3) NOT NULL,
    "lastSeq" INTEGER NOT NULL,
    "modelVersion" TEXT NOT NULL,

    CONSTRAINT "ConceptMastery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Concept_domain_level_sortOrder_idx" ON "Concept"("domain", "level", "sortOrder");

CREATE INDEX "ConceptPrerequisite_requiresId_idx" ON "ConceptPrerequisite"("requiresId");

CREATE INDEX "ConceptAlias_scheme_alias_idx" ON "ConceptAlias"("scheme", "alias");

CREATE INDEX "ConceptAlias_conceptId_idx" ON "ConceptAlias"("conceptId");

CREATE INDEX "ConceptCurriculumLink_subTopicId_idx" ON "ConceptCurriculumLink"("subTopicId");

CREATE INDEX "ConceptCurriculumLink_lessonId_idx" ON "ConceptCurriculumLink"("lessonId");

CREATE INDEX "ConceptCurriculumLink_conceptId_idx" ON "ConceptCurriculumLink"("conceptId");

CREATE INDEX "ConceptMastery_userId_idx" ON "ConceptMastery"("userId");

CREATE UNIQUE INDEX "ConceptMastery_userId_conceptId_key" ON "ConceptMastery"("userId", "conceptId");

CREATE INDEX "LearningEvent_userId_conceptId_streamSeq_idx" ON "LearningEvent"("userId", "conceptId", "streamSeq");

CREATE UNIQUE INDEX "LearningEvent_userId_streamSeq_key" ON "LearningEvent"("userId", "streamSeq");

ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ConceptPrerequisite" ADD CONSTRAINT "ConceptPrerequisite_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConceptPrerequisite" ADD CONSTRAINT "ConceptPrerequisite_requiresId_fkey" FOREIGN KEY ("requiresId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConceptAlias" ADD CONSTRAINT "ConceptAlias_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConceptCurriculumLink" ADD CONSTRAINT "ConceptCurriculumLink_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConceptCurriculumLink" ADD CONSTRAINT "ConceptCurriculumLink_subTopicId_fkey" FOREIGN KEY ("subTopicId") REFERENCES "SubTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConceptCurriculumLink" ADD CONSTRAINT "ConceptCurriculumLink_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LearnerStream" ADD CONSTRAINT "LearnerStream_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConceptMastery" ADD CONSTRAINT "ConceptMastery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConceptMastery" ADD CONSTRAINT "ConceptMastery_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "ConceptPrerequisite" ADD CONSTRAINT "ConceptPrerequisite_not_self" CHECK ("conceptId" <> "requiresId");

ALTER TABLE "ConceptCurriculumLink" ADD CONSTRAINT "ConceptCurriculumLink_exactly_one_target" CHECK (("subTopicId" IS NULL) <> ("lessonId" IS NULL));

CREATE UNIQUE INDEX "ConceptCurriculumLink_concept_subTopic_key" ON "ConceptCurriculumLink"("conceptId", "subTopicId") WHERE "subTopicId" IS NOT NULL;

CREATE UNIQUE INDEX "ConceptCurriculumLink_concept_lesson_key" ON "ConceptCurriculumLink"("conceptId", "lessonId") WHERE "lessonId" IS NOT NULL;

ALTER TABLE "ConceptAlias" ADD CONSTRAINT "ConceptAlias_target_matches_kind" CHECK (("kind" = 'UNMATCHED') = ("conceptId" IS NULL));

ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_streamSeq_positive" CHECK ("streamSeq" IS NULL OR "streamSeq" > 0);

ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_assessment_has_concept" CHECK ("streamSeq" IS NULL OR "eventType" <> 'ASSESSMENT_COMPLETED' OR "conceptId" IS NOT NULL);

ALTER TABLE "ConceptMastery" ADD CONSTRAINT "ConceptMastery_bounds" CHECK ("score" BETWEEN 0 AND 1 AND "confidence" BETWEEN 0 AND 1 AND "evidenceCount" >= 0);

CREATE FUNCTION "learning_event_immutable"() RETURNS trigger AS $$
BEGIN
    IF OLD."streamSeq" IS NOT NULL THEN
        RAISE EXCEPTION 'LearningEvent rows in a learner stream are immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "LearningEvent_immutable" BEFORE UPDATE ON "LearningEvent" FOR EACH ROW EXECUTE FUNCTION "learning_event_immutable"();
