/**
 * Live USD -> MYR exchange rate, shown on the MR11 page.
 *
 * Fetched from public rate services (ExchangeRate-API's open endpoint, then the European
 * Central Bank via Frankfurter) and cached for an hour. If both are unreachable the last
 * rate fetched is reused; the USD_TO_MYR_RATE setting is only a last resort.
 */

export interface FxRate {
  rate: number;
  source: string;
  asOf: string; // date the provider published the rate (YYYY-MM-DD)
  live: boolean; // false when an older cached rate or the fixed setting is used
}

const CACHE_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 5000;

let cached: { value: FxRate; fetchedAt: number } | null = null;

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const providers: { name: string; load: () => Promise<FxRate> }[] = [
  {
    name: 'ExchangeRate-API',
    load: async () => {
      const j = await getJson('https://open.er-api.com/v6/latest/USD');
      const rate = Number(j?.rates?.MYR);
      if (j?.result !== 'success' || !(rate > 0)) throw new Error('no MYR rate');
      const asOf = new Date(Number(j.time_last_update_unix) * 1000).toISOString().slice(0, 10);
      return { rate, source: 'ExchangeRate-API', asOf, live: true };
    },
  },
  {
    name: 'Frankfurter (ECB)',
    load: async () => {
      const j = await getJson('https://api.frankfurter.dev/v1/latest?base=USD&symbols=MYR');
      const rate = Number(j?.rates?.MYR);
      if (!(rate > 0)) throw new Error('no MYR rate');
      return { rate, source: 'Frankfurter (ECB)', asOf: String(j.date), live: true };
    },
  },
];

function fixedSettingRate(): FxRate | null {
  const rate = Number(process.env.USD_TO_MYR_RATE);
  return Number.isFinite(rate) && rate > 0
    ? { rate, source: 'USD_TO_MYR_RATE setting', asOf: '', live: false }
    : null;
}

/** Current USD -> MYR rate, or null when no rate could be found at all. */
export async function getUsdToMyrRate(): Promise<FxRate | null> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached.value;

  for (const provider of providers) {
    try {
      const value = await provider.load();
      cached = { value, fetchedAt: Date.now() };
      return value;
    } catch (err: any) {
      console.warn(`[FX] ${provider.name} unavailable:`, err?.message || err);
    }
  }

  if (cached) return { ...cached.value, live: false };
  return fixedSettingRate();
}

/**
 * Every currency's rate against USD ({ MYR: 4.2, AUD: 1.5, SGD: 1.3, ... }), for turning BD's
 * MYR and other-currency selling prices into USD. Same sources and hourly cache as above;
 * null when no rates could be found at all.
 */
let cachedAll: { value: Record<string, number>; fetchedAt: number } | null = null;

export async function getUsdRates(): Promise<Record<string, number> | null> {
  if (cachedAll && Date.now() - cachedAll.fetchedAt < CACHE_MS) return cachedAll.value;
  const sources: { name: string; load: () => Promise<Record<string, number>> }[] = [
    {
      name: 'ExchangeRate-API',
      load: async () => {
        const j = await getJson('https://open.er-api.com/v6/latest/USD');
        if (j?.result !== 'success' || !j?.rates?.MYR) throw new Error('no rates');
        return j.rates;
      },
    },
    {
      name: 'Frankfurter (ECB)',
      load: async () => {
        const j = await getJson('https://api.frankfurter.dev/v1/latest?base=USD');
        if (!j?.rates?.MYR) throw new Error('no rates');
        return { ...j.rates, USD: 1 };
      },
    },
  ];
  for (const source of sources) {
    try {
      const value = await source.load();
      cachedAll = { value, fetchedAt: Date.now() };
      return value;
    } catch (err: any) {
      console.warn(`[FX] ${source.name} rates unavailable:`, err?.message || err);
    }
  }
  if (cachedAll) return cachedAll.value;
  const myr = fixedSettingRate();
  return myr ? { USD: 1, MYR: myr.rate } : null;
}
