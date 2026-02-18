/*
  Warnings:

  - A unique constraint covering the columns `[sessionId,requestId]` on the table `ChatMessage` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_sessionId_requestId_key" ON "ChatMessage"("sessionId", "requestId");
