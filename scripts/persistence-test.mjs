// End-to-end persistence test. Runs the built server bundle (api/index.js, the same file Vercel
// runs) against a throwaway local PostgreSQL, uploads the department workbooks through the upload
// API, then restarts the server and runs two servers side by side to check that uploads, users and
// MR11 history survive and that no department falls back to an older workbook.
//
// Usage (after `npm run build`):
//   TEST_DATABASE_URL="postgres://postgres@127.0.0.1:5544/mfe_test?sslmode=disable" \
//     node scripts/persistence-test.mjs <folder containing bd.xlsx, finance.xlsx, ... dispatch.xlsx>
//
// The test database is wiped and recreated from supabase/schema.sql, so only local URLs are accepted.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
const { Client } = require('pg');

const dbUrl = process.env.TEST_DATABASE_URL || '';
const workbookDir = process.argv[2];
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(dbUrl) || !workbookDir) {
  console.error('Usage: TEST_DATABASE_URL=<local postgres url> node scripts/persistence-test.mjs <workbook folder>');
  console.error('The database is wiped first, so only localhost / 127.0.0.1 URLs are accepted.');
  process.exit(2);
}

const DEPTS = ['BD', 'FINANCE', 'SHELLPLAN', 'DESIGN', 'PLANNING', 'PRODUCTION', 'DISPATCH'];
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ADMIN = { email: 'admin@mfeformwork.com', password: 'admin123' };
const bundleUrl = pathToFileURL(path.join(root, 'api', 'index.js')).href;

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

async function resetDb() {
  const c = new Client({ connectionString: dbUrl });
  await c.connect();
  await c.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await c.query(fs.readFileSync(path.join(root, 'supabase', 'schema.sql'), 'utf8'));
  await c.end();
}

// Each server is its own process, like a separate Vercel instance: nothing shared but the database
const RUNNER = `
const [port, bundle] = process.argv.slice(1);
const handler = (await import(bundle)).default;
const http = await import('node:http');
http.createServer((req, res) => handler(req, res)).listen(Number(port), '127.0.0.1');
`;

async function startServer(port) {
  const env = { ...process.env, DATABASE_URL: dbUrl, JWT_SECRET: 'persistence-test', NODE_ENV: 'production' };
  for (const k of Object.keys(env)) if (/^(DATABASE_POSTGRES_|POSTGRES_)/.test(k)) delete env[k];
  const proc = spawn(process.execPath, ['--input-type=module', '-e', RUNNER, String(port), bundleUrl], { cwd: root, env });
  const logs = [];
  proc.stdout.on('data', (d) => logs.push(String(d)));
  proc.stderr.on('data', (d) => logs.push(String(d)));
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${base}/health`)).ok) return { proc, logs, base };
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server on port ${port} did not start:\n${logs.join('')}`);
}

async function stopServer(s) {
  if (s.proc.exitCode !== null) return;
  const exited = new Promise((r) => s.proc.once('exit', r));
  s.proc.kill();
  await exited;
}

async function api(s, method, p, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(s.base + p, { method, headers, body: payload });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

async function login(s, email, password) {
  const r = await api(s, 'POST', '/api/auth/login', { body: { email, password } });
  return r.status === 200 ? r.json.token : null;
}

async function upload(s, token, code, file, asName) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)], { type: XLSX }), asName || path.basename(file));
  return api(s, 'POST', `/api/departments/${code}/upload`, { token, form });
}

async function activeFiles(s) {
  const r = await api(s, 'GET', '/api/departments');
  return Object.fromEntries((r.json.data || []).map((d) => [d.code, d.activeVersion?.originalFilename ?? null]));
}

async function snapshot(s, token) {
  const run = (await api(s, 'GET', '/api/mr11')).json.data?.run;
  const users = (await api(s, 'GET', '/api/admin/users', { token })).json.data || [];
  return {
    active: await activeFiles(s),
    runId: run?.id,
    records: run?.records || [],
    sourceSnapshot: run?.sourceSnapshot || {},
    planning: (await api(s, 'GET', '/api/mr11/planning-series')).json.data || [],
    production: (await api(s, 'GET', '/api/mr11/production-series')).json.data || [],
    users: Object.fromEntries(users.map((u) => [u.email, [...u.roles].sort().join(',')])),
  };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fileOf = (code) => path.join(workbookDir, `${code.toLowerCase()}.xlsx`);
const seriesKey = (list) => list.map((x) => `${x.projectNo ?? x.projectShortname}|${x.stream}|${x.fontColor}|${x.seriesNumber}|${x.totalProcessed ?? x.totalProduced}`).sort();

async function main() {
  for (const code of DEPTS) if (!fs.existsSync(fileOf(code))) throw new Error(`Missing ${fileOf(code)}`);
  await resetDb();
  console.log('Database reset from supabase/schema.sql\n');

  // ---------------------------------------------------------------- 1. upload through the API
  console.log('# Upload all seven workbooks');
  let A = await startServer(3201);
  let token = await login(A, ADMIN.email, ADMIN.password);
  check('admin can log in', Boolean(token));
  for (const code of DEPTS) {
    const r = await upload(A, token, code, fileOf(code));
    check(`upload ${code}`, r.status === 200 && r.json.success, JSON.stringify(r.json).slice(0, 200));
  }
  let s = await snapshot(A, token);
  for (const code of DEPTS) check(`${code} shows ${code.toLowerCase()}.xlsx`, s.active[code] === `${code.toLowerCase()}.xlsx`, s.active[code]);
  check('MR11 generated with records', s.records.length > 0, `${s.records.length} records`);
  console.log(`      MR11 rows: ${s.records.length}, planning series: ${s.planning.length}, production series: ${s.production.length}`);

  // ---------------------------------------------------------------- 2. users and a newer BD version
  console.log('\n# Users and a newer workbook version');
  const created = await api(A, 'POST', '/api/admin/users', {
    token,
    body: { email: 'tester@example.test', password: 'Tester#2026', fullName: 'Persistence Tester', primaryProfile: 'PLANNING' },
  });
  check('create user tester@example.test', created.status === 201, JSON.stringify(created.json).slice(0, 200));
  const testerId = created.json.data?.id;
  const perm = await api(A, 'PATCH', `/api/admin/users/${testerId}/permissions`, { token, body: { roles: ['PLANNING', 'DESIGN'] } });
  check('change tester roles to PLANNING + DESIGN', perm.status === 200);
  const temp = await api(A, 'POST', '/api/admin/users', {
    token,
    body: { email: 'temp@example.test', password: 'Temp#2026', fullName: 'Temporary', primaryProfile: 'BD' },
  });
  const del = await api(A, 'DELETE', `/api/admin/users/${temp.json.data?.id}`, { token });
  check('create then delete temp@example.test', temp.status === 201 && del.status === 200);

  const v2 = await upload(A, token, 'BD', fileOf('BD'), 'bd-v2.xlsx');
  check('upload a newer BD file (bd-v2.xlsx)', v2.status === 200 && v2.json.success);
  const before = await snapshot(A, token);
  check('BD now shows bd-v2.xlsx', before.active.BD === 'bd-v2.xlsx', before.active.BD);

  // ---------------------------------------------------------------- 3. restart
  console.log('\n# Restart (same as a Vercel cold start)');
  await stopServer(A);
  A = await startServer(3201);
  const cold = await activeFiles(A); // first request after start, before anything else
  check('first request after restart already shows bd-v2.xlsx', cold.BD === 'bd-v2.xlsx', cold.BD);
  token = await login(A, ADMIN.email, ADMIN.password);
  const after = await snapshot(A, token);
  for (const code of DEPTS) check(`${code} unchanged after restart`, after.active[code] === before.active[code], `${before.active[code]} -> ${after.active[code]}`);
  check('latest MR11 run unchanged', after.runId === before.runId && same(after.records, before.records));
  check('tester still exists with PLANNING + DESIGN', after.users['tester@example.test'] === 'DESIGN,PLANNING', after.users['tester@example.test']);
  check('deleted temp user stays deleted', !('temp@example.test' in after.users));
  check('tester can log in with own password', Boolean(await login(A, 'tester@example.test', 'Tester#2026')));
  check('tester cannot log in with a wrong password', !(await login(A, 'tester@example.test', 'wrong-password')));
  check('demo accounts (ceo@, planning@) still log in', Boolean(await login(A, 'ceo@mfeformwork.com', 'admin123')) && Boolean(await login(A, 'planning@mfeformwork.com', 'admin123')));
  check('planning series history kept', same(seriesKey(after.planning), seriesKey(before.planning)), `${before.planning.length} -> ${after.planning.length}`);
  check('production series history kept', same(seriesKey(after.production), seriesKey(before.production)), `${before.production.length} -> ${after.production.length}`);

  const regen = await api(A, 'POST', '/api/mr11/regenerate');
  const rerun = (await api(A, 'GET', '/api/mr11')).json.data?.run;
  const diff = (rerun?.records || []).findIndex((r, i) => !same(r, before.records[i]));
  check(
    'regenerating after restart gives the same MR11 as before',
    regen.status === 200 && rerun?.records?.length === before.records.length && diff === -1,
    diff >= 0 ? `first difference at row ${diff}: ${JSON.stringify(Object.entries(rerun.records[diff]).filter(([k, v]) => !same(v, before.records[diff][k])).slice(0, 4))}` : ''
  );

  // ---------------------------------------------------------------- 4. two instances
  console.log('\n# Two servers at once (Vercel can run several instances)');
  const B = await startServer(3202);
  const tokenB = await login(B, ADMIN.email, ADMIN.password);
  const second = await api(B, 'POST', '/api/admin/users', {
    token: tokenB,
    body: { email: 'second@example.test', password: 'Second#2026', fullName: 'Second', primaryProfile: 'DESIGN' },
  });
  check('user created on server B can log in on server A', second.status === 201 && Boolean(await login(A, 'second@example.test', 'Second#2026')));

  const d2 = await upload(B, tokenB, 'DESIGN', fileOf('DESIGN'), 'design-v2.xlsx');
  check('upload design-v2.xlsx on server B', d2.status === 200);
  const designB = (await api(B, 'GET', '/api/departments/DESIGN')).json.data?.activeVersion;
  check('server A department list shows design-v2.xlsx', (await activeFiles(A)).DESIGN === 'design-v2.xlsx');
  check('server A DESIGN page shows design-v2.xlsx', (await api(A, 'GET', '/api/departments/DESIGN')).json.data?.activeVersion?.originalFilename === 'design-v2.xlsx');

  // Server A last saw design.xlsx in memory; its next upload must not bring that older version back
  const p2 = await upload(A, token, 'PLANNING', fileOf('PLANNING'), 'planning-v2.xlsx');
  const runA = (await api(A, 'GET', '/api/mr11')).json.data?.run;
  check('upload on server A builds MR11 from design-v2, not the older design', p2.status === 200 && runA?.sourceSnapshot?.DESIGN === designB?.id, `${runA?.sourceSnapshot?.DESIGN} vs ${designB?.id}`);
  const finalB = await activeFiles(B);
  check('server B shows planning-v2.xlsx and design-v2.xlsx', finalB.PLANNING === 'planning-v2.xlsx' && finalB.DESIGN === 'design-v2.xlsx', JSON.stringify(finalB));

  const secondId = second.json.data?.id;
  await api(A, 'DELETE', `/api/admin/users/${secondId}`, { token });
  await stopServer(B);
  const B2 = await startServer(3202);
  check('user deleted on server A is gone on restarted server B', !(await login(B2, 'second@example.test', 'Second#2026')));

  await stopServer(A);
  await stopServer(B2);

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
