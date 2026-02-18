/*
  Warnings:

  - A unique constraint covering the columns `[walletId,reason,requestId]` on the table `CreditLedger` will be added. If there are existing duplicate values, this will fail.
  - Made the column `requestId` on table `CreditLedger` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "CreditLedger" ALTER COLUMN "requestId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CreditLedger_walletId_reason_requestId_key" ON "CreditLedger"("walletId", "reason", "requestId");
