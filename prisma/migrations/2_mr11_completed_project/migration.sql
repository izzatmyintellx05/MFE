-- CreateTable (IF NOT EXISTS: the app may already have created it on first use)
CREATE TABLE IF NOT EXISTS "Mr11CompletedProject" (
    "id" TEXT NOT NULL,
    "projectNo" TEXT,
    "shortName" TEXT,
    "projectName" TEXT,
    "completedById" TEXT,
    "completedBy" TEXT,
    "completedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mr11CompletedProject_pkey" PRIMARY KEY ("id")
);
