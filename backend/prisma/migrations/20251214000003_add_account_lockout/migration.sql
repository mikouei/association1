-- AlterTable User
ALTER TABLE "User" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lockedUntil" TIMESTAMP(3);

-- AlterTable SuperAdmin  
ALTER TABLE "SuperAdmin" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SuperAdmin" ADD COLUMN "lockedUntil" TIMESTAMP(3);
