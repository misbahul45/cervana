CREATE TABLE "ClassAttendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attendedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassAttendance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClassAttendance_userId_idx" ON "ClassAttendance"("userId");

CREATE UNIQUE INDEX "ClassAttendance_sessionId_userId_key" ON "ClassAttendance"("sessionId", "userId");

ALTER TABLE "ClassAttendance" ADD CONSTRAINT "ClassAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClassAttendance" ADD CONSTRAINT "ClassAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClassEnrollment" ADD CONSTRAINT "ClassEnrollment_completed_at_matches_status" CHECK (("status" = 'COMPLETED') = ("completedAt" IS NOT NULL));

CREATE FUNCTION "enforce_class_capacity"() RETURNS trigger AS $$
DECLARE
  cap INTEGER;
  taken INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."classProductId" <> OLD."classProductId" OR NEW."userId" <> OLD."userId" THEN
      RAISE EXCEPTION 'an enrollment cannot move to another class or learner' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF OLD."status" = 'COMPLETED' AND NEW."status" <> 'COMPLETED' THEN
      RAISE EXCEPTION 'a completed enrollment cannot be reopened' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;

  IF NEW."status" IN ('ACTIVE', 'COMPLETED') AND (TG_OP = 'INSERT' OR OLD."status" = 'CANCELLED') THEN
    SELECT "capacity" INTO cap FROM "ClassProduct" WHERE "id" = NEW."classProductId" FOR UPDATE;
    IF cap IS NOT NULL THEN
      SELECT count(*) INTO taken FROM "ClassEnrollment"
      WHERE "classProductId" = NEW."classProductId" AND "status" IN ('ACTIVE', 'COMPLETED') AND "id" <> NEW."id";
      IF taken >= cap THEN
        RAISE EXCEPTION 'class is full' USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ClassEnrollment_capacity" BEFORE INSERT OR UPDATE ON "ClassEnrollment" FOR EACH ROW EXECUTE FUNCTION "enforce_class_capacity"();

CREATE FUNCTION "guard_class_capacity_change"() RETURNS trigger AS $$
DECLARE
  taken INTEGER;
BEGIN
  IF NEW."capacity" IS NOT NULL AND NEW."capacity" IS DISTINCT FROM OLD."capacity" THEN
    SELECT count(*) INTO taken FROM "ClassEnrollment"
    WHERE "classProductId" = NEW."id" AND "status" IN ('ACTIVE', 'COMPLETED');
    IF NEW."capacity" < taken THEN
      RAISE EXCEPTION 'capacity cannot be lower than the current enrollments' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ClassProduct_capacity_guard" BEFORE UPDATE OF "capacity" ON "ClassProduct" FOR EACH ROW EXECUTE FUNCTION "guard_class_capacity_change"();

CREATE FUNCTION "validate_class_attendance"() RETURNS trigger AS $$
DECLARE
  session RECORD;
BEGIN
  SELECT "classProductId", "status" INTO session FROM "ClassSession" WHERE "id" = NEW."sessionId";
  IF NOT FOUND OR session."status" = 'CANCELLED' THEN
    RAISE EXCEPTION 'attendance needs a session that is not cancelled' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "ClassEnrollment"
    WHERE "classProductId" = session."classProductId" AND "userId" = NEW."userId" AND "status" IN ('ACTIVE', 'COMPLETED')
  ) THEN
    RAISE EXCEPTION 'attendance needs an active enrollment' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ClassAttendance_validate" BEFORE INSERT ON "ClassAttendance" FOR EACH ROW EXECUTE FUNCTION "validate_class_attendance"();
