ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED';
CREATE INDEX IF NOT EXISTS "User_approvalStatus_idx" ON "User"("approvalStatus");
