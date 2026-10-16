-- Changements de tarif en cours d'année
CREATE TABLE IF NOT EXISTS "YearRateChange" (
    "id" TEXT NOT NULL,
    "yearId" TEXT NOT NULL,
    "fromMonth" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YearRateChange_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "YearRateChange_yearId_idx" ON "YearRateChange"("yearId");
CREATE UNIQUE INDEX IF NOT EXISTS "YearRateChange_yearId_fromMonth_key" ON "YearRateChange"("yearId", "fromMonth");
DO $$ BEGIN
  ALTER TABLE "YearRateChange" ADD CONSTRAINT "YearRateChange_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "Year"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
