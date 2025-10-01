-- CreateTable
CREATE TABLE "ExternalWebhook" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "events" JSONB,
    "headers" JSONB,
    "authentication" JSONB,
    "retryConfig" JSONB,
    "filterConfig" JSONB,
    "timeout" INTEGER NOT NULL DEFAULT 30000,
    "description" VARCHAR(500),
    "lastExecutionAt" TIMESTAMP,
    "lastExecutionStatus" VARCHAR(20),
    "lastExecutionError" TEXT,
    "totalExecutions" INTEGER NOT NULL DEFAULT 0,
    "successfulExecutions" INTEGER NOT NULL DEFAULT 0,
    "failedExecutions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL,

    CONSTRAINT "ExternalWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalWebhook_name_key" ON "ExternalWebhook"("name");

-- CreateIndex
CREATE INDEX "ExternalWebhook_enabled_idx" ON "ExternalWebhook"("enabled");

-- CreateIndex
CREATE INDEX "ExternalWebhook_lastExecutionAt_idx" ON "ExternalWebhook"("lastExecutionAt");