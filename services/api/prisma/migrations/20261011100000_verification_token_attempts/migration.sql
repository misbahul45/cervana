DELETE FROM "VerificationToken";

DROP INDEX "VerificationToken_identifier_otp_key";

ALTER TABLE "VerificationToken" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_attempts_check" CHECK ("attempts" >= 0);

CREATE UNIQUE INDEX "VerificationToken_identifier_type_key" ON "VerificationToken"("identifier", "type");
