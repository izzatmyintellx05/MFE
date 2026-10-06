import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { ZoomControls } from '../components/common/ZoomControls';
import { Mr11Table, HeaderGroup } from '../components/workbook/Mr11Table';
import { LiveBadge, FxRate, LmePrice } from '../components/common/MarketRates';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { RefreshCw, AlertCircle, FileSpreadsheet, X, CalendarDays, ChevronDown } from 'lucide-react';
import {
  REGIONS,
  REGION_LABELS,
  STAGES,
  STAGE_LABELS,
  DEFAULT_FORECAST_M2,
  RegionFilter,
  Stage,
  averageSellingPrice,
  dispatchedByMonth,
  filterByRegion,
  firstRowPerProject,
  lmeTypeCounts,
  monthColumns,
  monthlySeries,
  regionOf,
  stageTotals,
} from '../utils/ceoMetrics';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler, Title, Tooltip, Legend);

// Charts share the page's type and a quiet slate palette
ChartJS.defaults.font.family = getComputedStyle(document.documentElement).fontFamily || 'sans-serif';
ChartJS.defaults.font.size = 11;
ChartJS.defaults.color = '#64748B';
Object.assign(ChartJS.defaults.plugins.tooltip, {
  backgroundColor: '#0F172A',
  padding: 10,
  cornerRadius: 8,
  boxPadding: 4,
  titleFont: { weight: '600' },
});

const STAGE_COLORS: Record<Stage, string> = {
  design: '#0F172A',
  processed: '#004B87', // Doka/MFE Deep Blue
  produced: '#38BDF8',
  dispatched: '#FFDA00', // Doka Yellow
  sailed: '#10B981',
};

const REGION_COLORS: Record<string, string> = {
  MALAYSIA: '#004B87',
  INDIA: '#F59E0B',
  ROW: '#10B981',
};

const ACTUAL_COLOR = '#004B87';
const FORECAST_COLOR = '#F59E0B';
const GRID_COLOR = '#F1F5F9';

const formatUsd = (n: number | null, digits = 2) =>
  n === null ? '—' : `${n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const formatNum = (n: number) => Math.round(n).toLocaleString('en-US');
const formatM2 = (n: number) => `${formatNum(n)} m²`;

const axisM2 = { callback: (v: any) => Number(v).toLocaleString('en-US') };

const chartTooltipM2 = {
  callbacks: {
    label: (ctx: any) => ` ${ctx.dataset.label}: ${formatM2(ctx.parsed.y ?? 0)}`,
  },
};

const chartLegend = {
  position: 'bottom' as const,
  labels: { usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 8, boxHeight: 8, padding: 14 },
};

// Shared surface for every section on the page
const PANEL = 'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004B87]/40 focus-visible:ring-offset-1';

const SectionHeading: React.FC<{ title: string; description?: React.ReactNode; children?: React.ReactNode }> = ({
  title,
  description,
  children,
}) => (
  <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
    <div className="min-w-0">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
    </div>
    {children}
  </div>
);

const Stat: React.FC<{ label: string; value: string; unit?: string; note: string; color?: string }> = ({
  label,
  value,
  unit,
  note,
  color,
}) => (
  <div className="min-w-0">
    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
      {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
      {label}
    </div>
    <div className="mt-1.5 font-mono text-[1.75rem] leading-none font-semibold tracking-tight text-slate-900 tabular-nums">
      {value}
      {unit && value !== '—' && <span className="ml-1.5 text-sm font-medium text-slate-400">{unit}</span>}
    </div>
    <p className="mt-2 text-xs text-slate-500">{note}</p>
  </div>
);

export const CeoDashboard: React.FC = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [headerGroups, setHeaderGroups] = useState<HeaderGroup[]>([]);
  const [numberFormats, setNumberFormats] = useState<Record<string, number>>({});
  const [fxRate, setFxRate] = useState<FxRate | null>(null);
  const [lmePrice, setLmePrice] = useState<LmePrice | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState<RegionFilter>('ALL');
  const [month, setMonth] = useState<string>('ALL');
  const [showRawData, setShowRawData] = useState(false);
  const [rawZoom, setRawZoom] = useState<number>(100);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/mr11');
      const data = res.data?.data;
      setRecords(data?.run?.records || []);
      setHeaders(data?.orderedHeaders || []);
      setHeaderGroups(data?.headerGroups || []);
      setNumberFormats(data?.numberFormats || {});
      setFxRate(data?.fxRate || null);
      setLmePrice(data?.lmePrice || null);
      setGeneratedAt(data?.run?.generatedAt || null);
    } catch (err: any) {
      console.error('Failed to load CEO telemetry:', err);
      setError(err.response?.data?.error?.message || err.message || 'Failed to load MR11 data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (!showRawData) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setShowRawData(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showRawData]);

  const today = useMemo(() => new Date(), []);
  const months = useMemo(() => monthColumns(headers), [headers]);
  const selectedMonth = month === 'ALL' ? null : months.find((m) => m.key === month) || null;
  const monthKey = selectedMonth?.key ?? null;

  const regionRows = useMemo(() => filterByRegion(records, region), [records, region]);
  const totals = useMemo(() => stageTotals(regionRows, monthKey), [regionRows, monthKey]);
  const series = useMemo(() => monthlySeries(regionRows, months, today), [regionRows, months, today]);
  const selectedPoint = selectedMonth ? series.find((p) => p.key === selectedMonth.key) || null : null;
  const projectCount = useMemo(() => firstRowPerProject(regionRows).length, [regionRows]);
  // Final Selling Price (USD) per m², weighted by m²; MYR at today's live exchange rate
  const avgPriceUsd = useMemo(() => averageSellingPrice(regionRows, months, monthKey), [regionRows, months, monthKey]);
  const toMyr = (usd: number | null) => (usd !== null && fxRate ? usd * fxRate.rate : null);
  const avgPriceMyr = toMyr(avgPriceUsd);
  // Contract LME from MR11: LME type, LME Rate (USD) and LME Adjusted (USD)
  const lmeTypes = useMemo(() => lmeTypeCounts(regionRows), [regionRows]);
  const avgLmeRate = useMemo(() => averageSellingPrice(regionRows, months, monthKey, 'LME Rate (USD)'), [regionRows, months, monthKey]);
  const avgLmeAdjusted = useMemo(
    () => averageSellingPrice(regionRows, months, monthKey, 'LME Adjusted (USD)'),
    [regionRows, months, monthKey]
  );

  const actualTotal = series.filter((p) => p.kind === 'actual').reduce((a, p) => a + p.value, 0);
  const forecastTotal = series.filter((p) => p.kind === 'forecast').reduce((a, p) => a + p.value, 0);
  const defaultedCount = series.filter((p) => p.isDefault).length;
  const lastActual = [...series].reverse().find((p) => p.kind === 'actual');
  const firstForecast = series.find((p) => p.kind === 'forecast');
  const lastForecast = [...series].reverse().find((p) => p.kind === 'forecast');

  const visibleRegions = region === 'ALL' ? REGIONS : [region];
  const rowsOfRegion = (r: string) => records.filter((row) => regionOf(row) === r);

  const regionStageTotals = visibleRegions.map((r) => stageTotals(rowsOfRegion(r), monthKey));
  const regionDispatched = visibleRegions.map((r) => dispatchedByMonth(rowsOfRegion(r), months));
  const regionDispatchedHasData = regionDispatched.some((values) => values.some((v) => v > 0));

  // Actual line covers completed months; the forecast line starts at the last actual
  // month so the two lines join up
  const lastActualIdx = series.findIndex((p) => p.kind === 'forecast') - 1;
  const pointRadius = (i: number) => (selectedMonth && series[i]?.key === selectedMonth.key ? 6 : 3);
  const monthlyChartData = {
    labels: series.map((p) => p.key),
    datasets: [
      {
        label: 'Actual',
        data: series.map((p) => (p.kind === 'actual' ? p.value : null)),
        borderColor: ACTUAL_COLOR,
        borderWidth: 2,
        backgroundColor: `${ACTUAL_COLOR}14`,
        pointBackgroundColor: ACTUAL_COLOR,
        pointRadius: series.map((_, i) => pointRadius(i)),
        pointHoverRadius: 6,
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Forecast',
        data: series.map((p, i) => (p.kind === 'forecast' || i === lastActualIdx ? p.value : null)),
        borderColor: FORECAST_COLOR,
        borderWidth: 2,
        backgroundColor: `${FORECAST_COLOR}10`,
        borderDash: [6, 4],
        // Hollow points mark months using the 100,000 m² default
        pointBackgroundColor: series.map((p) => (p.isDefault ? '#FFFFFF' : FORECAST_COLOR)),
        pointBorderColor: FORECAST_COLOR,
        pointBorderWidth: 1.5,
        pointRadius: series.map((p, i) => (p.kind === 'forecast' ? pointRadius(i) : 0)),
        pointHoverRadius: 6,
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const regionChartData = {
    labels: visibleRegions.map((r) => REGION_LABELS[r]),
    datasets: STAGES.map((s) => ({
      label: STAGE_LABELS[s],
      data: regionStageTotals.map((t) => t[s]),
      backgroundColor: STAGE_COLORS[s],
      borderRadius: 4,
      maxBarThickness: 22,
    })),
  };

  const regionDispatchData = {
    labels: months.map((m) => m.key),
    datasets: visibleRegions.map((r, idx) => ({
      label: REGION_LABELS[r],
      data: regionDispatched[idx],
      backgroundColor: months.map((m) =>
        selectedMonth && m.key !== selectedMonth.key ? `${REGION_COLORS[r]}40` : REGION_COLORS[r]
      ),
      borderRadius: 3,
      maxBarThickness: 18,
    })),
  };

  const regionLabel = region === 'ALL' ? 'All regions' : REGION_LABELS[region];
  const filterLabel = `${regionLabel} · ${selectedMonth ? selectedMonth.key : 'All months'}`;
  const generatedLabel = generatedAt
    ? new Date(generatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  const handleMonthClick = (_: any, elements: any[]) => {
    if (!elements.length) return;
    const key = months[elements[0].index]?.key;
    if (key) setMonth((prev) => (prev === key ? 'ALL' : key));
  };

  const lmeChange = lmePrice?.previousCash ? lmePrice.cash - lmePrice.previousCash : null;
  const isInitialLoad = loading && records.length === 0;

  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFC] selection:bg-[#004B87]/15">
      <div className="@container mx-auto flex max-w-[1600px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
        {/* Header and filters */}
        <div className="flex flex-col gap-5">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">CEO Executive Intelligence Overview</h1>
                <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                  C-Suite Access
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Production, pipeline and pricing from the MR11 master ledger
                {generatedLabel ? ` · generated ${generatedLabel}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchDashboardData}
                disabled={loading}
                className={`inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50 cursor-pointer ${FOCUS}`}
              >
                <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => setShowRawData(true)}
                disabled={records.length === 0}
                className={`inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-50 cursor-pointer ${FOCUS}`}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Raw Data
              </button>
            </div>
          </header>

          <div className="flex flex-wrap items-center gap-3">
            <div role="group" aria-label="Region" className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              {(['ALL', ...REGIONS] as RegionFilter[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={region === r}
                  onClick={() => setRegion(r)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${FOCUS} ${
                    region === r ? 'bg-[#004B87] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {r === 'ALL' ? 'All regions' : REGION_LABELS[r]}
                </button>
              ))}
            </div>

            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                id="ceo-month"
                aria-label="Month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className={`appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 cursor-pointer ${FOCUS}`}
              >
                <option value="ALL">All months</option>
                {months.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.key}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            {(region !== 'ALL' || month !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setRegion('ALL');
                  setMonth('ALL');
                }}
                className={`rounded-lg px-2 py-1 text-sm font-medium text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline cursor-pointer ${FOCUS}`}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" />
            <div>
              <p className="font-medium">MR11 data could not be loaded</p>
              <p className="text-rose-700">{error}</p>
              <p className="mt-1 text-rose-700">Try Refresh. If it keeps failing, use Sync on the MR11 page to regenerate MR11.</p>
            </div>
          </div>
        )}

        {isInitialLoad ? (
          <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading dashboard">
            <div className="grid grid-cols-1 gap-6 @5xl:grid-cols-3">
              <div className={`${PANEL} h-[28rem] animate-pulse bg-slate-100/60 @5xl:col-span-2`} />
              <div className={`${PANEL} h-[28rem] animate-pulse bg-slate-100/60`} />
            </div>
            <div className={`${PANEL} h-44 animate-pulse bg-slate-100/60`} />
          </div>
        ) : (
          <>
            {/* Headline: actual vs forecast beside pricing and market */}
            <div className="grid grid-cols-1 gap-6 @5xl:grid-cols-3">
              <section className={`${PANEL} p-5 sm:p-6 @5xl:col-span-2`}>
                <SectionHeading
                  title="Monthly m² · Actual vs Forecast"
                  description={`${regionLabel} · MR11 month columns · click a point to filter by that month`}
                >
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <span className="h-0.5 w-4 rounded" style={{ backgroundColor: ACTUAL_COLOR }} /> Actual
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 border-t-2 border-dashed" style={{ borderColor: FORECAST_COLOR }} /> Forecast
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full border-2 bg-white" style={{ borderColor: FORECAST_COLOR }} />
                      Default {formatNum(DEFAULT_FORECAST_M2)} m²
                    </span>
                  </div>
                </SectionHeading>

                <div className="mt-6 grid grid-cols-1 gap-6 @2xl:grid-cols-3 @2xl:gap-0 @2xl:divide-x @2xl:divide-slate-100">
                  <div className="@2xl:pr-6">
                    <Stat
                      label={`Actual${selectedMonth ? ` · ${selectedMonth.key}` : ''}`}
                      color={ACTUAL_COLOR}
                      value={selectedPoint ? (selectedPoint.kind === 'actual' ? formatNum(selectedPoint.value) : '—') : formatNum(actualTotal)}
                      unit="m²"
                      note={
                        selectedPoint
                          ? selectedPoint.kind === 'actual'
                            ? 'Completed month'
                            : 'Month not completed yet'
                          : lastActual
                          ? `Completed months, ${series[0]?.key} to ${lastActual.key}`
                          : 'No completed months yet'
                      }
                    />
                  </div>
                  <div className="@2xl:px-6">
                    <Stat
                      label={`Forecast${selectedMonth ? ` · ${selectedMonth.key}` : ''}`}
                      color={FORECAST_COLOR}
                      value={selectedPoint ? (selectedPoint.kind === 'forecast' ? formatNum(selectedPoint.value) : '—') : formatNum(forecastTotal)}
                      unit="m²"
                      note={
                        selectedPoint
                          ? selectedPoint.kind === 'actual'
                            ? 'Month completed, see Actual'
                            : selectedPoint.isDefault
                            ? `No forecast entered, default ${formatM2(DEFAULT_FORECAST_M2)}`
                            : 'Forecast entered for this month'
                          : firstForecast && lastForecast
                          ? `${firstForecast.key} to ${lastForecast.key}${defaultedCount > 0 ? ` · ${defaultedCount} at default` : ''}`
                          : 'No upcoming months'
                      }
                    />
                  </div>
                  <div className="@2xl:pl-6">
                    <Stat label="Projects" value={formatNum(projectCount)} note={regionLabel} />
                  </div>
                </div>

                <div className="mt-6 h-72">
                  <Line
                    data={monthlyChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      onClick: handleMonthClick,
                      interaction: { mode: 'index', intersect: false },
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          filter: (ctx: any) => ctx.raw !== null && !(ctx.datasetIndex === 1 && series[ctx.dataIndex]?.kind === 'actual'),
                          callbacks: {
                            label: (ctx: any) => {
                              const p = series[ctx.dataIndex];
                              const kind = p.kind === 'actual' ? 'Actual' : p.isDefault ? 'Forecast (default, none entered)' : 'Forecast';
                              const price = averageSellingPrice(regionRows, months, p.key);
                              const priceMyr = toMyr(price);
                              const usd =
                                price !== null && !p.isDefault
                                  ? ` · avg ${formatUsd(priceMyr)} MYR / ${formatUsd(price)} USD per m² · ≈ ${formatUsd(price * p.value, 0)} USD`
                                  : '';
                              return ` ${kind}: ${formatM2(p.value)}${usd}`;
                            },
                          },
                        },
                      },
                      scales: {
                        x: { grid: { display: false }, border: { display: false } },
                        y: { beginAtZero: true, grid: { color: GRID_COLOR }, border: { display: false }, ticks: axisM2 },
                      },
                    }}
                  />
                </div>
              </section>

              <section className={`${PANEL} flex flex-col p-5 sm:p-6`}>
                <SectionHeading
                  title="Pricing & Market"
                  description={selectedMonth ? `${regionLabel} · ${selectedMonth.key}` : regionLabel}
                />

                <div className="mt-6">
                  <div className="text-xs font-medium text-slate-500">Avg selling price per m²</div>
                  <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono tabular-nums">
                    <span className="whitespace-nowrap text-[1.75rem] leading-none font-semibold tracking-tight text-slate-900">
                      {formatUsd(avgPriceMyr)}
                      <span className="ml-1 text-sm font-medium text-slate-400">MYR</span>
                    </span>
                    <span className="whitespace-nowrap text-base font-semibold text-slate-600">
                      / {formatUsd(avgPriceUsd)}
                      <span className="ml-1 text-xs font-medium text-slate-400">USD</span>
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Final Selling Price (USD) weighted by m², MYR at today's rate</p>
                </div>

                <dl className="mt-6 @5xl:mt-auto divide-y divide-slate-100 border-t border-slate-100 text-sm">
                  <div className="flex items-baseline justify-between gap-3 py-2.5">
                    <dt className="text-slate-500">Contract LME rate</dt>
                    <dd className="font-mono font-medium text-slate-900 tabular-nums">{formatUsd(avgLmeRate)} USD</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 py-2.5">
                    <dt className="text-slate-500">LME adjusted</dt>
                    <dd className="font-mono font-medium text-slate-900 tabular-nums">{formatUsd(avgLmeAdjusted)} USD</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 py-2.5">
                    <dt className="text-slate-500">LME terms</dt>
                    <dd className="text-right font-medium text-slate-900">
                      {lmeTypes.length ? lmeTypes.map((t) => `${t.count} ${t.type}`).join(' · ') : '—'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <dt className="flex items-center gap-2 text-slate-500">
                      Exchange rate {fxRate && <LiveBadge live={fxRate.live} />}
                    </dt>
                    <dd
                      className="font-mono font-medium text-slate-900 tabular-nums"
                      title={fxRate ? `${fxRate.source}${fxRate.asOf ? ` · ${fxRate.asOf}` : ''}` : undefined}
                    >
                      {fxRate ? `1 USD = ${fxRate.rate.toFixed(4)} MYR` : 'Unavailable'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <dt className="flex items-center gap-2 text-slate-500">
                      LME aluminium {lmePrice && <LiveBadge live={lmePrice.live} />}
                    </dt>
                    <dd className="text-right font-mono tabular-nums" title={lmePrice ? `${lmePrice.source} · ${lmePrice.asOf}` : undefined}>
                      {lmePrice ? (
                        <>
                          <span className="font-medium text-slate-900">
                            {lmePrice.cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD/t
                          </span>
                          {lmeChange !== null && (
                            <span className={`block text-xs ${lmeChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {lmeChange >= 0 ? '+' : ''}
                              {lmeChange.toFixed(2)} ({((lmeChange / (lmePrice.previousCash as number)) * 100).toFixed(2)}%)
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="font-medium text-slate-900">Unavailable</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>

            {/* Pipeline: Design -> Processed -> Produced -> Dispatched -> Sailed */}
            <section className={`${PANEL} p-5 sm:p-6`}>
              <SectionHeading
                title="Production Pipeline"
                description={`${filterLabel} · m²${selectedMonth ? ' · each stage counted by its own date column' : ''}`}
              />
              <ol className="mt-6 grid grid-cols-1 gap-x-6 gap-y-6 @lg:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-5">
                {STAGES.map((s, idx) => {
                  const base = totals.design || Math.max(...STAGES.map((x) => totals[x]), 0);
                  const pct = base > 0 ? Math.min(100, (totals[s] / base) * 100) : 0;
                  const prev = idx > 0 ? totals[STAGES[idx - 1]] : 0;
                  return (
                    <li key={s} className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STAGE_COLORS[s] }} />
                        {STAGE_LABELS[s]}
                      </div>
                      <div className="mt-1.5 font-mono text-xl font-semibold tracking-tight text-slate-900 tabular-nums">
                        {formatNum(totals[s])}
                        <span className="ml-1 text-xs font-medium text-slate-400">m²</span>
                      </div>
                      <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: STAGE_COLORS[s] }} />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        {idx === 0
                          ? 'Ordered quantity from Design'
                          : prev > 0
                          ? `${Math.round((totals[s] / prev) * 100)}% of ${STAGE_LABELS[STAGES[idx - 1]].replace('Total ', '').toLowerCase()}`
                          : '—'}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </section>

            {/* Breakdown by region */}
            <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-2">
              <section className={`${PANEL} p-5 sm:p-6`}>
                <SectionHeading
                  title={`Total m² by Region${selectedMonth ? ` · ${selectedMonth.key}` : ''}`}
                  description={`Design, processed, produced, dispatched and sailed${
                    selectedMonth ? ' · counted by each stage’s date in this month' : ''
                  }`}
                />
                <div className="mt-5 h-72">
                  <Bar
                    data={regionChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: chartLegend, tooltip: chartTooltipM2 },
                      scales: {
                        x: { grid: { display: false }, border: { display: false } },
                        y: { grid: { color: GRID_COLOR }, border: { display: false }, ticks: axisM2 },
                      },
                    }}
                  />
                </div>
              </section>

              <section className={`${PANEL} p-5 sm:p-6`}>
                <SectionHeading
                  title="Monthly Dispatched m² by Region"
                  description={`m² out of the warehouse, by date of dispatch${selectedMonth ? ` · ${selectedMonth.key} highlighted` : ''}`}
                />
                <div className="relative mt-5 h-72">
                  <Bar
                    data={regionDispatchData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      onClick: handleMonthClick,
                      plugins: { legend: chartLegend, tooltip: chartTooltipM2 },
                      scales: {
                        x: { stacked: true, grid: { display: false }, border: { display: false } },
                        y: { stacked: true, grid: { color: GRID_COLOR }, border: { display: false }, ticks: axisM2 },
                      },
                    }}
                  />
                  {!regionDispatchedHasData && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <p className="rounded-lg bg-white/90 px-3 py-1.5 text-sm text-slate-500">
                        No dispatches with a dispatch date yet
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </div>

      {/* Raw data: the MR11 ledger, filtered by region */}
      {showRawData && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="MR11 raw data"
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-900/40 p-2 backdrop-blur-[2px] sm:p-6"
        >
          <div className="flex w-full flex-col overflow-hidden rounded-2xl bg-[#F8FAFC] shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-slate-900">MR11 Raw Data</h2>
                <p className="text-xs text-slate-500">
                  {regionLabel} · {regionRows.length} rows
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ZoomControls zoom={rawZoom} setZoom={setRawZoom} min={20} max={135} step={5} />
                <button
                  type="button"
                  onClick={() => setShowRawData(false)}
                  aria-label="Close raw data"
                  className={`rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 cursor-pointer ${FOCUS}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="m-3 flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
              <Mr11Table records={regionRows} headers={headers} headerGroups={headerGroups} numberFormats={numberFormats} zoom={rawZoom} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CeoDashboard;
