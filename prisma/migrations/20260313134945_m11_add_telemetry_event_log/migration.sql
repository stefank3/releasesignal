-- CreateTable
CREATE TABLE "TelemetryEventLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventType" TEXT NOT NULL,
    "auth0Sub" TEXT,
    "organizationId" TEXT,
    "sessionId" TEXT,
    "workflowStage" TEXT,
    "status" TEXT,
    "durationMs" INTEGER,
    "tokenInput" INTEGER,
    "tokenOutput" INTEGER,
    "tokenTotal" INTEGER,
    "artifactType" TEXT,
    "artifactVersion" INTEGER,
    "metadataJson" JSONB,

    CONSTRAINT "TelemetryEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TelemetryEventLog_createdAt_idx" ON "TelemetryEventLog"("createdAt");

-- CreateIndex
CREATE INDEX "TelemetryEventLog_eventType_createdAt_idx" ON "TelemetryEventLog"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "TelemetryEventLog_auth0Sub_createdAt_idx" ON "TelemetryEventLog"("auth0Sub", "createdAt");

-- CreateIndex
CREATE INDEX "TelemetryEventLog_organizationId_createdAt_idx" ON "TelemetryEventLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "TelemetryEventLog_sessionId_createdAt_idx" ON "TelemetryEventLog"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "TelemetryEventLog_workflowStage_createdAt_idx" ON "TelemetryEventLog"("workflowStage", "createdAt");

-- CreateIndex
CREATE INDEX "TelemetryEventLog_status_createdAt_idx" ON "TelemetryEventLog"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "TelemetryEventLog" ADD CONSTRAINT "TelemetryEventLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelemetryEventLog" ADD CONSTRAINT "TelemetryEventLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
