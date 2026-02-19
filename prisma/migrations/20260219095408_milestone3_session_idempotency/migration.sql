/*
  Warnings:

  - A unique constraint covering the columns `[auth0Sub,clientSessionId]` on the table `ChatSession` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ChatSession" ADD COLUMN     "clientSessionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ChatSession_auth0Sub_clientSessionId_key" ON "ChatSession"("auth0Sub", "clientSessionId");
