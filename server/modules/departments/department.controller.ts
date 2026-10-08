import { Request, Response } from 'express';
import { PrismaClient, RoleCode } from '@prisma/client';
import { processAtomicWorkbookUpload, parseDispatchPart } from './department.service';
import { fetchActiveVersionForDepartment, fetchActiveFileSummariesFromDb } from '../../db/supabase';
import fs from 'fs';

const prisma = new PrismaClient();

const DEPT_NAMES: Record<string, string> = {
  BD: 'Business Development',
  FINANCE: 'Finance',
  SHELLPLAN: 'Shellplan',
  DESIGN: 'Design',
  PLANNING: 'Planning',
  PRODUCTION: 'Production',
  DISPATCH: 'Dispatch',
};

// GET /api/departments/:code
// Shell Plan and Design share one workbook ("Shell Plan & Design"), kept under DESIGN;
// SHELLPLAN requests are served from it
function combinedDepartment(code: string): RoleCode {
  const upper = code.toUpperCase();
  return (upper === RoleCode.SHELLPLAN ? RoleCode.DESIGN : upper) as RoleCode;
}

export async function getActiveDepartmentWorkbook(req: Request, res: Response) {
  try {
    const rawParam = (req.params.code || req.params.id || req.params.deptCode || '').trim();
    const deptCode = combinedDepartment(rawParam);
    const validRoleCodes = Object.keys(DEPT_NAMES) as RoleCode[];

    let dept: any = null;

    // 1. The shared database holds the version users actually uploaded (any table layout)
    const dbVersion = validRoleCodes.includes(deptCode) ? await fetchActiveVersionForDepartment(deptCode) : null;
    if (dbVersion) {
      const memDept = await prisma.department.findFirst({ where: { code: deptCode } });
      dept = {
        id: memDept?.id ?? dbVersion.departmentId,
        code: deptCode,
        name: memDept?.name ?? DEPT_NAMES[deptCode],
        description: memDept?.description ?? null,
        activeVersionId: dbVersion.id,
        activeVersion: dbVersion,
      };
    }

    // 2. Fallback to Prisma in-memory client
    if (!dept || !dept.activeVersion) {
      const prismaDept = await prisma.department.findFirst({
        where: {
          OR: [
            validRoleCodes.includes(deptCode) ? { code: deptCode } : undefined,
            { id: rawParam },
          ].filter(Boolean) as any,
        },
        include: {
          activeVersion: {
            include: { uploadedBy: { select: { fullName: true, email: true } } },
          },
        },
      });

      if (prismaDept) {
        dept = prismaDept;
      }
    }

    if (!dept && validRoleCodes.includes(deptCode)) {
      dept = await prisma.department.upsert({
        where: { code: deptCode },
        update: {},
        create: {
          code: deptCode,
          name: DEPT_NAMES[deptCode] || deptCode,
          description: `${DEPT_NAMES[deptCode] || deptCode} Department Workbook`,
        },
        include: {
          activeVersion: {
            include: { uploadedBy: { select: { fullName: true, email: true } } },
          },
        },
      });
    }

    if (!dept) {
      return res.status(404).json({
        success: false,
        error: { code: 'DEPT_NOT_FOUND', message: `Department '${rawParam}' not found` },
      });
    }

    return res.json({ success: true, data: dept });
  } catch (err: any) {
    console.error('getActiveDepartmentWorkbook error:', err);
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
}

// POST /api/departments/:code/upload
export async function uploadDepartmentWorkbook(req: Request, res: Response) {
  const rawParam = (req.params.code || req.params.id || '').trim();
  const deptCode = combinedDepartment(rawParam);
  const user = (req as any).user;
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      success: false,
      error: { code: 'FILE_REQUIRED', message: 'No file uploaded' },
    });
  }

  // Shell Plan and Design users both upload the combined Shell Plan & Design workbook
  const allowedRoles: RoleCode[] = deptCode === RoleCode.DESIGN ? [RoleCode.DESIGN, RoleCode.SHELLPLAN] : [deptCode];
  if (user && !user.roles.includes(RoleCode.ADMIN) && !allowedRoles.some((r) => user.roles.includes(r))) {
    if (file.path && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch {}
    }
    return res.status(403).json({ success: false, error: { code: 'UNAUTHORIZED_DEPARTMENT_UPLOAD' } });
  }

  try {
    // Pass either in-memory buffer (serverless-friendly) or file.path
    const inputContent = file.buffer || file.path;

    // Dispatch: which of its two files this is (?part=local / overseas); guessed when not given
    const dispatchPart = parseDispatchPart(req.query.part ?? req.body?.part);

    await processAtomicWorkbookUpload(
      prisma,
      deptCode,
      inputContent,
      file.originalname,
      file.mimetype,
      file.size,
      user?.id,
      { dispatchPart }
    );

    // Clean up temporary disk file if one was written
    if (file.path && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch {}
    }

    return res.json({
      success: true,
      message: `${deptCode} workbook uploaded and set as active. Master MR11 regenerated.`,
    });
  } catch (err: any) {
    console.error('uploadDepartmentWorkbook error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'UPLOAD_FAILED', message: err.message },
    });
  }
}

// GET /api/departments/:code/download
export async function downloadOriginalFile(req: Request, res: Response) {
  try {
    const rawParam = (req.params.code || req.params.id || '').trim();
    const deptCode = combinedDepartment(rawParam);

    const dept = await prisma.department.findFirst({
      where: {
        OR: [{ code: deptCode }, { id: rawParam }],
      },
      include: { activeVersion: true },
    });

    if (!dept?.activeVersion?.storageKey || !fs.existsSync(dept.activeVersion.storageKey)) {
      return res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND' } });
    }

    res.setHeader(
      'Content-Type',
      dept.activeVersion.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.download(dept.activeVersion.storageKey, dept.activeVersion.originalFilename);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
}

// GET /api/departments
export async function listDepartments(req: Request, res: Response) {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { code: 'asc' },
      include: {
        activeVersion: {
          select: {
            id: true,
            originalFilename: true,
            status: true,
            uploadedAt: true,
          },
        },
      },
    });

    // Another instance may have taken a newer upload since this one loaded: the database knows
    const dbFiles = await fetchActiveFileSummariesFromDb();
    const data = departments.map((d: any) =>
      dbFiles?.[d.code] ? { ...d, activeVersionId: dbFiles[d.code].id, activeVersion: dbFiles[d.code] } : d
    );
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
}
