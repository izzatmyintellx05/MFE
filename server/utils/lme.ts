/**
 * Latest LME aluminium price, shown on the MR11 page next to the exchange rate.
 *
 * The LME publishes its official prices once per trading day; Westmetall's table of them is
 * freely readable (https://www.westmetall.com/en/markdaten.php?action=table&field=LME_Al_cash)
 * and is cached for an hour. If it can't be reached the last price fetched is reused.
 */

export interface LmePrice {
  cash: number; // LME aluminium cash settlement, USD per tonne
  threeMonth: number | null; // LME aluminium 3-month, USD per tonne
  previousCash: number | null; // cash settlement on the trading day before
  asOf: string; // trading day of the price (YYYY-MM-DD)
  source: string;
  live: boolean; // false when an older cached price is used
}

const URL = 'https://www.westmetall.com/en/markdaten.php?action=table&field=LME_Al_cash';
const CACHE_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 8000;

let cached: { value: LmePrice; fetchedAt: number } | null = null;

const toNumber = (s: string) => {
  const n = Number(s.replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Reads the newest rows of the price table: date, cash settlement, 3-month, stock. */
export function parseWestmetallTable(html: string): LmePrice {
  const rows: { date: string; cash: number | null; threeMonth: number | null }[] = [];
  const rowRe = /<tr>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) && rows.length < 2) {
    const date = new Date(`${m[1].replace('.', '')} UTC`);
    if (isNaN(date.getTime())) continue;
    rows.push({ date: date.toISOString().slice(0, 10), cash: toNumber(m[2]), threeMonth: toNumber(m[3]) });
  }
  const latest = rows[0];
  if (!latest?.cash) throw new Error('no LME aluminium price in the table');
  return {
    cash: latest.cash,
    threeMonth: latest.threeMonth,
    previousCash: rows[1]?.cash ?? null,
    asOf: latest.date,
    source: 'LME official prices (via Westmetall)',
    live: true,
  };
}

/** Latest LME aluminium price, or null when none has ever been fetched. */
export async function getLmeAluminiumPrice(): Promise<LmePrice | null> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached.value;
  try {
    const res = await fetch(URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (MFE MR11)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const value = parseWestmetallTable(await res.text());
    cached = { value, fetchedAt: Date.now() };
    return value;
  } catch (err: any) {
    console.warn('[LME] price unavailable:', err?.message || err);
    return cached ? { ...cached.value, live: false } : null;
  }
}
