/**
 * Supabase PostgreSQL connection, read from the DATABASE_URL environment variable
 * (set it in .env locally and in the hosting provider's environment settings).
 * Returns an empty string when it is not set, and the app then runs in memory only.
 */
export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL || '';
}

/** SSL for hosted databases (Supabase); off for a local Postgres or when sslmode=disable. */
export function getSslConfig(url: string): false | { rejectUnauthorized: boolean } {
  if (/sslmode=disable/i.test(url) || /@(localhost|127\.0\.0\.1)[:/]/i.test(url)) return false;
  return { rejectUnauthorized: false };
}
