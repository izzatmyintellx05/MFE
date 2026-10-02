/**
 * Supabase PostgreSQL connection, read from the DATABASE_URL environment variable
 * (set it in .env locally and in the hosting provider's environment settings).
 * On Vercel, the Supabase integration provides it as DATABASE_POSTGRES_URL (prefix "DATABASE").
 * Returns an empty string when it is not set, and the app then runs in memory only.
 */
export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || process.env.DATABASE_POSTGRES_URL || process.env.POSTGRES_URL || '';
  // pg treats sslmode=require as verify-full, which rejects Supabase's certificate chain;
  // no-verify keeps the encryption and matches getSslConfig below.
  return url.replace(/([?&]sslmode=)(require|prefer|verify-ca)\b/i, '$1no-verify');
}

/** SSL for hosted databases (Supabase); off for a local Postgres or when sslmode=disable. */
export function getSslConfig(url: string): false | { rejectUnauthorized: boolean } {
  if (/sslmode=disable/i.test(url) || /@(localhost|127\.0\.0\.1)[:/]/i.test(url)) return false;
  return { rejectUnauthorized: false };
}
