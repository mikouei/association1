-- Signataire des reçus (nom + titre), signature manuscrite et cachet (une ligne par association)
ALTER TABLE "Association" ADD COLUMN IF NOT EXISTS "signerName" TEXT;
ALTER TABLE "Association" ADD COLUMN IF NOT EXISTS "signerTitle" TEXT;

CREATE TABLE IF NOT EXISTS "AssociationSignature" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "imageData" TEXT,
    "stampData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AssociationSignature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AssociationSignature_associationId_key" ON "AssociationSignature"("associationId");

DO $$ BEGIN
    ALTER TABLE "AssociationSignature" ADD CONSTRAINT "AssociationSignature_associationId_fkey"
        FOREIGN KEY ("associationId") REFERENCES "Association"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
