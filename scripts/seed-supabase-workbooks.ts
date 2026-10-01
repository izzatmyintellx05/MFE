import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { parseAndNormalizeWorkbook } from '../server/utils/excel-normalizer';
import { getDatabaseUrl } from '../server/config/database.config';
import { normalizeDatabaseUrl } from '../server/db/prisma';

const deptKeywords: Record<string, string> = {
  BD: 'bd.xlsx',
  FINANCE: 'finance.xlsx',
  SHELLPLAN: 'shellplan.xlsx',
  DESIGN: 'design.xlsx',
  PLANNING: 'planning.xlsx',
  PRODUCTION: 'production.xlsx',
  DISPATCH: 'dispatch.xlsx',
};

async function main() {
  const rawUrl = getDatabaseUrl();
  const dbUrl = normalizeDatabaseUrl(rawUrl) || rawUrl;
  console.log('[SEED] Connecting to Supabase PostgreSQL database...');

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  const allFiles = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];

  for (const [code, keyword] of Object.entries(deptKeywords)) {
    const matching = allFiles
      .filter((f) => f.toLowerCase().endsWith(keyword))
      .sort((a, b) => b.localeCompare(a));

    if (matching.length === 0) {
      console.warn(`[SEED] No matching file found for ${code} (*${keyword})`);
      continue;
    }

    const filename = matching[0];
    const targetPath = path.join(uploadsDir, filename);

    console.log(`[SEED] Parsing Excel workbook for ${code} from ${filename}...`);
    const parsedWorkbook = await parseAndNormalizeWorkbook(targetPath);
    const stat = fs.statSync(targetPath);

    // 1. Ensure department exists in Supabase
    const deptRes = await pool.query(
      `INSERT INTO "Department" ("id", "code", "name", "description", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name"
       RETURNING id;`,
      [`dept-${code.toLowerCase()}`, code, `${code} Department`, `${code} Department Workbook`]
    );
    const deptId = deptRes.rows[0].id;

    // 2. Insert FileVersion into Supabase (populating both storageKey & storagePath, and parsedWorkbook & rawDataJson)
    const fvId = `fv-${code.toLowerCase()}-seed`;
    const jsonStr = JSON.stringify(parsedWorkbook);

    await pool.query(
      `INSERT INTO "FileVersion" (
        "id", "departmentId", "originalFilename", "storageKey", "storagePath",
        "fileSize", "mimeType", "status", "isLatest", "parsedWorkbook", "rawDataJson",
        "uploadedById", "uploadedAt", "processedAt", "createdAt"
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'READY', true, $7, $7, 'user-admin-1', NOW(), NOW(), NOW())
       ON CONFLICT ("id") DO UPDATE SET 
         "parsedWorkbook" = EXCLUDED."parsedWorkbook",
         "rawDataJson" = EXCLUDED."rawDataJson",
         "status" = 'READY',
         "isLatest" = true;`,
      [fvId, deptId, filename, `storage://${filename}`, `storage://${filename}`, stat.size, jsonStr]
    );

    // 3. Set activeVersionId on Department
    await pool.query(
      `UPDATE "Department" SET "activeVersionId" = $1, "updatedAt" = NOW() WHERE id = $2;`,
      [fvId, deptId]
    );

    console.log(`[SEED] ✅ Successfully seeded ${code} into Supabase (${parsedWorkbook.length} sheets, ${stat.size} bytes)!`);
  }

  // Check counts in Supabase
  const fvCount = await pool.query('SELECT count(*) FROM "FileVersion";');
  const deptCount = await pool.query('SELECT count(*) FROM "Department" WHERE "activeVersionId" IS NOT NULL;');
  console.log(`[SEED] Total FileVersions in Supabase: ${fvCount.rows[0].count}`);
  console.log(`[SEED] Departments with active version in Supabase: ${deptCount.rows[0].count}`);

  await pool.end();
  console.log('[SEED] All department workbooks have been seeded permanently to Supabase!');
}

main().catch((err) => {
  console.error('[SEED ERROR]', err);
  process.exit(1);
});
