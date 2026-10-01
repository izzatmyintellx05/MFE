// Starts / stops the project's local PostgreSQL (data in .localdb/data, port 5433).
// Usage: node scripts/localdb.mjs start|stop|status
// Set PG_BIN if PostgreSQL's bin folder is not at the default Windows location.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const action = process.argv[2] || 'status';
const pgBin = process.env.PG_BIN || 'C:/Program Files/PostgreSQL/18/bin';
const pgCtl = path.join(pgBin, process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl');
const dataDir = path.resolve('.localdb/data');
const logFile = path.resolve('.localdb/postgres.log');

if (!fs.existsSync(dataDir)) {
  console.error(`No local database at ${dataDir}. See README for setup.`);
  process.exit(1);
}

const args = { start: ['-D', dataDir, '-l', logFile, '-w', 'start'], stop: ['-D', dataDir, '-m', 'fast', 'stop'], status: ['-D', dataDir, 'status'] }[action];
if (!args) {
  console.error('Usage: node scripts/localdb.mjs start|stop|status');
  process.exit(1);
}

// stdio is ignored so the database server does not keep this process attached
const result = spawnSync(pgCtl, args, { stdio: 'ignore', windowsHide: true });
const ok = result.status === 0;
console.log(
  {
    start: ok ? 'Local database running on localhost:5433' : `Could not start the local database (see ${logFile})`,
    stop: ok ? 'Local database stopped' : 'Local database was not running',
    status: ok ? 'Local database is running' : 'Local database is not running',
  }[action]
);
process.exit(ok || action !== 'start' ? 0 : 1);
