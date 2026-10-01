-- ==============================================================================
-- Supabase PostgreSQL Schema & Initial Seeding for MFE Formwork MR11 System
-- You can run this directly in the Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE "RoleCode" AS ENUM ('ADMIN', 'CEO', 'BD', 'FINANCE', 'SHELLPLAN', 'DESIGN', 'PLANNING', 'PRODUCTION', 'DISPATCH');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "Mr11Status" AS ENUM ('EMPTY', 'PARTIAL', 'READY', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "FileVersionStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Tables
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Role" (
    "id" TEXT NOT NULL,
    "code" "RoleCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Department" (
    "id" TEXT NOT NULL,
    "code" "RoleCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "activeVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FileVersion" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" "FileVersionStatus" NOT NULL DEFAULT 'PROCESSING',
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "sheetMetadata" JSONB,
    "rawDataJson" JSONB,
    "errorMessage" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FileVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PlanningSeriesHistory" (
    "id" TEXT NOT NULL,
    "projectNo" TEXT NOT NULL,
    "projectShortname" TEXT,
    "stream" TEXT,
    "fontColor" TEXT,
    "seriesNumber" INTEGER NOT NULL,
    "totalProcessed" DOUBLE PRECISION,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceFileVersionId" TEXT,
    CONSTRAINT "PlanningSeriesHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PlanningProjectQuantityTracker" (
    "id" TEXT NOT NULL,
    "projectNo" TEXT NOT NULL,
    "projectShortname" TEXT,
    "stream" TEXT,
    "fontColor" TEXT,
    "totalTargetQuantity" DOUBLE PRECISION NOT NULL,
    "totalProcessed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balanceQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceFileVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanningProjectQuantityTracker_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductionSeriesHistory" (
    "id" TEXT NOT NULL,
    "projectShortname" TEXT NOT NULL,
    "stream" TEXT,
    "fontColor" TEXT,
    "seriesNumber" INTEGER NOT NULL,
    "totalFabricated" DOUBLE PRECISION,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceFileVersionId" TEXT,
    CONSTRAINT "ProductionSeriesHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Mr11Run" (
    "id" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT,
    "status" "Mr11Status" NOT NULL DEFAULT 'EMPTY',
    "sourceSnapshot" JSONB,
    "calculatedFields" JSONB,
    "summaryMetrics" JSONB,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Mr11Run_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Mr11Config" (
    "id" TEXT NOT NULL,
    "visibleColumns" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    CONSTRAINT "Mr11Config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- 3. Unique Constraints & Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Role_code_key" ON "Role"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");
CREATE UNIQUE INDEX IF NOT EXISTS "Department_code_key" ON "Department"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "PlanningSeriesHistory_projectNo_stream_fontColor_seriesNumber_key" 
ON "PlanningSeriesHistory"("projectNo", "stream", "fontColor", "seriesNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "PlanningProjectQuantityTracker_projectNo_stream_fontColor_key" 
ON "PlanningProjectQuantityTracker"("projectNo", "stream", "fontColor");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionSeriesHistory_projectShortname_stream_fontColor_seriesNumber_key" 
ON "ProductionSeriesHistory"("projectShortname", "stream", "fontColor", "seriesNumber");

-- 4. Initial Seed Data (Roles, Departments, Admin User)
INSERT INTO "Role" ("id", "code", "name", "description") VALUES
    ('role-admin', 'ADMIN', 'System Administrator', 'Full system configuration & control'),
    ('role-ceo', 'CEO', 'Executive / CEO', 'Executive read-only matrix & financial access'),
    ('role-bd', 'BD', 'Business Development', 'Master commercial schedule management'),
    ('role-finance', 'FINANCE', 'Finance', 'Cash flow & advance tracking'),
    ('role-shellplan', 'SHELLPLAN', 'Shellplan', 'Pre-design coordination'),
    ('role-design', 'DESIGN', 'Design', 'Design engineering execution'),
    ('role-planning', 'PLANNING', 'Planning', 'Factory sequence planning'),
    ('role-production', 'PRODUCTION', 'Production', 'Manufacturing & progress tracking'),
    ('role-dispatch', 'DISPATCH', 'Dispatch', 'Logistics & shipment verification')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Department" ("id", "code", "name", "description") VALUES
    ('dept-bd', 'BD', 'Business Development', 'Contract specifications & commercial data'),
    ('dept-finance', 'FINANCE', 'Finance', 'Payments & financial terms'),
    ('dept-shellplan', 'SHELLPLAN', 'Shellplan', 'Consultant drawing statuses & submissions'),
    ('dept-design', 'DESIGN', 'Design', 'Engineering design status & order quantities'),
    ('dept-planning', 'PLANNING', 'Planning', 'Production series & processing stages'),
    ('dept-production', 'PRODUCTION', 'Production', 'Manufacturing output tracking'),
    ('dept-dispatch', 'DISPATCH', 'Dispatch', 'Logistics, delivery, and sailing actuals')
ON CONFLICT ("code") DO NOTHING;

-- Seed Root Admin User: admin@mfeformwork.com / admin123 (PBKDF2 SHA512)
INSERT INTO "User" ("id", "email", "fullName", "passwordHash", "status", "isActive") VALUES
    ('user-admin-1', 'admin@mfeformwork.com', 'System Administrator', 'admin123', 'ACTIVE', true)
ON CONFLICT ("email") DO UPDATE SET "passwordHash" = 'admin123';

-- Link Admin to ADMIN role
INSERT INTO "UserRole" ("id", "userId", "roleId") VALUES
    ('ur-admin-admin', 'user-admin-1', 'role-admin')
ON CONFLICT ("userId", "roleId") DO NOTHING;

-- Seed MR11 Config Singleton
INSERT INTO "Mr11Config" ("id", "visibleColumns") VALUES
    ('singleton', ARRAY[]::TEXT[])
ON CONFLICT ("id") DO NOTHING;
