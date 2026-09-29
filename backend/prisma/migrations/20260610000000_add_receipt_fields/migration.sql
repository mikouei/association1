-- Ajout des champs de personnalisation des reçus sur Association
ALTER TABLE "Association" ADD COLUMN IF NOT EXISTS "receiptHeader" TEXT;
ALTER TABLE "Association" ADD COLUMN IF NOT EXISTS "receiptSignature" TEXT;
