import { PrismaClient, RoleCode } from '@prisma/client';
import { parseAndNormalizeWorkbook } from '../../utils/excel-normalizer';
import { executeMr11Pipeline } from '../mr11/mr11.engine';
import { hydrateActiveVersionsFromDb, saveFileVersionToDb } from '../../db/supabase';

const prisma = new PrismaClient();

// Helper to normalize and sanitize cell values
function cleanCell(val: any): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s === '' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined' ? null : s;
}

// Parse dates into ISO string or clean date representation
function cleanDate(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  if (!s || s.toLowerCase() === 'tbc' || s === '-') return null;

  // Handle excel date or common formats (D/M/YYYY or YYYY-MM-DD)
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return s;
}

// Safe numeric parser
function cleanNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/,/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * 1. PARSE & MAP SHELLPLAN SPREADSHEET ROWS
 * Maps exact columns from shellplan.xlsx into standard MR11 schema.
 * Supports forward-fill for multi-building child rows.
 */
export function parseAndMapShellPlanRows(rawRows: any[]) {
  const mappedRecords: any[] = [];
  let currentProjectNo: string | null = null;
  let currentProjectName: string | null = null;

  for (const row of rawRows) {
    // Exact column keys as found in shellplan.xlsx
    const explicitProjNo = cleanCell(row['Project No.'] || row['Project No'] || row['projectNo']);
    const explicitProjName = cleanCell(row['Project Name'] || row['projectName']);

    if (explicitProjNo) {
      currentProjectNo = explicitProjNo;
      if (explicitProjName) currentProjectName = explicitProjName;
    }

    // Skip header or totally empty rows
    if (!currentProjectNo && !explicitProjNo) continue;

    const buildingName = cleanCell(row['Building Name'] || row['buildingName']);
    const subBuildingName = cleanCell(row['sub Building Name'] || row['subBuildingName']);
    const shellPlanStatus = cleanCell(row['Shell Plan Status'] || row['shellplan status'] || row['status']);
    const shellPlanStartDate = cleanDate(row['Shell Plan Start Date']);
    const latestRevision = cleanCell(row['Latest Revision'] || row['latest revision version'] || row['revision']);
    const latestSubmissionDate = cleanDate(row['Latest Submission Date'] || row['latest revision date']);
    const shellPlanApprovedDate = cleanDate(row['Shell Plan Approved Date'] || row['shellplan approval date']);
    const remarks = cleanCell(
      row['Remarks (Shell Model Update / Correction / Client Changes, etc) - Free Form'] ||
      row['Remarks'] ||
      row['remarks']
    );

    mappedRecords.push({
      projectNo: currentProjectNo,
      projectName: currentProjectName,
      buildingName,
      subBuildingName,
      shellPlanStatus,
      shellPlanStartDate,
      latestRevision,
      latestSubmissionDate,
      shellPlanApprovedDate,
      remarks,
    });
  }

  return mappedRecords;
}

/**
 * 2. PARSE & MAP DESIGN SPREADSHEET ROWS
 * Maps exact columns from design.xlsx into standard MR11 schema.
 * Handles Formwork Design, Holing, and Accessories separate sub-disciplines.
 */
export function parseAndMapDesignRows(rawRows: any[]) {
  const mappedRecords: any[] = [];
  let currentProjectNo: string | null = null;
  let currentProjectName: string | null = null;

  for (const row of rawRows) {
    // Exact column keys as found in design.xlsx
    const explicitProjNo = cleanCell(row['Project No.'] || row['Project No'] || row['projectNo']);
    const explicitProjName = cleanCell(row['Project Name'] || row['projectName']);

    if (explicitProjNo) {
      currentProjectNo = explicitProjNo;
      if (explicitProjName) currentProjectName = explicitProjName;
    }

    if (!currentProjectNo && !explicitProjNo) continue;

    const buildingName = cleanCell(row['Building Name']);
    const subBuildingName = cleanCell(row['sub Building Name']);
    const stream = cleanCell(row['stream'] || row['Stream']);
    const dcf = cleanCell(row['DCF (dropdown)'] || row['DCF']);

    // Formwork Design
    const formworkDesignStatus = cleanCell(row['Formwork Design Status'] || row['design status']);
    const startDesignDate = cleanDate(row['start design date']);
    const estimatedCompletionDate = cleanDate(row['estimated design completion date (should be date or tbc) ']);
    const actualCompletionDate = cleanDate(row['Actual Formwork Order Completion Date']);
    // MR11 latest design date is actual order completion date, with estimated as fallback
    const latestDesignDate = actualCompletionDate || estimatedCompletionDate;

    // Holing
    const holingStatus = cleanCell(row['holing status (Completed/Not Completed/) -dropdown'] || row['holing status']);
    const holingStartDate = cleanDate(row['holing start date']);
    const holingCompletionDate = cleanDate(row['holing completion date'] || row['holing date']);

    // Accessories
    const accessoriesStatus = cleanCell(
      row['accessories status dropdown (to start, ongoing, completed, on hold)'] ||
      row['accessories status']
    );
    const accessoriesStartDate = cleanDate(row['accessories start date']);
    const accessoriesCompletionDate = cleanDate(row['accessories completion date'] || row['accessories date']);

    // Area & Remarks
    const quantityOrderedM2 = cleanNumber(row['Total Quantity Ordered m2']);
    const designRemarks = cleanCell(row['design remarks - free form']);

    mappedRecords.push({
      projectNo: currentProjectNo,
      projectName: currentProjectName,
      buildingName,
      subBuildingName,
      stream,
      dcf,
      designStatus: formworkDesignStatus,
      startDesignDate,
      latestDesignDate,
      holingStatus,
      holingStartDate,
      holingDate: holingCompletionDate,
      accessoriesStatus,
      accessoriesStartDate,
      accessoriesDate: accessoriesCompletionDate,
      quantityOrderedM2,
      designRemarks,
    });
  }

  return mappedRecords;
}

/**
 * 3. ROLL UP MULTI-BUILDING RECORDS TO MR11 SINGLE ROW PER PROJECT
 */
export function aggregateShellPlanForMR11(records: any[]) {
  const byProject = new Map<string, any[]>();
  for (const r of records) {
    if (!r.projectNo) continue;
    const existing = byProject.get(r.projectNo) || [];
    existing.push(r);
    byProject.set(r.projectNo, existing);
  }

  const rolledUp = new Map<string, any>();
  for (const [projectNo, items] of byProject.entries()) {
    // If any building is in progress / not approved, overall is in progress
    const statuses = items.map((i) => (i.shellPlanStatus || '').toLowerCase());
    let finalStatus = 'pending drawings';
    if (statuses.length > 0) {
      if (statuses.every((s) => s === 'approved' || s === 'completed')) {
        finalStatus = 'approved';
      } else if (statuses.some((s) => s.includes('progress') || s.includes('ongoing') || s === 'approved')) {
        finalStatus = 'in progress';
      } else {
        finalStatus = items[0].shellPlanStatus || 'pending drawings';
      }
    }

    // Pick latest non-empty revision and dates
    const latestRev = items.map((i) => i.latestRevision).filter(Boolean).pop() || null;
    const latestSubDate = items.map((i) => i.latestSubmissionDate).filter(Boolean).sort().pop() || null;
    const latestAppDate = items.map((i) => i.shellPlanApprovedDate).filter(Boolean).sort().pop() || null;
    const remarksCombined = items
      .map((i) => i.remarks)
      .filter(Boolean)
      .filter((v, idx, arr) => arr.indexOf(v) === idx)
      .join('; ');

    rolledUp.set(projectNo, {
      shellplan_status: finalStatus,
      latest_revision_version: latestRev,
      latest_revision_date: latestSubDate,
      shellplan_approval_date: latestAppDate,
      shellplan_remarks: remarksCombined || null,
      subBuildings: items,
    });
  }

  return rolledUp;
}

export function aggregateDesignForMR11(records: any[]) {
  const byProject = new Map<string, any[]>();
  for (const r of records) {
    if (!r.projectNo) continue;
    const existing = byProject.get(r.projectNo) || [];
    existing.push(r);
    byProject.set(r.projectNo, existing);
  }

  const rolledUp = new Map<string, any>();
  for (const [projectNo, items] of byProject.entries()) {
    const statuses = items.map((i) => (i.designStatus || '').toLowerCase());
    let finalDesignStatus = 'to start';
    if (statuses.length > 0) {
      if (statuses.every((s) => s === 'completed')) {
        finalDesignStatus = 'Completed';
      } else if (statuses.some((s) => s === 'ongoing' || s === 'completed')) {
        finalDesignStatus = 'ongoing';
      }
    }

    const holingStatuses = items.map((i) => (i.holingStatus || '').toLowerCase());
    const finalHolingStatus = holingStatuses.every((s) => s === 'completed') ? 'Completed' : 'Not Completed';

    const accStatuses = items.map((i) => (i.accessoriesStatus || '').toLowerCase());
    const finalAccStatus = accStatuses.every((s) => s === 'completed')
      ? 'completed'
      : accStatuses.some((s) => s === 'ongoing')
      ? 'ongoing'
      : 'to start';

    const latestDesignDate = items.map((i) => i.latestDesignDate).filter(Boolean).sort().pop() || null;
    const latestHolingDate = items.map((i) => i.holingDate).filter(Boolean).sort().pop() || null;
    const latestAccDate = items.map((i) => i.accessoriesDate).filter(Boolean).sort().pop() || null;
    const totalAreaM2 = items.reduce((sum, i) => sum + (i.quantityOrderedM2 || 0), 0);
    const stream = items.find((i) => i.stream)?.stream || null;

    rolledUp.set(projectNo, {
      stream,
      design_status: finalDesignStatus,
      latest_design_date: latestDesignDate,
      holing_status: finalHolingStatus,
      holing_date: latestHolingDate,
      accessories_status: finalAccStatus,
      accessories_date: latestAccDate,
      processed_qty: totalAreaM2 > 0 ? totalAreaM2 : null,
      subBuildings: items,
    });
  }

  return rolledUp;
}

/**
 * 4. STORE AN UPLOADED DEPARTMENT WORKBOOK AS THE ACTIVE VERSION
 * Parses the file, saves it as a new FileVersion, and regenerates the MR11 master.
 */
export async function processAtomicWorkbookUpload(
  prisma: PrismaClient,
  deptCode: RoleCode,
  filePathOrBuffer: string | Buffer,
  originalFilename: string,
  mimeType: string,
  fileSize: number,
  userId?: string,
  options: { persist?: boolean; regenerate?: boolean } = {}
) {
  const { persist = true, regenerate = true } = options;
  const parsedWorkbook = await parseAndNormalizeWorkbook(filePathOrBuffer);

  let dept = await prisma.department.findUnique({
    where: { code: deptCode },
  });

  if (!dept) {
    dept = await prisma.department.findFirst({
      where: { code: deptCode },
    });
  }

  if (!dept) {
    throw new Error(`Department with code ${deptCode} not found in database`);
  }

  // Validate userId to prevent foreign key errors
  let validUserId: string | null = null;
  if (userId) {
    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (existingUser) validUserId = existingUser.id;
  }
  if (!validUserId) {
    const adminUser = await prisma.user.findFirst({ where: { email: 'admin@mfeformwork.com' } });
    validUserId = adminUser ? adminUser.id : null;
  }

  const storageKey = Buffer.isBuffer(filePathOrBuffer)
    ? `buffer://${originalFilename}`
    : filePathOrBuffer;

  const newVersion = await prisma.fileVersion.create({
    data: {
      departmentId: dept.id,
      originalFilename,
      storageKey,
      fileSize,
      mimeType,
      status: 'READY' as any,
      parsedWorkbook: parsedWorkbook as any,
      uploadedById: validUserId,
      uploadedAt: new Date(),
      processedAt: new Date(),
    },
  });

  // Save to the shared database. A failure is reported to the uploader instead of being
  // logged quietly, because an unsaved upload is lost on the next restart.
  if (persist) {
    try {
      await saveFileVersionToDb({
        id: newVersion.id,
        deptCode,
        deptId: dept.id,
        deptName: dept.name,
        originalFilename,
        storageKey,
        fileSize,
        mimeType: mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        parsedWorkbook,
        uploadedById: validUserId,
      });
    } catch (dbErr: any) {
      console.error('[DEPARTMENT SERVICE] Could not save upload to the database:', dbErr?.message);
      throw new Error(`The workbook could not be saved to the database: ${dbErr?.message || dbErr}`);
    }
  }

  // Only switch this instance to the new version once it is safely stored
  await prisma.department.update({
    where: { id: dept.id },
    data: { activeVersionId: newVersion.id, activeSetAt: Date.now() },
  });

  try {
    await prisma.auditLog.create({
      data: {
        userId: validUserId,
        action: 'UPLOAD_WORKBOOK',
        entityType: 'DEPARTMENT',
        entityId: dept.id,
        metadata: { filename: originalFilename, deptCode },
      },
    });
  } catch (err) {
    console.warn('Audit log write skipped:', err);
  }

  if (regenerate) {
    try {
      // Other departments may have been uploaded on another server instance
      await hydrateActiveVersionsFromDb(prisma, [deptCode]);
      await executeMr11Pipeline(prisma);
    } catch (pipelineErr: any) {
      console.error('Auto MR11 pipeline calculation error:', pipelineErr);
    }
  }

  return newVersion;
}

export default {
  processAtomicWorkbookUpload,
  parseAndMapShellPlanRows,
  parseAndMapDesignRows,
  aggregateShellPlanForMR11,
  aggregateDesignForMR11,
};