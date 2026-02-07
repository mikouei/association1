-- CreateTable
CREATE TABLE "ExceptionalContribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExceptionalPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contributionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "paymentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExceptionalPayment_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "ExceptionalContribution" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExceptionalPayment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExceptionalPayment_contributionId_memberId_idx" ON "ExceptionalPayment"("contributionId", "memberId");
