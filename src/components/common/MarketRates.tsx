import React from 'react';
import { ArrowRightLeft, TrendingUp, TrendingDown } from 'lucide-react';

// Live USD -> MYR exchange rate (returned by GET /mr11)
export interface FxRate {
  rate: number;
  source: string;
  asOf: string;
  live: boolean;
}

// 1 USD in other currencies (returned by GET /mr11); inBd = used in BD's Other Currencies
export interface CurrencyRate {
  code: string;
  rate: number;
  inBd: boolean;
  source: string; // Bank Negara Malaysia, or a fallback for a currency BNM doesn't publish
}

const BNM = 'Bank Negara Malaysia';
const LME_SOURCE_URL = 'https://www.westmetall.com/en/markdaten.php?action=table&field=LME_Al_cash';

// Latest LME aluminium price, USD per tonne (returned by GET /mr11)
export interface LmePrice {
  cash: number;
  threeMonth: number | null;
  previousCash: number | null;
  asOf: string;
  source: string;
  live: boolean;
}

export const LiveBadge: React.FC<{ live: boolean }> = ({ live }) => (
  <span
    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
      live ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
    }`}
  >
    <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
    {live ? 'Live' : 'Last known'}
  </span>
);

const currencyName = (code: string) => {
  try {
    return new Intl.DisplayNames('en', { type: 'currency' }).of(code) || code;
  } catch {
    return code;
  }
};

export const ExchangeRateCard: React.FC<{ fxRate: FxRate | null; currencyRates?: CurrencyRate[]; className?: string }> = ({
  fxRate,
  currencyRates = [],
  className = '',
}) => (
  <div className={`flex items-center gap-3 bg-white border border-stone-200/80 rounded-xl px-4 py-2.5 shadow-sm ${className}`}>
    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
      <ArrowRightLeft className="w-4 h-4" />
    </div>
    <div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Exchange Rate</span>
        {fxRate && <LiveBadge live={fxRate.live} />}
      </div>
      {fxRate ? (
        <>
          <div className="text-sm font-extrabold text-stone-900 font-mono">1 USD = {fxRate.rate.toFixed(4)} MYR</div>
          {/* Other currencies against 1 USD (MYR is the line above); BD's own currencies marked */}
          {currencyRates.filter((c) => c.code !== 'MYR').length > 0 && (
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[11px] text-stone-700">
              {currencyRates
                .filter((c) => c.code !== 'MYR')
                .map((c) => (
                  <span
                    key={c.code}
                    title={`${currencyName(c.code)} · ${c.source}${c.inBd ? ' · used in BD Other Currencies' : ''}`}
                  >
                    {c.rate.toFixed(4)} <span className={c.inBd ? 'font-bold text-emerald-700' : 'text-stone-500'}>{c.code}</span>
                    {c.source && c.source !== BNM && <span className="text-amber-600">*</span>}
                  </span>
                ))}
            </div>
          )}
          <div className="text-[10px] text-stone-400">
            Source: {fxRate.source === BNM ? 'Bank Negara Malaysia (api.bnm.gov.my), middle rate' : fxRate.source}
            {fxRate.asOf ? ` · ${fxRate.asOf}` : ''}
            {currencyRates.some((c) => c.source && c.source !== BNM) && (
              <span className="text-amber-600"> · * not published by BNM, from ExchangeRate-API</span>
            )}
          </div>
        </>
      ) : (
        <div className="text-xs font-semibold text-rose-600">Unavailable</div>
      )}
    </div>
  </div>
);

export const LmePriceCard: React.FC<{ lmePrice: LmePrice | null; className?: string }> = ({ lmePrice, className = '' }) => (
  <div className={`flex items-center gap-3 bg-white border border-stone-200/80 rounded-xl px-4 py-2.5 shadow-sm ${className}`}>
    <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 flex-shrink-0">
      {lmePrice?.previousCash && lmePrice.cash < lmePrice.previousCash ? (
        <TrendingDown className="w-4 h-4" />
      ) : (
        <TrendingUp className="w-4 h-4" />
      )}
    </div>
    <div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">LME Aluminium</span>
        {lmePrice && <LiveBadge live={lmePrice.live} />}
      </div>
      {lmePrice ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-extrabold text-stone-900 font-mono">
              USD {lmePrice.cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / t
            </span>
            {lmePrice.previousCash && (
              <span
                className={`text-[10px] font-bold font-mono ${
                  lmePrice.cash >= lmePrice.previousCash ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {lmePrice.cash >= lmePrice.previousCash ? '+' : ''}
                {(lmePrice.cash - lmePrice.previousCash).toFixed(2)} (
                {(((lmePrice.cash - lmePrice.previousCash) / lmePrice.previousCash) * 100).toFixed(2)}%)
              </span>
            )}
          </div>
          <div className="text-[10px] text-stone-400" title={lmePrice.source}>
            Cash settlement
            {lmePrice.threeMonth ? ` · 3-month ${lmePrice.threeMonth.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}
            {` · ${lmePrice.asOf}`}
          </div>
          <div className="text-[10px] text-stone-400">
            Source: LME official prices via{' '}
            <a href={LME_SOURCE_URL} target="_blank" rel="noreferrer" className="underline hover:text-stone-700">
              Westmetall
            </a>
          </div>
        </>
      ) : (
        <div className="text-xs font-semibold text-rose-600">Unavailable</div>
      )}
    </div>
  </div>
);
