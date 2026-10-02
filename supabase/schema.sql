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
    -- Columns the app reads and writes (see department.service.ts and server/db/supabase.ts)
    "storageKey" TEXT,
    "mimeType" TEXT,
    "parsedWorkbook" JSONB,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
ON CONFLICT ("email") DO NOTHING;

-- Link Admin to ADMIN role
INSERT INTO "UserRole" ("id", "userId", "roleId") VALUES
    ('ur-admin-admin', 'user-admin-1', 'role-admin')
ON CONFLICT ("userId", "roleId") DO NOTHING;

-- Seed department demo accounts (password: admin123, stored as the app's PBKDF2 hash)
INSERT INTO "User" ("id", "email", "fullName", "passwordHash", "status", "isActive") VALUES
    ('user-ceo-1', 'ceo@mfeformwork.com', 'Executive Director', 'pbkdf2$81d99ea7b1e74596d0ed4b7fd0a6381d$6113f46e1f1fd7186de02690717cef888badd155a861e6ca9540c29dc9856672162892cf9caf2b14ffd830f204627d0fbb403687d14315dc279d9d020d79af8f', 'ACTIVE', true),
    ('user-bd-1', 'bd@mfeformwork.com', 'BD Lead Officer', 'pbkdf2$7c1d7d6ce3ab76a42268deea817b93b4$8c435744f5f6d10d92e8c7e0375cbd84294a23ee361b70440341060c97f6008290ad8e411368317fa37d994b028309956a2b02a2b4d0c831c24f70439d00b257', 'ACTIVE', true),
    ('user-finance-1', 'finance@mfeformwork.com', 'Commercial Finance Lead', 'pbkdf2$62e6c52347a69bf035dfc8ff42b2adf2$71118ea100f55bb5bc27bba2c5a02ec824bdec3ff024e6a3c5689aa80a99ac300d959432b63a3c9a2aff68cb0247311479b3d094d0786cbc16684bc35c2fe1ae', 'ACTIVE', true),
    ('user-shellplan-1', 'shellplan@mfeformwork.com', 'Shellplan Architect', 'pbkdf2$539ebe5a400312838cb467a0857c58f8$dc2de3b59db37e7032645911ebc3a576619251aef111032e6b6bcc5e9c6cc349e7d38320c7c3e5bb211baed32fe389a2330d27d088e7b189ee3454f0d7625035', 'ACTIVE', true),
    ('user-design-1', 'design@mfeformwork.com', 'Lead Design Engineer', 'pbkdf2$1f293664cb454b70cf3c1bfbca570f48$8652f71282e3575c02dcef9bb5266e66aea3fce017eb52c284d377ec32f36649dea486fcffbb1964d4efb775ca32a2e358cc869563e5a92c1025edfbc9bbae02', 'ACTIVE', true),
    ('user-planning-1', 'planning@mfeformwork.com', 'Planning & Series Lead', 'pbkdf2$369b0a8880e43f95a86613af36630a15$5c8d21d77176448c97f549aa380151e60eaebe6904231a09ef9c78e9ac24c75c46f504c29a6643582128fbd37c39fcf56120e93e5cc181c6042048a6f8c78f58', 'ACTIVE', true),
    ('user-production-1', 'production@mfeformwork.com', 'Plant Operations Manager', 'pbkdf2$005aa7aa7278b2543728c2b9a059e51a$8f360db5bbcf11f9fae43706650431e4901f8ff390d5e7f8dacc8f828507d2034e09044ba22b92cd59c6cd3d682683ec8145a48e25b757f64071e922d4f015a7', 'ACTIVE', true),
    ('user-dispatch-1', 'dispatch@mfeformwork.com', 'Dispatch & Logistics Lead', 'pbkdf2$951ae5272b9922df4d64220e99ae1e57$c2255298663b7c3dac4ac5b30bbf2c09a66edd0d7c270ee75eebd0c1d7e0c2f8806965e5f37bc2d4cf585b84a00e0dc9d86c82fa9090692bc80b425fb7328dac', 'ACTIVE', true)
ON CONFLICT ("email") DO NOTHING;

INSERT INTO "UserRole" ("id", "userId", "roleId") VALUES
    ('ur-user-ceo-1-role-ceo', 'user-ceo-1', 'role-ceo'),
    ('ur-user-bd-1-role-bd', 'user-bd-1', 'role-bd'),
    ('ur-user-finance-1-role-finance', 'user-finance-1', 'role-finance'),
    ('ur-user-shellplan-1-role-shellplan', 'user-shellplan-1', 'role-shellplan'),
    ('ur-user-design-1-role-design', 'user-design-1', 'role-design'),
    ('ur-user-planning-1-role-planning', 'user-planning-1', 'role-planning'),
    ('ur-user-production-1-role-production', 'user-production-1', 'role-production'),
    ('ur-user-dispatch-1-role-dispatch', 'user-dispatch-1', 'role-dispatch')
ON CONFLICT ("userId", "roleId") DO NOTHING;

-- Seed MR11 Config Singleton
INSERT INTO "Mr11Config" ("id", "visibleColumns") VALUES
    ('singleton', ARRAY[]::TEXT[])
ON CONFLICT ("id") DO NOTHING;
