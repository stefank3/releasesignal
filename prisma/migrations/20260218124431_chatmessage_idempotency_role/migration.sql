/*
  Warnings:

  - A unique constraint covering the columns `[sessionId,requestId,role]` on the table `ChatMessage` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ChatMessage_sessionId_requestId_key";

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_sessionId_requestId_role_key" ON "ChatMessage"("sessionId", "requestId", "role");
