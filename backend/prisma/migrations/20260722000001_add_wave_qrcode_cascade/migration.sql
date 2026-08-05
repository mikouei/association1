-- Migration: add_wave_qrcode_cascade
-- Cette migration regroupe trois changements de schéma:
-- 1. onDelete: Cascade sur ActivityLog → Association
-- 2. Champs Wave sur Association + modèle WaveTransaction
-- 3. Champs qrCode et qrGeneratedAt sur Member

-- 1. Modification ActivityLog: Ajouter CASCADE sur la relation Association
ALTER TABLE "ActivityLog" DROP CONSTRAINT IF EXISTS "ActivityLog_associationId_fkey";
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_associationId_fkey" 
  FOREIGN KEY ("associationId") REFERENCES "Association"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2a. Ajout des champs Wave sur Association
ALTER TABLE "Association" ADD COLUMN IF NOT EXISTS "waveApiKey" TEXT;
ALTER TABLE "Association" ADD COLUMN IF NOT EXISTS "waveMerchantId" TEXT;
ALTER TABLE "Association" ADD COLUMN IF NOT EXISTS "mobilePaymentEnabled" BOOLEAN NOT NULL DEFAULT false;

-- 2b. Création du modèle WaveTransaction
CREATE TABLE IF NOT EXISTS "WaveTransaction" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetRefId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "waveTransactionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "WaveTransaction_pkey" PRIMARY KEY ("id")
);

-- Index et contraintes pour WaveTransaction
CREATE UNIQUE INDEX IF NOT EXISTS "WaveTransaction_waveTransactionId_key" ON "WaveTransaction"("waveTransactionId");
CREATE INDEX IF NOT EXISTS "WaveTransaction_associationId_idx" ON "WaveTransaction"("associationId");
CREATE INDEX IF NOT EXISTS "WaveTransaction_waveTransactionId_idx" ON "WaveTransaction"("waveTransactionId");

-- Relation WaveTransaction → Association
ALTER TABLE "WaveTransaction" DROP CONSTRAINT IF EXISTS "WaveTransaction_associationId_fkey";
ALTER TABLE "WaveTransaction" ADD CONSTRAINT "WaveTransaction_associationId_fkey" 
  FOREIGN KEY ("associationId") REFERENCES "Association"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Ajout des champs QR Code sur Member
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "qrCode" TEXT;
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "qrGeneratedAt" TIMESTAMP(3);

-- Index et contrainte unique pour qrCode
CREATE UNIQUE INDEX IF NOT EXISTS "Member_qrCode_key" ON "Member"("qrCode");
CREATE INDEX IF NOT EXISTS "Member_qrCode_idx" ON "Member"("qrCode");
