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

// Shared frame of the market cards: icon and title with the live badge, the figures, and the source
const MarketCard: React.FC<{
  icon: React.ReactNode;
  accent: string;
  title: string;
  badge?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ icon, accent, title, badge, footer, className = '', children }) => (
  <section
    className={`flex flex-col min-w-[260px] bg-white border border-stone-200/80 rounded-xl shadow-sm overflow-hidden ${className}`}
  >
    <div className="flex items-center gap-2 px-4 pt-3">
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${accent}`}>{icon}</span>
      <h3 className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">{title}</h3>
      <span className="ml-auto">{badge}</span>
    </div>
    <div className="flex-1 px-4 pt-2 pb-3">{children}</div>
    {footer && <div className="px-4 py-2 border-t border-stone-100 bg-stone-50/70 text-[10px] text-stone-500">{footer}</div>}
  </section>
);

const Unavailable = () => <div className="text-xs font-semibold text-rose-600 py-2">Unavailable right now</div>;

export const ExchangeRateCard: React.FC<{ fxRate: FxRate | null; currencyRates?: CurrencyRate[]; className?: string }> = ({
  fxRate,
  currencyRates = [],
  className = '',
}) => {
  const others = currencyRates.filter((c) => c.code !== 'MYR');
  const hasFallback = others.some((c) => c.source && c.source !== BNM);
  return (
    <MarketCard
      className={className}
      icon={<ArrowRightLeft className="w-3.5 h-3.5" />}
      accent="bg-emerald-50 text-emerald-600"
      title="Exchange rates"
      badge={fxRate && <LiveBadge live={fxRate.live} />}
      footer={
        fxRate && (
          <>
            Source:{' '}
            {fxRate.source === BNM ? (
              <a href="https://apikijangportal.bnm.gov.my/" target="_blank" rel="noreferrer" className="font-semibold underline hover:text-stone-800">
                Bank Negara Malaysia
              </a>
            ) : (
              <span className="font-semibold">{fxRate.source}</span>
            )}
            {fxRate.source === BNM && ' · middle rate'}
            {fxRate.asOf && ` · ${fxRate.asOf}`}
            {hasFallback && <span className="text-amber-700"> · * from ExchangeRate-API (not published by BNM)</span>}
          </>
        )
      }
    >
      {fxRate ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-semibold text-stone-500">1 USD =</span>
            <span className="text-xl font-extrabold text-stone-900 font-mono tabular-nums tracking-tight">{fxRate.rate.toFixed(4)}</span>
            <span className="text-xs font-bold text-stone-600">MYR</span>
          </div>
          {others.length > 0 && (
            <ul className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-1.5">
              {others.map((c) => (
                <li
                  key={c.code}
                  title={`1 USD = ${c.rate.toFixed(4)} ${currencyName(c.code)} · ${c.source}${c.inBd ? ' · used in BD Other Currencies' : ''}`}
                  className={`rounded-lg border px-2 py-1 ${
                    c.inBd ? 'border-emerald-300 bg-emerald-50/70' : 'border-stone-200 bg-stone-50/60'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-bold ${c.inBd ? 'text-emerald-800' : 'text-stone-600'}`}>{c.code}</span>
                    {c.source && c.source !== BNM && <span className="text-[10px] font-bold text-amber-600">*</span>}
                    {c.inBd && <span className="ml-auto text-[8px] font-bold uppercase text-emerald-700">BD</span>}
                  </div>
                  <div className="font-mono text-xs font-semibold text-stone-900 tabular-nums">{c.rate.toFixed(4)}</div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <Unavailable />
      )}
    </MarketCard>
  );
};

export const LmePriceCard: React.FC<{ lmePrice: LmePrice | null; className?: string }> = ({ lmePrice, className = '' }) => {
  const change = lmePrice?.previousCash ? lmePrice.cash - lmePrice.previousCash : null;
  const up = change !== null && change >= 0;
  const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <MarketCard
      className={className}
      icon={change !== null && !up ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
      accent="bg-sky-50 text-sky-600"
      title="LME aluminium"
      badge={lmePrice && <LiveBadge live={lmePrice.live} />}
      footer={
        lmePrice && (
          <>
            Source: LME official prices via{' '}
            <a href={LME_SOURCE_URL} target="_blank" rel="noreferrer" className="font-semibold underline hover:text-stone-800">
              Westmetall
            </a>
            {` · ${lmePrice.asOf}`}
          </>
        )
      }
    >
      {lmePrice ? (
        <>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-stone-500">USD</span>
            <span className="text-xl font-extrabold text-stone-900 font-mono tabular-nums tracking-tight">{money(lmePrice.cash)}</span>
            <span className="text-xs font-bold text-stone-600">/ t</span>
            {change !== null && (
              <span
                className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold font-mono ${
                  up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}
              >
                {up ? '▲ +' : '▼ '}
                {change.toFixed(2)} ({((change / lmePrice.previousCash!) * 100).toFixed(2)}%)
              </span>
            )}
          </div>
          <dl className="mt-2.5 grid grid-cols-2 gap-1.5">
            <div className="rounded-lg border border-stone-200 bg-stone-50/60 px-2 py-1">
              <dt className="text-[10px] font-bold text-stone-500">Cash settlement</dt>
              <dd className="font-mono text-xs font-semibold text-stone-900 tabular-nums">{money(lmePrice.cash)}</dd>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50/60 px-2 py-1">
              <dt className="text-[10px] font-bold text-stone-500">3-month</dt>
              <dd className="font-mono text-xs font-semibold text-stone-900 tabular-nums">
                {lmePrice.threeMonth ? money(lmePrice.threeMonth) : '—'}
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <Unavailable />
      )}
    </MarketCard>
  );
};
