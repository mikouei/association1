-- AlterTable ExceptionalContribution
ALTER TABLE "ExceptionalContribution" ADD COLUMN "eventDate" TIMESTAMP(3);
ALTER TABLE "ExceptionalContribution" ADD COLUMN "hasCollection" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ExceptionalContribution" ADD COLUMN "recurrence" TEXT NOT NULL DEFAULT 'once';
