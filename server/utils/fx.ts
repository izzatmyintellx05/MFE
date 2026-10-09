/**
 * Live exchange rates: USD -> MYR (shown on the MR11 page) and USD -> every other currency (for
 * turning BD's MYR and other-currency selling prices into USD).
 *
 * Bank Negara Malaysia's open API is the source (https://api.bnm.gov.my, middle rate of the
 * latest session, 27 currencies). A currency BNM doesn't publish comes from ExchangeRate-API's
 * open endpoint, or else the European Central Bank via Frankfurter. Rates are cached for an hour;
 * if every source is unreachable the last rates fetched are reused, and the USD_TO_MYR_RATE
 * setting is only a last resort.
 */

export interface FxRate {
  rate: number;
  source: string;
  asOf: string; // date the provider published the rate (YYYY-MM-DD)
  live: boolean; // false when an older cached rate or the fixed setting is used
}

/** 1 USD in each currency, with where each rate came from and the date it was published */
export interface UsdRatesInfo {
  rates: Record<string, number>;
  sources: Record<string, string>;
  asOf: Record<string, string>;
  live: boolean;
}

export const BNM_SOURCE = 'Bank Negara Malaysia';

const CACHE_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 5000;

let cached: { value: UsdRatesInfo; fetchedAt: number } | null = null;

async function getJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

type Loaded = { rates: Record<string, number>; asOf: string };

// BNM quotes MYR per unit of each currency (per 100 for some, e.g. JPY); turned into 1 USD = x
async function loadBnm(): Promise<Loaded> {
  const j = await getJson('https://api.bnm.gov.my/public/exchange-rate', { Accept: 'application/vnd.BNM.API.v1+json' });
  const myrPer: Record<string, number> = {};
  let asOf = '';
  for (const d of j?.data || []) {
    const middle = Number(d?.rate?.middle_rate);
    const unit = Number(d?.unit) || 1;
    if (d?.currency_code && middle > 0) myrPer[String(d.currency_code).toUpperCase()] = middle / unit;
    if (d?.rate?.date && String(d.rate.date) > asOf) asOf = String(d.rate.date);
  }
  const myrPerUsd = myrPer.USD;
  if (!(myrPerUsd > 0)) throw new Error('no USD rate');
  const rates: Record<string, number> = { USD: 1, MYR: myrPerUsd };
  for (const [code, perUnit] of Object.entries(myrPer)) if (code !== 'USD' && code !== 'SDR') rates[code] = myrPerUsd / perUnit;
  return { rates, asOf };
}

const fallbacks: { name: string; load: () => Promise<Loaded> }[] = [
  {
    name: 'ExchangeRate-API',
    load: async () => {
      const j = await getJson('https://open.er-api.com/v6/latest/USD');
      if (j?.result !== 'success' || !j?.rates?.MYR) throw new Error('no rates');
      return { rates: j.rates, asOf: new Date(Number(j.time_last_update_unix) * 1000).toISOString().slice(0, 10) };
    },
  },
  {
    name: 'Frankfurter (ECB)',
    load: async () => {
      const j = await getJson('https://api.frankfurter.dev/v1/latest?base=USD');
      if (!j?.rates?.MYR) throw new Error('no rates');
      return { rates: { ...j.rates, USD: 1 }, asOf: String(j.date) };
    },
  },
];

/** Today's rates: BNM's, completed by the first fallback that answers. Null when none can be found. */
export async function getUsdRatesInfo(): Promise<UsdRatesInfo | null> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached.value;

  const info: UsdRatesInfo = { rates: {}, sources: {}, asOf: {}, live: true };
  const take = (loaded: Loaded, source: string) => {
    for (const [code, rate] of Object.entries(loaded.rates)) {
      if (info.rates[code] || !(Number(rate) > 0)) continue;
      info.rates[code] = Number(rate);
      info.sources[code] = source;
      info.asOf[code] = loaded.asOf;
    }
  };

  try {
    take(await loadBnm(), BNM_SOURCE);
  } catch (err: any) {
    console.warn('[FX] Bank Negara Malaysia unavailable:', err?.message || err);
  }
  for (const fallback of fallbacks) {
    try {
      take(await fallback.load(), fallback.name);
      break;
    } catch (err: any) {
      console.warn(`[FX] ${fallback.name} unavailable:`, err?.message || err);
    }
  }

  if (info.rates.MYR) {
    cached = { value: info, fetchedAt: Date.now() };
    return info;
  }
  if (cached) return { ...cached.value, live: false };
  const rate = Number(process.env.USD_TO_MYR_RATE);
  return Number.isFinite(rate) && rate > 0
    ? { rates: { USD: 1, MYR: rate }, sources: { MYR: 'USD_TO_MYR_RATE setting' }, asOf: { MYR: '' }, live: false }
    : null;
}

/** 1 USD in each currency ({ MYR: 4.09, AUD: 1.43, ... }), or null */
export async function getUsdRates(): Promise<Record<string, number> | null> {
  return (await getUsdRatesInfo())?.rates ?? null;
}

/** Current USD -> MYR rate, or null when no rate could be found at all. */
export async function getUsdToMyrRate(): Promise<FxRate | null> {
  const info = await getUsdRatesInfo();
  if (!info?.rates.MYR) return null;
  const isSetting = info.sources.MYR === 'USD_TO_MYR_RATE setting';
  return { rate: info.rates.MYR, source: info.sources.MYR, asOf: info.asOf.MYR || '', live: info.live && !isSetting };
}
