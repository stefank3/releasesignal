/*
  Warnings:

  - Added the required column `updatedAt` to the `ChatSession` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ChatMessage_sessionId_createdAt_idx";

-- DropIndex
DROP INDEX "ChatSession_auth0Sub_createdAt_idx";

-- AlterTable
-- 1) Add new columns safely (updatedAt nullable first)
ALTER TABLE "ChatSession"
  ADD COLUMN "titleUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3);

-- 2) Backfill existing rows (use createdAt as initial updatedAt)
UPDATE "ChatSession"
SET "updatedAt" = COALESCE("updatedAt", "createdAt");

-- 3) Enforce NOT NULL after backfill
ALTER TABLE "ChatSession"
  ALTER COLUMN "updatedAt" SET NOT NULL;


-- CreateIndex
CREATE INDEX "ChatMessage_auth0Sub_sessionId_createdAt_id_idx" ON "ChatMessage"("auth0Sub", "sessionId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ChatSession_auth0Sub_createdAt_id_idx" ON "ChatSession"("auth0Sub", "createdAt", "id");
