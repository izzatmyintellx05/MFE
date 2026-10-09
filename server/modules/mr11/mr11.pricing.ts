/**
 * Prices of a BD row in MR11, worked out from the BD file's price columns with today's LME
 * aluminium price and exchange rates (both change daily, so MR11 recalculates them whenever it
 * is read, not only when a file is uploaded).
 *
 *   Selling Price (USD) = Selling Price (USD) + Selling Price (MYR) in USD
 *                         + Selling Price in the "Other Currencies" currency, in USD
 *   LME Adjusted (USD)  = LME "Variable": (today's LME price - the row's LME Rate) / 1000 x 21.5
 *                         LME "Fixed":    0
 *                         LME "Freeze":   "Check"
 *                         anything else:  the value typed in the BD file stays
 *   Final Selling Price = Selling Price (USD) + Props + Aluminium + Freight
 *                         + LME Adjusted when it is a number ("Check" counts as 0);
 *                         none when the row has no selling price in any currency
 */

/** The BD columns a row's prices are worked out from (kept with each MR11 row as _pricing) */
export interface BdPriceInputs {
  usd: any;
  myr: any;
  otherCurrency: any;
  otherPrice: any;
  lmeType: any;
  lmeRate: any;
  lmeAdjustedInFile: any;
  props: any;
  aluminium: any;
  freight: any;
}

/** USD -> currency rates ({ MYR: 4.2, AUD: 1.5, ... }) */
export type UsdRates = Record<string, number>;

const LME_USD_PER_1000 = 21.5; // USD per m2 for every USD 1,000/t, as in the BD workbook

// Names BD may type in "Other Currencies", as ISO codes
const CURRENCY_NAMES: Record<string, string> = {
  RM: 'MYR',
  RINGGIT: 'MYR',
  'S$': 'SGD',
  SINGAPORE: 'SGD',
  'SINGAPORE DOLLAR': 'SGD',
  'SINGAPORE DOLLARS': 'SGD',
  'A$': 'AUD',
  AUSTRALIAN: 'AUD',
  'AUSTRALIAN DOLLAR': 'AUD',
  'AUSTRALIAN DOLLARS': 'AUD',
  RUPEE: 'INR',
  RUPEES: 'INR',
  RMB: 'CNY',
  YUAN: 'CNY',
  EURO: 'EUR',
  EUROS: 'EUR',
  POUND: 'GBP',
  'US$': 'USD',
  $: 'USD',
};

export function currencyCode(value: any): string | null {
  const s = String(value ?? '').trim().toUpperCase();
  if (!s) return null;
  if (CURRENCY_NAMES[s]) return CURRENCY_NAMES[s];
  const code = s.match(/\b[A-Z]{3}\b/)?.[0];
  return code ?? null;
}

const usable = (v: any) =>
  v !== null && v !== undefined && typeof v !== 'object' && String(v).trim() !== '' && !String(v).trim().startsWith('#');
const num = (v: any): number | null => (usable(v) && !isNaN(Number(v)) ? Number(v) : null);
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function priceBdRow(
  p: BdPriceInputs,
  lmeCash: number | null,
  rates: UsdRates | null
): { sellingPriceUsd: number | null; lmeAdjusted: number | string | null; finalSellingPrice: number | null } {
  // Selling Price (USD): every currency with a value, in USD
  let selling: number | null = null;
  const add = (amount: number | null, currency: string | null) => {
    if (amount === null || !currency) return;
    const rate = currency === 'USD' ? 1 : rates?.[currency];
    if (rate && rate > 0) selling = (selling ?? 0) + amount / rate;
  };
  add(num(p.usd), 'USD');
  add(num(p.myr), 'MYR');
  add(num(p.otherPrice), currencyCode(p.otherCurrency));

  const type = String(p.lmeType ?? '').trim().toLowerCase();
  let lmeAdjusted: number | string | null;
  if (type === 'freeze') lmeAdjusted = 'Check';
  else if (type === 'fixed') lmeAdjusted = 0;
  else if (type === 'variable' || type.includes('lme')) {
    const rate = num(p.lmeRate);
    lmeAdjusted = rate === null ? 0 : lmeCash === null ? 'Check' : round6(((lmeCash - rate) / 1000) * LME_USD_PER_1000);
  } else {
    lmeAdjusted = usable(p.lmeAdjustedInFile) ? p.lmeAdjustedInFile : null;
  }

  // No selling price in any currency: nothing to add the extras to, so no final price either
  const parts = [selling, num(p.props), num(p.aluminium), num(lmeAdjusted), num(p.freight)];
  const finalSellingPrice = selling === null ? null : round6(parts.reduce((t: number, x) => t + (x ?? 0), 0));
  return { sellingPriceUsd: selling === null ? null : round6(selling), lmeAdjusted, finalSellingPrice };
}

/** MR11 rows with their prices worked out for today's LME price and exchange rates */
export function applyLivePricing<T extends Record<string, any>>(records: T[], lmeCash: number | null, rates: UsdRates | null): T[] {
  return records.map((row) => {
    if (!row?._pricing) return row;
    const priced = priceBdRow(row._pricing, lmeCash, rates);
    return {
      ...row,
      'Selling Price (USD)': priced.sellingPriceUsd,
      'LME Adjusted (USD)': priced.lmeAdjusted,
      'Final Selling Price (USD)': priced.finalSellingPrice,
    };
  });
}
