/**
 * Supabase PostgreSQL is the shared source of truth. Each server instance keeps an
 * in-memory copy (server/db/prisma.ts), so before reading or regenerating MR11 an
 * instance refreshes its copy from here instead of trusting its own memory.
 *
 * The repository has had two table layouts (prisma/migrations and supabase/schema.sql),
 * so reads use SELECT * and writes only fill the columns the live table actually has.
 */
import { getDatabaseUrl, getSslConfig } from '../config/database.config';
import { normalizeDatabaseUrl, replaceUsers, importEngineHistory } from './prisma';

const NOW = Symbol('now');

export function isDatabaseConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}

async function openPool(): Promise<any | null> {
  const rawUrl = getDatabaseUrl();
  if (!rawUrl) return null;
  const { Pool } = await import('pg');
  return new Pool({
    connectionString: normalizeDatabaseUrl(rawUrl) || rawUrl,
    ssl: getSslConfig(rawUrl),
    connectionTimeoutMillis: 5000,
  });
}

/** Runs fn against the database; returns null when it is not configured or the read fails. */
async function withPool<T>(fn: (pool: any) => Promise<T>): Promise<T | null> {
  const pool = await openPool();
  if (!pool) return null;
  try {
    return await fn(pool);
  } catch (err: any) {
    console.warn('[DATABASE] read notice:', err?.message || err);
    return null;
  } finally {
    await pool.end().catch(() => {});
  }
}

const columnCache: Record<string, Set<string>> = {};

async function tableColumns(pool: any, table: string): Promise<Set<string>> {
  if (columnCache[table]) return columnCache[table];
  const result = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1;`,
    [table]
  );
  const cols = new Set<string>(result.rows.map((r: any) => r.column_name));
  if (cols.size > 0) columnCache[table] = cols;
  return cols;
}

/** INSERT ... ON CONFLICT ("id") DO UPDATE, using only the columns the table has. */
async function upsertRow(pool: any, table: string, values: Record<string, any>, updateCols: string[]): Promise<void> {
  const cols = await tableColumns(pool, table);
  if (cols.size === 0) throw new Error(`Table "${table}" was not found in the database`);

  const names: string[] = [];
  const placeholders: string[] = [];
  const params: any[] = [];
  for (const [name, value] of Object.entries(values)) {
    if (!cols.has(name) || value === undefined) continue;
    names.push(`"${name}"`);
    if (value === NOW) {
      placeholders.push('NOW()');
    } else {
      params.push(value);
      placeholders.push(`$${params.length}`);
    }
  }
  const updates = updateCols.filter((c) => cols.has(c)).map((c) => `"${c}" = EXCLUDED."${c}"`);
  const conflict = updates.length ? `ON CONFLICT ("id") DO UPDATE SET ${updates.join(', ')}` : 'ON CONFLICT ("id") DO NOTHING';
  await pool.query(`INSERT INTO "${table}" (${names.join(', ')}) VALUES (${placeholders.join(', ')}) ${conflict};`, params);
}

/** Workbook data of a FileVersion row in either table layout. */
function workbookOf(row: any): any {
  return row?.parsedWorkbook ?? row?.rawDataJson ?? null;
}

/** JSON columns come back parsed (jsonb) or as text, depending on the table layout. */
function parseJson(value: any): any {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** Runs fn inside one transaction; throws (after rolling back) when the database rejects it. */
async function inTransaction(fn: (client: any) => Promise<void>): Promise<boolean> {
  const pool = await openPool();
  if (!pool) return false;
  let client: any = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await fn(client);
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client?.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client?.release();
    await pool.end().catch(() => {});
  }
}

/** Active workbook version per department code, or null when the database is unreachable. */
export async function fetchActiveVersionsFromDb(): Promise<Record<string, any> | null> {
  return withPool(async (pool) => {
    const result = await pool.query(
      `SELECT d.code AS "deptCode", f.*
         FROM "Department" d
         JOIN "FileVersion" f ON f.id = d."activeVersionId";`
    );
    const byCode: Record<string, any> = {};
    for (const row of result.rows) {
      const parsedWorkbook = workbookOf(row);
      if (parsedWorkbook) byCode[row.deptCode] = { ...row, parsedWorkbook };
    }
    return byCode;
  });
}

/** One department's active version (department page), or null. */
export async function fetchActiveVersionForDepartment(code: string): Promise<any | null> {
  const all = await fetchActiveVersionsFromDb();
  return all?.[code] ?? null;
}

/** Latest MR11 run, or null when there is none or the database is unreachable. */
export async function fetchLatestMr11RunFromDb(): Promise<any | null> {
  return withPool(async (pool) => {
    const result = await pool.query('SELECT * FROM "Mr11Run" ORDER BY "generatedAt" DESC LIMIT 1;');
    const r = result.rows[0];
    if (!r) return null;
    return {
      id: r.id,
      generatedAt: r.generatedAt,
      status: r.status,
      sourceSnapshot: parseJson(r.sourceSnapshot),
      recordCount: r.recordCount,
      records: parseJson(r.calculatedFields ?? r.records) ?? [],
    };
  });
}

/** Active file per department code, without the workbook data (for the department list). */
export async function fetchActiveFileSummariesFromDb(): Promise<Record<string, any> | null> {
  return withPool(async (pool) => {
    const result = await pool.query(
      `SELECT d.code, f.id, f."originalFilename", f."uploadedAt"
         FROM "Department" d
         JOIN "FileVersion" f ON f.id = d."activeVersionId";`
    );
    const byCode: Record<string, any> = {};
    for (const r of result.rows) {
      byCode[r.code] = { id: r.id, originalFilename: r.originalFilename, status: 'READY', uploadedAt: r.uploadedAt };
    }
    return byCode;
  });
}

/**
 * Makes this instance's users and role links match the database, which every instance writes
 * to. Returns false, keeping the built-in accounts, when there is no database, it cannot be
 * reached, or it has no users yet.
 */
export async function hydrateUsersFromDb(): Promise<boolean> {
  const rows = await withPool(async (pool) => ({
    // Stable order: the seeded accounts share one createdAt, and edited rows move in the table
    users: (await pool.query('SELECT * FROM "User" ORDER BY "createdAt", email;')).rows,
    userRoles: (await pool.query('SELECT * FROM "UserRole";')).rows,
  }));
  if (!rows || rows.users.length === 0) return false;
  replaceUsers(rows.users, rows.userRoles);
  return true;
}

/** Saves a user and replaces their role links. Throws when the database rejects it. */
export async function saveUserToDb(user: any, roleIds: string[]): Promise<boolean> {
  return inTransaction(async (client) => {
    await upsertRow(
      client,
      'User',
      {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        passwordHash: user.passwordHash,
        status: user.status || 'ACTIVE',
        isActive: user.isActive ?? true,
        createdAt: user.createdAt ?? NOW,
        updatedAt: NOW,
      },
      ['email', 'fullName', 'passwordHash', 'status', 'isActive', 'updatedAt']
    );
    await client.query('DELETE FROM "UserRole" WHERE "userId" = $1;', [user.id]);
    for (const roleId of roleIds) {
      await upsertRow(client, 'UserRole', { id: `ur-${user.id}-${roleId}`, userId: user.id, roleId, createdAt: NOW }, []);
    }
  });
}

/** Deletes a user and their role links. Throws when the database rejects it. */
export async function deleteUserFromDb(userId: string): Promise<boolean> {
  return inTransaction(async (client) => {
    await client.query('DELETE FROM "UserRole" WHERE "userId" = $1;', [userId]);
    await client.query('DELETE FROM "User" WHERE id = $1;', [userId]);
  });
}

/** Restores the MR11 engine history saved with a run; runs saved before it was stored have none. */
export function restoreEngineHistory(run: any): boolean {
  const history = run?.sourceSnapshot?.engineHistory;
  if (!history) return false;
  importEngineHistory(history);
  return true;
}

/**
 * Saves an uploaded workbook and makes it the department's active version.
 * Throws when the database rejects it, so the upload reports the problem instead of
 * pretending to succeed. Returns false when no database is configured.
 */
export async function saveFileVersionToDb(v: {
  id: string;
  deptCode: string;
  deptId: string;
  deptName: string;
  originalFilename: string;
  storageKey: string;
  fileSize: number;
  mimeType: string;
  parsedWorkbook: any;
  uploadedById: string | null;
}): Promise<boolean> {
  const pool = await openPool();
  if (!pool) return false;
  try {
    // The department row in the database may use a different id than this instance
    const found = await pool.query('SELECT id FROM "Department" WHERE code = $1 LIMIT 1;', [v.deptCode]);
    let departmentId: string = found.rows[0]?.id;
    if (!departmentId) {
      departmentId = v.deptId;
      await upsertRow(pool, 'Department', { id: departmentId, code: v.deptCode, name: v.deptName, createdAt: NOW, updatedAt: NOW }, []);
    }

    // Some layouts link uploadedById to "User"; when this user is not in the database's
    // User table and the column allows it, leave it empty instead of failing the upload
    let uploadedById: string | null = v.uploadedById ?? 'user-admin-1';
    const nullable = await pool.query(
      `SELECT is_nullable FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'FileVersion' AND column_name = 'uploadedById';`
    );
    if (nullable.rows[0]?.is_nullable === 'YES') {
      const user = await pool.query('SELECT 1 FROM "User" WHERE id = $1 LIMIT 1;', [uploadedById]).catch(() => ({ rows: [] }));
      if (user.rows.length === 0) uploadedById = null;
    }

    const json = JSON.stringify(v.parsedWorkbook);
    await upsertRow(
      pool,
      'FileVersion',
      {
        id: v.id,
        departmentId,
        originalFilename: v.originalFilename,
        storageKey: v.storageKey,
        storagePath: v.storageKey,
        fileSize: v.fileSize || 0,
        mimeType: v.mimeType,
        status: 'READY',
        isLatest: true,
        parsedWorkbook: json,
        rawDataJson: json,
        uploadedById,
        uploadedAt: NOW,
        processedAt: NOW,
        createdAt: NOW,
      },
      ['parsedWorkbook', 'rawDataJson', 'status']
    );

    const fvCols = await tableColumns(pool, 'FileVersion');
    if (fvCols.has('isLatest')) {
      await pool.query('UPDATE "FileVersion" SET "isLatest" = false WHERE "departmentId" = $1 AND id <> $2;', [departmentId, v.id]);
    }

    const deptCols = await tableColumns(pool, 'Department');
    const touch = deptCols.has('updatedAt') ? ', "updatedAt" = NOW()' : '';
    await pool.query(`UPDATE "Department" SET "activeVersionId" = $1${touch} WHERE id = $2;`, [v.id, departmentId]);
    return true;
  } finally {
    await pool.end().catch(() => {});
  }
}

/** Saves an MR11 run in either table layout ("calculatedFields" or "records"). */
export async function saveMr11RunToDb(run: { id: string; sourceSnapshot: any; records: any[] }): Promise<boolean> {
  const pool = await openPool();
  if (!pool) return false;
  try {
    // A newer upload landed while this run was being built: keep the database's newer MR11
    // instead of replacing it with one built from older workbooks
    const active = await pool.query('SELECT code, "activeVersionId" FROM "Department" WHERE "activeVersionId" IS NOT NULL;');
    const replaced = active.rows
      .filter((d: any) => run.sourceSnapshot?.[d.code] && run.sourceSnapshot[d.code] !== d.activeVersionId)
      .map((d: any) => d.code);
    if (replaced.length > 0) {
      console.warn(`[DATABASE] MR11 run ${run.id} not saved: newer workbooks were uploaded for ${replaced.join(', ')}`);
      return false;
    }

    const json = JSON.stringify(run.records);
    await upsertRow(
      pool,
      'Mr11Run',
      {
        id: run.id,
        generatedAt: NOW,
        status: 'READY',
        sourceSnapshot: JSON.stringify(run.sourceSnapshot ?? {}),
        recordCount: run.records.length,
        calculatedFields: json,
        records: json,
      },
      []
    );
    return true;
  } finally {
    await pool.end().catch(() => {});
  }
}

/** What the database holds, for the health check: columns, active files, row counts. */
export async function describeDatabase(): Promise<Record<string, any> | null> {
  return withPool(async (pool) => {
    const columns: Record<string, string[]> = {};
    for (const t of ['Department', 'FileVersion', 'Mr11Run']) columns[t] = [...(await tableColumns(pool, t))].sort();
    const active = await pool.query(
      `SELECT d.code, d."activeVersionId", f."originalFilename", f."uploadedAt"
         FROM "Department" d LEFT JOIN "FileVersion" f ON f.id = d."activeVersionId" ORDER BY d.code;`
    );
    const counts = await pool.query(
      `SELECT (SELECT count(*) FROM "FileVersion")::int AS "fileVersions", (SELECT count(*) FROM "Mr11Run")::int AS "mr11Runs";`
    );
    return {
      columns,
      activeFiles: active.rows.map((r: any) => ({
        department: r.code,
        file: r.originalFilename ?? (r.activeVersionId ? `missing version ${r.activeVersionId}` : null),
        uploadedAt: r.uploadedAt ?? null,
      })),
      ...counts.rows[0],
    };
  });
}

/**
 * Point this instance's departments at the active versions stored in the database.
 * Returns the department codes that the database has a version for, or null when
 * the database is unreachable. Codes in `skipCodes` are left untouched.
 */
export async function hydrateActiveVersionsFromDb(prisma: any, skipCodes: string[] = []): Promise<Set<string> | null> {
  const readStartedAt = Date.now();
  const dbVersions = await fetchActiveVersionsFromDb();
  if (!dbVersions) return null;

  for (const [code, v] of Object.entries(dbVersions)) {
    if (skipCodes.includes(code)) continue;
    const dept = await prisma.department.findFirst({ where: { code } });
    if (!dept || dept.activeVersionId === v.id) continue;
    // Switched after this read began (an upload here, or a later refresh): this read is older
    if (dept.activeSetAt && dept.activeSetAt > readStartedAt) continue;

    const existing = await prisma.fileVersion.findUnique({ where: { id: v.id } });
    if (!existing) {
      await prisma.fileVersion.create({
        data: {
          id: v.id,
          departmentId: dept.id,
          originalFilename: v.originalFilename,
          storageKey: v.storageKey ?? v.storagePath,
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
    await prisma.department.update({ where: { id: dept.id }, data: { activeVersionId: v.id, activeSetAt: Date.now() } });
  }

  return new Set(Object.keys(dbVersions));
}

/** Latest MR11 run: the database first (shared by all instances), then this instance's memory. */
export async function getLatestMr11Run(prisma: any): Promise<any | null> {
  const dbRun = await fetchLatestMr11RunFromDb();
  if (dbRun && Array.isArray(dbRun.records) && dbRun.records.length > 0) return dbRun;
  return prisma.mr11Run.findFirst({ orderBy: { generatedAt: 'desc' } });
}
