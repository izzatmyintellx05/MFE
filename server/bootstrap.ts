import fs from 'fs';
import path from 'path';
import { prisma, RoleCode } from './db/prisma';
import { processAtomicWorkbookUpload } from './modules/departments/department.service';
import { executeMr11Pipeline } from './modules/mr11/mr11.engine';
import { hydrateActiveVersionsFromDb, fetchLatestMr11RunFromDb } from './db/supabase';

const deptKeywords: Record<RoleCode, string> = {
  [RoleCode.BD]: 'bd.xlsx',
  [RoleCode.FINANCE]: 'finance.xlsx',
  [RoleCode.SHELLPLAN]: 'shellplan.xlsx',
  [RoleCode.DESIGN]: 'design.xlsx',
  [RoleCode.PLANNING]: 'planning.xlsx',
  [RoleCode.PRODUCTION]: 'production.xlsx',
  [RoleCode.DISPATCH]: 'dispatch.xlsx',
  [RoleCode.ADMIN]: '',
  [RoleCode.CEO]: '',
};

export async function bootstrapSystem() {
  try {
    const admin = await prisma.user.findFirst({ where: { email: 'admin@mfeformwork.com' } });
    const adminId = admin?.id || 'user-admin-1';

    // 1. Supabase holds the workbooks users actually uploaded; load those first
    const dbCodes = await hydrateActiveVersionsFromDb(prisma);
    if (dbCodes) {
      console.log(`[MFE Formwork MR11] Loaded active workbooks from Supabase: ${[...dbCodes].join(', ') || 'none'}`);
    }

    // 2. Bundled sample workbooks only fill departments Supabase has nothing for.
    //    They stay in this instance's memory and are never written back to Supabase.
    const uploadsStorageDir = path.resolve(process.cwd(), 'uploads_storage');
    const uploadsDir = path.resolve(process.cwd(), 'uploads');

    const searchDirs = [uploadsStorageDir, uploadsDir].filter((d) => fs.existsSync(d));

    console.log('[MFE Formwork MR11] Checking department workbooks initialization...');

    for (const [codeStr, keyword] of Object.entries(deptKeywords)) {
      const code = codeStr as RoleCode;
      if (!keyword || dbCodes?.has(code)) continue;

      let targetPath: string | null = null;
      let targetFilename: string | null = null;

      for (const dir of searchDirs) {
        try {
          const files = fs.readdirSync(dir);
          const matching = files
            .filter((f) => f.toLowerCase().endsWith(keyword))
            .sort((a, b) => b.localeCompare(a));

          if (matching.length > 0) {
            targetFilename = matching[0];
            targetPath = path.join(dir, targetFilename);
            break;
          }
        } catch {}
      }

      if (targetPath && targetFilename && fs.existsSync(targetPath)) {
        try {
          const stat = fs.statSync(targetPath);
          await processAtomicWorkbookUpload(
            prisma as any,
            code,
            targetPath,
            targetFilename,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            stat.size,
            adminId,
            { persist: false, regenerate: false }
          );
          console.log(`[MFE Formwork MR11] Loaded active workbook for ${code} from ${targetFilename}`);
        } catch (e: any) {
          console.warn(`[MFE Formwork MR11] Note: Could not auto-load workbook for ${code}:`, e.message);
        }
      }
    }

    // 3. Reuse the shared MR11 from Supabase; otherwise build one for this instance only
    const dbRun = await fetchLatestMr11RunFromDb();
    if (dbRun && Array.isArray(dbRun.records) && dbRun.records.length > 0) {
      await prisma.mr11Run.create({ data: dbRun });
      console.log('[MFE Formwork MR11] Loaded latest MR11 Master from Supabase');
    } else {
      try {
        await executeMr11Pipeline(prisma as any, { persist: false });
        console.log('[MFE Formwork MR11] Initial MR11 Master generation complete');
      } catch (e: any) {
        console.warn('[MFE Formwork MR11] Initial MR11 pipeline notice:', e.message);
      }
    }
  } catch (err: any) {
    console.error('[MFE Formwork MR11] Bootstrap notice:', err.message);
  }
}
