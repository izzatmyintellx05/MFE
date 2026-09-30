-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('ADMIN', 'CEO', 'BD', 'FINANCE', 'SHELLPLAN', 'DESIGN', 'PLANNING', 'PRODUCTION', 'DISPATCH');

-- CreateEnum
CREATE TYPE "Mr11Status" AS ENUM ('EMPTY', 'PARTIAL', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "FileVersionStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" "RoleCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "code" "RoleCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "activeVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileVersion" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "checksumSha256" TEXT,
    "status" "FileVersionStatus" NOT NULL DEFAULT 'READY',
    "parsedWorkbook" JSONB,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mr11Run" (
    "id" TEXT NOT NULL,
    "status" "Mr11Status" NOT NULL DEFAULT 'EMPTY',
    "sourceSnapshot" JSONB NOT NULL,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "records" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mr11Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mr11Config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "visibleColumns" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mr11Config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningSeriesHistory" (
    "id" TEXT NOT NULL,
    "projectNo" TEXT NOT NULL,
    "projectShortname" TEXT,
    "projectName" TEXT,
    "stream" TEXT NOT NULL,
    "fontColor" TEXT NOT NULL DEFAULT '#000000',
    "seriesNumber" INTEGER NOT NULL,
    "totalProcessed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalQuantity" DOUBLE PRECISION,
    "closingDate" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningSeriesHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningProjectQuantityTracker" (
    "id" TEXT NOT NULL,
    "projectNo" TEXT NOT NULL,
    "stream" TEXT NOT NULL,
    "fontColor" TEXT NOT NULL DEFAULT '#000000',
    "projectShortname" TEXT,
    "projectName" TEXT,
    "lastQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastChangedDate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningProjectQuantityTracker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionSeriesHistory" (
    "id" TEXT NOT NULL,
    "projectShortname" TEXT NOT NULL,
    "projectNo" TEXT,
    "projectName" TEXT,
    "stream" TEXT NOT NULL,
    "fontColor" TEXT NOT NULL DEFAULT '#000000',
    "seriesNumber" INTEGER NOT NULL,
    "totalProduced" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionSeriesHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Department_activeVersionId_key" ON "Department"("activeVersionId");

-- CreateIndex
CREATE INDEX "PlanningSeriesHistory_projectNo_stream_idx" ON "PlanningSeriesHistory"("projectNo", "stream");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningSeriesHistory_projectNo_stream_fontColor_seriesNumb_key" ON "PlanningSeriesHistory"("projectNo", "stream", "fontColor", "seriesNumber");

-- CreateIndex
CREATE INDEX "PlanningProjectQuantityTracker_projectNo_stream_idx" ON "PlanningProjectQuantityTracker"("projectNo", "stream");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningProjectQuantityTracker_projectNo_stream_fontColor_key" ON "PlanningProjectQuantityTracker"("projectNo", "stream", "fontColor");

-- CreateIndex
CREATE INDEX "ProductionSeriesHistory_projectShortname_stream_idx" ON "ProductionSeriesHistory"("projectShortname", "stream");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionSeriesHistory_projectShortname_stream_fontColor_s_key" ON "ProductionSeriesHistory"("projectShortname", "stream", "fontColor", "seriesNumber");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "FileVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileVersion" ADD CONSTRAINT "FileVersion_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileVersion" ADD CONSTRAINT "FileVersion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

