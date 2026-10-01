/**
 * Supabase PostgreSQL is the shared source of truth. Each server instance keeps an
 * in-memory copy (server/db/prisma.ts), so before reading or regenerating MR11 an
 * instance refreshes its copy from here instead of trusting its own memory.
 */
import { getDatabaseUrl, getSslConfig } from '../config/database.config';
import { normalizeDatabaseUrl } from './prisma';

async function withPool<T>(fn: (pool: any) => Promise<T>): Promise<T | null> {
  const rawUrl = getDatabaseUrl();
  if (!rawUrl) return null;

  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: normalizeDatabaseUrl(rawUrl) || rawUrl,
    ssl: getSslConfig(rawUrl),
    connectionTimeoutMillis: 5000,
  });
  try {
    return await fn(pool);
  } catch (err: any) {
    console.warn('[SUPABASE] read notice:', err?.message || err);
    return null;
  } finally {
    await pool.end().catch(() => {});
  }
}

/** Active workbook version per department code, or null when the database is unreachable. */
export async function fetchActiveVersionsFromDb(): Promise<Record<string, any> | null> {
  return withPool(async (pool) => {
    const result = await pool.query(
      `SELECT d.code, f.id, f."originalFilename", f."storageKey", f."fileSize", f."mimeType",
              f."parsedWorkbook", f."uploadedById", f."uploadedAt", f."processedAt"
         FROM "Department" d
         JOIN "FileVersion" f ON f.id = d."activeVersionId";`
    );
    const byCode: Record<string, any> = {};
    for (const row of result.rows) {
      if (row.parsedWorkbook) byCode[row.code] = row;
    }
    return byCode;
  });
}

/** Latest MR11 run, or null when there is none or the database is unreachable. */
export async function fetchLatestMr11RunFromDb(): Promise<any | null> {
  return withPool(async (pool) => {
    const result = await pool.query(
      'SELECT id, "generatedAt", status, "sourceSnapshot", "recordCount", "calculatedFields" FROM "Mr11Run" ORDER BY "generatedAt" DESC LIMIT 1;'
    );
    const r = result.rows[0];
    if (!r) return null;
    return {
      id: r.id,
      generatedAt: r.generatedAt,
      status: r.status,
      sourceSnapshot: r.sourceSnapshot,
      recordCount: r.recordCount,
      records: r.calculatedFields || [],
    };
  });
}

/**
 * Point this instance's departments at the active versions stored in Supabase.
 * Returns the department codes that the database has a version for, or null when
 * the database is unreachable. Codes in `skipCodes` are left untouched.
 */
export async function hydrateActiveVersionsFromDb(prisma: any, skipCodes: string[] = []): Promise<Set<string> | null> {
  const dbVersions = await fetchActiveVersionsFromDb();
  if (!dbVersions) return null;

  for (const [code, v] of Object.entries(dbVersions)) {
    if (skipCodes.includes(code)) continue;
    const dept = await prisma.department.findFirst({ where: { code } });
    if (!dept || dept.activeVersionId === v.id) continue;

    const existing = await prisma.fileVersion.findUnique({ where: { id: v.id } });
    if (!existing) {
      await prisma.fileVersion.create({
        data: {
          id: v.id,
          departmentId: dept.id,
          originalFilename: v.originalFilename,
          storageKey: v.storageKey,
          fileSize: v.fileSize,
          mimeType: v.mimeType,
          status: 'READY',
          parsedWorkbook: v.parsedWorkbook,
          uploadedById: v.uploadedById,
          uploadedAt: v.uploadedAt,
          processedAt: v.processedAt,
        },
      });
    }
    await prisma.department.update({ where: { id: dept.id }, data: { activeVersionId: v.id } });
  }

  return new Set(Object.keys(dbVersions));
}

/** Latest MR11 run: Supabase first (shared by all instances), then this instance's memory. */
export async function getLatestMr11Run(prisma: any): Promise<any | null> {
  const dbRun = await fetchLatestMr11RunFromDb();
  if (dbRun && Array.isArray(dbRun.records) && dbRun.records.length > 0) return dbRun;
  return prisma.mr11Run.findFirst({ orderBy: { generatedAt: 'desc' } });
}
