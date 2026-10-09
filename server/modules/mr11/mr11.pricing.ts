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

// Every currency BD may type in "Other Currencies", as its ISO code: the code itself ("SGD"),
// its English name ("Singapore Dollar", "Singapore Dollars"), the name's first word when only one
// currency starts with it ("Singapore", "Australian", "Rupee" -> by its last word) or a symbol.
const CURRENCY_SYMBOLS: Record<string, string> = {
  $: 'USD',
  US$: 'USD',
  USD$: 'USD',
  RM: 'MYR',
  RINGGIT: 'MYR',
  S$: 'SGD',
  SG$: 'SGD',
  A$: 'AUD',
  AU$: 'AUD',
  NZ$: 'NZD',
  C$: 'CAD',
  CA$: 'CAD',
  HK$: 'HKD',
  B$: 'BND',
  NT$: 'TWD',
  '€': 'EUR',
  EURO: 'EUR',
  EUROS: 'EUR',
  '£': 'GBP',
  POUND: 'GBP',
  POUNDS: 'GBP',
  STERLING: 'GBP',
  '¥': 'JPY',
  YEN: 'JPY',
  RMB: 'CNY',
  YUAN: 'CNY',
  RENMINBI: 'CNY',
  '₹': 'INR',
  // Rupee and Dirham are several countries' currencies: BD's projects mean India's and the UAE's
  RUPEE: 'INR',
  RUPEES: 'INR',
  DIRHAM: 'AED',
  DIRHAMS: 'AED',
  RS: 'INR',
  'RS.': 'INR',
  '₱': 'PHP',
  '฿': 'THB',
  '₫': 'VND',
  '₩': 'KRW',
  RP: 'IDR',
  DHS: 'AED',
  AED: 'AED',
};

let currencyNames: Record<string, string> | null = null;

// English names of every ISO currency (162 of them), built once
function currencyNameIndex(): Record<string, string> {
  if (currencyNames) return currencyNames;
  const index: Record<string, string> = {};
  const firstWords: Record<string, string[]> = {};
  const lastWords: Record<string, string[]> = {};
  try {
    const names = new Intl.DisplayNames('en', { type: 'currency' });
    for (const code of (Intl as any).supportedValuesOf('currency') as string[]) {
      const name = String(names.of(code) ?? '').toUpperCase();
      if (!name || name === code) continue;
      index[name] = code;
      index[`${name}S`] = code;
      const words = name.split(/\s+/);
      (firstWords[words[0]] ||= []).push(code);
      (lastWords[words[words.length - 1]] ||= []).push(code);
    }
  } catch {
    // no Intl currency names: codes and symbols still work
  }
  // A single word names a currency only when no other currency shares it ("Singapore" yes, "Dollar" no)
  for (const [word, codes] of Object.entries(firstWords)) if (codes.length === 1 && !index[word]) index[word] = codes[0];
  for (const [word, codes] of Object.entries(lastWords)) {
    if (codes.length === 1 && !index[word]) {
      index[word] = codes[0];
      index[`${word}S`] = codes[0];
    }
  }
  currencyNames = index;
  return index;
}

export function currencyCode(value: any): string | null {
  const s = String(value ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (!s) return null;
  if (CURRENCY_SYMBOLS[s]) return CURRENCY_SYMBOLS[s];
  if (/^[A-Z]{3}$/.test(s)) return s;
  const names = currencyNameIndex();
  if (names[s]) return names[s];
  // "SGD 200", "AUD (Australia)": a known three-letter code inside the text
  const code = s.match(/\b[A-Z]{3}\b/g)?.find((c) => Object.values(names).includes(c));
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
): {
  sellingPriceUsd: number | null;
  lmeAdjusted: number | string | null;
  finalSellingPrice: number | null;
  /** A price that could not be turned into USD (unknown currency, or no rate today) */
  priceNote: string | null;
} {
  // Selling Price (USD): every currency with a value, in USD
  let selling: number | null = null;
  let priceNote: string | null = null;
  const add = (amount: number | null, currency: string | null, typed: any) => {
    if (amount === null) return;
    const rate = currency === 'USD' ? 1 : currency ? rates?.[currency] : undefined;
    if (rate && rate > 0) selling = (selling ?? 0) + amount / rate;
    else priceNote = `${amount} ${String(typed ?? '').trim() || '(no currency)'} not included: currency not recognised`;
  };
  add(num(p.usd), 'USD', 'USD');
  add(num(p.myr), 'MYR', 'MYR');
  add(num(p.otherPrice), currencyCode(p.otherCurrency), p.otherCurrency);

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
  return { sellingPriceUsd: selling === null ? null : round6(selling), lmeAdjusted, finalSellingPrice, priceNote };
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
      _priceNote: priced.priceNote,
    };
  });
}
