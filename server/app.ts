import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import * as authModule from './modules/auth/auth.routes';
import * as departmentModule from './modules/departments/department.routes';
import * as mr11Module from './modules/mr11/mr11.routes';
import * as adminModule from './modules/admin/admin.routes';
import * as visualizationModule from './modules/visualization/visualization.routes';
import { ensureBootstrapped } from './bootstrap';

export const app = express();

// Core Middlewares
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Healthcheck
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'MFE Formwork MR11 System' });
});

// Everything else waits until this instance has loaded uploads, users and MR11 from the database
app.use((req, res, next) => {
  ensureBootstrapped().then(() => next(), next);
});

app.get('/api/health/db', async (req, res) => {
  try {
    const { getDatabaseUrl, getSslConfig } = await import('./config/database.config');
    const { normalizeDatabaseUrl } = await import('./db/prisma');
    const { Pool } = await import('pg');

    const rawUrl = getDatabaseUrl();
    if (!rawUrl) {
      return res.json({ status: 'NOT_CONFIGURED', message: 'DATABASE_URL is not set; running in memory only.' });
    }
    const cleanUrl = normalizeDatabaseUrl(rawUrl) || rawUrl;
    
    // Mask password in response
    const maskedUrl = cleanUrl.replace(/:([^@:]+)@/, ':****@');

    const pool = new Pool({
      connectionString: cleanUrl,
      ssl: getSslConfig(cleanUrl),
      connectionTimeoutMillis: 5000,
    });

    const result = await pool.query('SELECT NOW() as server_time, version() as version;');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    await pool.end();

    const { describeDatabase } = await import('./db/supabase');
    const contents = await describeDatabase();

    return res.json({
      status: 'CONNECTED',
      message: 'Successfully connected to the PostgreSQL database.',
      endpoint: maskedUrl,
      serverTime: result.rows[0]?.server_time,
      version: result.rows[0]?.version?.split(' ')?.[0],
      tables: tablesResult.rows.map((r: any) => r.table_name),
      ...contents,
    });
  } catch (err: any) {
    return res.status(200).json({
      status: 'ERROR',
      message: err.message,
    });
  }
});

// Helper to reliably extract the router from whatever export format was used
function resolveRouter(mod: any, name: string): express.Router {
  const router = mod?.default || mod?.[name] || mod?.router || mod;
  if (!router || typeof router !== 'function' && typeof router?.use !== 'function') {
    console.error(`[ROUTER ERROR] Module "${name}" failed to export a valid Express router! Available exports:`, Object.keys(mod || {}));
    const fallback = express.Router();
    fallback.all('*', (req, res) => {
      res.status(500).json({ error: `Router for ${name} is misconfigured.` });
    });
    return fallback;
  }
  return router;
}

const authR = resolveRouter(authModule, 'authRouter');
const deptR = resolveRouter(departmentModule, 'departmentRouter');
const mr11R = resolveRouter(mr11Module, 'mr11Router');
const adminR = resolveRouter(adminModule, 'adminRouter');
const visualizationR = resolveRouter(visualizationModule, 'visualizationRouter');

// Safe mounting
app.use('/api/auth', authR);
app.use('/api/departments', deptR);
app.use('/api/mr11', mr11R);
app.use('/api/admin', adminR);
app.use('/api/visualization', visualizationR);

// Serve the built frontend (copied to ./public next to dist/ at deploy time)
const webDir = path.resolve(process.env.WEB_DIR || path.join(__dirname, '../../public'));
if (fs.existsSync(path.join(webDir, 'index.html'))) {
  app.use(express.static(webDir));
  // Client-side routes (e.g. /mr11, /admin) fall back to index.html
  app.get(/^\/(?!api(\/|$)|health$).*/, (req, res) => {
    res.sendFile(path.join(webDir, 'index.html'));
  });
}

export default app;