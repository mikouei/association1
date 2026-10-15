-- Historique des versements partiels d'un paiement mensuel
CREATE TABLE IF NOT EXISTS "PaymentHistory" (
    "id" TEXT NOT NULL,
    "monthlyPaymentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PaymentHistory_monthlyPaymentId_idx" ON "PaymentHistory"("monthlyPaymentId");
DO $$ BEGIN
  ALTER TABLE "PaymentHistory" ADD CONSTRAINT "PaymentHistory_monthlyPaymentId_fkey" FOREIGN KEY ("monthlyPaymentId") REFERENCES "MonthlyPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
