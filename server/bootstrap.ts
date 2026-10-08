import fs from 'fs';
import path from 'path';
import { prisma, RoleCode } from './db/prisma';
import { processAtomicWorkbookUpload } from './modules/departments/department.service';
import { executeMr11Pipeline } from './modules/mr11/mr11.engine';
import {
  hydrateActiveVersionsFromDb,
  hydrateUsersFromDb,
  fetchLatestMr11RunFromDb,
  restoreEngineHistory,
  isDatabaseConfigured,
} from './db/supabase';

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

let bootstrapping: Promise<void> | null = null;

/**
 * Loads this instance's data once. Requests wait for it (server/app.ts), so a fresh instance
 * never answers from empty memory or with workbooks older than the database's. When the
 * database could not be reached, the next request tries again.
 */
export function ensureBootstrapped(): Promise<void> {
  if (!bootstrapping) {
    bootstrapping = bootstrapSystem().then((complete) => {
      if (!complete) bootstrapping = null;
    });
  }
  return bootstrapping;
}

/** Returns false when a database is configured but its workbooks could not be loaded. */
export async function bootstrapSystem(): Promise<boolean> {
  try {
    // 0. Users and their roles live in the database; the built-in accounts are only a fallback
    if (await hydrateUsersFromDb()) {
      console.log('[MFE Formwork MR11] Loaded users from database');
    }

    const admin = await prisma.user.findFirst({ where: { email: 'admin@mfeformwork.com' } });
    const adminId = admin?.id || 'user-admin-1';

    // 1. Supabase holds the workbooks users actually uploaded; load those first
    const dbCodes = await hydrateActiveVersionsFromDb(prisma);
    if (dbCodes) {
      console.log(`[MFE Formwork MR11] Loaded active workbooks from database: ${[...dbCodes].join(', ') || 'none'}`);
    }

    // 2. Bundled sample workbooks are only for running without a database. With a database
    //    connected, a department with nothing uploaded stays empty instead of showing old samples.
    const uploadsStorageDir = path.resolve(process.cwd(), 'uploads_storage');
    const uploadsDir = path.resolve(process.cwd(), 'uploads');

    const searchDirs = isDatabaseConfigured()
      ? []
      : [uploadsStorageDir, uploadsDir].filter((d) => fs.existsSync(d));

    console.log(
      isDatabaseConfigured()
        ? '[MFE Formwork MR11] Database connected: sample workbooks are not loaded'
        : '[MFE Formwork MR11] No database: loading sample workbooks...'
    );

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

    // Dispatch's Local and Overseas sample files (dispatchlocal.xlsx, dispatchoversea(s).xlsx)
    if (!dbCodes?.has(RoleCode.DISPATCH)) {
      for (const [part, pattern] of [['LOCAL', /dispatch.*local.*\.xlsx$/i], ['OVERSEAS', /dispatch.*oversea.*\.xlsx$/i]] as const) {
        for (const dir of searchDirs) {
          const name = fs.readdirSync(dir).filter((f) => pattern.test(f)).sort((a, b) => b.localeCompare(a))[0];
          if (!name) continue;
          const filePath = path.join(dir, name);
          try {
            await processAtomicWorkbookUpload(
              prisma as any,
              RoleCode.DISPATCH,
              filePath,
              name,
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              fs.statSync(filePath).size,
              adminId,
              { persist: false, regenerate: false, dispatchPart: part }
            );
            console.log(`[MFE Formwork MR11] Loaded Dispatch ${part.toLowerCase()} workbook from ${name}`);
          } catch (e: any) {
            console.warn(`[MFE Formwork MR11] Note: Could not load Dispatch ${part.toLowerCase()} workbook:`, e.message);
          }
          break;
        }
      }
    }

    // 3. Reuse the shared MR11 from Supabase; otherwise build one for this instance only
    const dbRun = await fetchLatestMr11RunFromDb();
    if (dbRun && Array.isArray(dbRun.records) && dbRun.records.length > 0) {
      await prisma.mr11Run.create({ data: dbRun });
      restoreEngineHistory(dbRun);
      console.log('[MFE Formwork MR11] Loaded latest MR11 Master from database');
    } else {
      try {
        await executeMr11Pipeline(prisma as any, { persist: false });
        console.log('[MFE Formwork MR11] Initial MR11 Master generation complete');
      } catch (e: any) {
        console.warn('[MFE Formwork MR11] Initial MR11 pipeline notice:', e.message);
      }
    }
    return !isDatabaseConfigured() || dbCodes !== null;
  } catch (err: any) {
    console.error('[MFE Formwork MR11] Bootstrap notice:', err.message);
    return !isDatabaseConfigured();
  }
}
