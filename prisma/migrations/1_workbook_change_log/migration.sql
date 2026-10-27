-- CreateTable (IF NOT EXISTS: the app may already have created it on first use)
CREATE TABLE IF NOT EXISTS "WorkbookChangeLog" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "fileVersionId" TEXT,
    "previousVersionId" TEXT,
    "originalFilename" TEXT,
    "previousFilename" TEXT,
    "source" TEXT,
    "uploadedById" TEXT,
    "uploadedByName" TEXT,
    "isFirst" BOOLEAN NOT NULL DEFAULT false,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "changes" JSONB NOT NULL DEFAULT '[]',
    "truncated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkbookChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkbookChangeLog_scope_createdAt_idx" ON "WorkbookChangeLog"("scope", "createdAt" DESC);
