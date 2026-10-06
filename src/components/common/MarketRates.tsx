import React from 'react';
import { ArrowRightLeft, TrendingUp, TrendingDown } from 'lucide-react';

// Live USD -> MYR exchange rate (returned by GET /mr11)
export interface FxRate {
  rate: number;
  source: string;
  asOf: string;
  live: boolean;
}

// Latest LME aluminium price, USD per tonne (returned by GET /mr11)
export interface LmePrice {
  cash: number;
  threeMonth: number | null;
  previousCash: number | null;
  asOf: string;
  source: string;
  live: boolean;
}

const LiveBadge: React.FC<{ live: boolean }> = ({ live }) => (
  <span
    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
      live ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
    }`}
  >
    <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
    {live ? 'Live' : 'Last known'}
  </span>
);

export const ExchangeRateCard: React.FC<{ fxRate: FxRate | null; className?: string }> = ({ fxRate, className = '' }) => (
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
          <div className="text-[10px] text-stone-400">
            {fxRate.source}
            {fxRate.asOf ? ` · ${fxRate.asOf}` : ''}
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
        </>
      ) : (
        <div className="text-xs font-semibold text-rose-600">Unavailable</div>
      )}
    </div>
  </div>
);
