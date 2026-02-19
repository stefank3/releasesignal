-- DropIndex
DROP INDEX "ChatSession_auth0Sub_createdAt_id_idx";

-- CreateIndex
CREATE INDEX "ChatSession_auth0Sub_updatedAt_id_idx" ON "ChatSession"("auth0Sub", "updatedAt", "id");
