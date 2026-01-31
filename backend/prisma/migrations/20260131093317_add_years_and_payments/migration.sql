-- CreateTable
CREATE TABLE "Year" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "monthlyAmount" REAL NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MonthlyPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "yearId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "amountPaid" REAL NOT NULL,
    "paymentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonthlyPayment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MonthlyPayment_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "Year" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Year_year_key" ON "Year"("year");

-- CreateIndex
CREATE INDEX "MonthlyPayment_memberId_yearId_month_idx" ON "MonthlyPayment"("memberId", "yearId", "month");
