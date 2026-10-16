-- Infos de paiement affichées sur l'appel de charges
ALTER TABLE "Association" ADD COLUMN IF NOT EXISTS "paymentInfo" TEXT;
