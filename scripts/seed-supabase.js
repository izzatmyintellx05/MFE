import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

const connStr = process.env.DATABASE_URL;
const pool = new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

const DEMO_USERS = [
  { id: 'user-ceo-1', email: 'ceo@mfeformwork.com', fullName: 'Executive Director', role: 'CEO' },
  { id: 'user-bd-1', email: 'bd@mfeformwork.com', fullName: 'BD Lead Officer', role: 'BD' },
  { id: 'user-finance-1', email: 'finance@mfeformwork.com', fullName: 'Commercial Finance Lead', role: 'FINANCE' },
  { id: 'user-shellplan-1', email: 'shellplan@mfeformwork.com', fullName: 'Shellplan Architect', role: 'SHELLPLAN' },
  { id: 'user-design-1', email: 'design@mfeformwork.com', fullName: 'Lead Design Engineer', role: 'DESIGN' },
  { id: 'user-planning-1', email: 'planning@mfeformwork.com', fullName: 'Planning & Series Lead', role: 'PLANNING' },
  { id: 'user-production-1', email: 'production@mfeformwork.com', fullName: 'Plant Operations Manager', role: 'PRODUCTION' },
  { id: 'user-dispatch-1', email: 'dispatch@mfeformwork.com', fullName: 'Dispatch & Logistics Lead', role: 'DISPATCH' },
];

async function seed() {
  for (const u of DEMO_USERS) {
    await pool.query(
      `INSERT INTO "User" ("id", "email", "fullName", "passwordHash", "status", "isActive")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("email") DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash";`,
      [u.id, u.email, u.fullName, 'admin123', 'ACTIVE', true]
    );

    const roleRes = await pool.query('SELECT id FROM "Role" WHERE code = $1;', [u.role]);
    if (roleRes.rows[0]) {
      const roleId = roleRes.rows[0].id;
      const urId = `ur-${u.id}-${roleId}`;
      await pool.query(
        `INSERT INTO "UserRole" ("id", "userId", "roleId")
         VALUES ($1, $2, $3)
         ON CONFLICT ("userId", "roleId") DO NOTHING;`,
        [urId, u.id, roleId]
      );
    }
  }
  console.log('✅ Demo users seeded successfully in Supabase!');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
