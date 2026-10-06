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
  type ChartType,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import {
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  X,
  CalendarDays,
  ChevronDown,
  ChartSpline,
  Wallet,
  Workflow,
  Globe,
  Truck,
  ArrowRightLeft,
  TrendingUp,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react';
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

// Axis labels in short form: 100000 -> 100k
const compactNum = (v: number) =>
  Math.abs(v) >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e3 ? `${+(v / 1e3).toFixed(1)}k` : `${v}`;
const axisM2 = { callback: (v: any) => compactNum(Number(v)), maxTicksLimit: 6 };

// Vertical fill that fades out towards the axis
const fadeFill = (hex: string, alpha: string) => (ctx: any) => {
  const { chart } = ctx;
  if (!chart.chartArea) return 'transparent';
  const g = chart.ctx.createLinearGradient(0, chart.chartArea.top, 0, chart.chartArea.bottom);
  g.addColorStop(0, `${hex}${alpha}`);
  g.addColorStop(1, `${hex}00`);
  return g;
};

// Dashed "Today" divider between the last actual month and the first forecast month
declare module 'chart.js' {
  interface PluginOptionsByType<TType extends ChartType> {
    todayDivider?: { index?: number };
  }
}

const todayDivider = {
  id: 'todayDivider',
  afterDatasetsDraw(chart: any, _args: any, opts: { index?: number }) {
    const idx = opts?.index;
    const x = chart.scales?.x;
    if (idx === undefined || idx < 0 || !x || idx + 1 >= chart.data.labels.length) return;
    const px = (x.getPixelForValue(idx) + x.getPixelForValue(idx + 1)) / 2;
    const { top, bottom } = chart.chartArea;
    const c = chart.ctx;
    c.save();
    c.strokeStyle = '#94A3B8';
    c.lineWidth = 1;
    c.setLineDash([3, 3]);
    c.beginPath();
    c.moveTo(px, top - 2);
    c.lineTo(px, bottom);
    c.stroke();
    c.setLineDash([]);
    c.font = `600 10px ${ChartJS.defaults.font.family}`;
    c.fillStyle = '#475569';
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.fillText('TODAY', px, top - 16);
    c.restore();
  },
};

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

const SectionHeading: React.FC<{
  title: string;
  icon?: LucideIcon;
  description?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ title, icon: Icon, description, children }) => (
  <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
    <div className="flex min-w-0 items-start gap-3">
      {Icon && (
        <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-[#004B87]/[0.07] text-[#004B87]" aria-hidden="true">
          <Icon className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
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
      {unit && value !== '—' && <span className="ml-1.5 text-sm font-medium text-slate-500">{unit}</span>}
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
        backgroundColor: fadeFill(ACTUAL_COLOR, '2E'),
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
        backgroundColor: fadeFill(FORECAST_COLOR, '1F'),
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
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
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
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
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
          <div className="ceo-fade-up flex flex-col gap-6">
            {/* Headline: actual vs forecast beside pricing and market */}
            <div className="grid grid-cols-1 gap-6 @5xl:grid-cols-3">
              <section className={`${PANEL} p-5 sm:p-6 @5xl:col-span-2`}>
                <SectionHeading
                  title="Monthly m² · Actual vs Forecast"
                  icon={ChartSpline}
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
                    plugins={[todayDivider]}
                    role="img"
                    aria-label={`Monthly m² line chart for ${regionLabel}: actual ${formatM2(actualTotal)}${
                      lastActual ? ` up to ${lastActual.key}` : ''
                    }, forecast ${formatM2(forecastTotal)}${firstForecast ? ` from ${firstForecast.key}` : ''}`}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      onClick: handleMonthClick,
                      interaction: { mode: 'index', intersect: false },
                      layout: { padding: { top: 18 } },
                      plugins: {
                        todayDivider: { index: lastActualIdx },
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
                  icon={Wallet}
                  description={selectedMonth ? `${regionLabel} · ${selectedMonth.key}` : regionLabel}
                />

                <div className="mt-6 rounded-xl bg-[#004B87]/[0.04] p-4 ring-1 ring-[#004B87]/10">
                  <div className="text-xs font-medium text-slate-600">Avg selling price per m²</div>
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono tabular-nums">
                    <span className="whitespace-nowrap text-[1.75rem] leading-none font-semibold tracking-tight text-slate-900">
                      {formatUsd(avgPriceMyr)}
                      <span className="ml-1 text-sm font-medium text-slate-500">MYR</span>
                    </span>
                    <span className="whitespace-nowrap text-base font-semibold text-slate-600">
                      / {formatUsd(avgPriceUsd)}
                      <span className="ml-1 text-xs font-medium text-slate-500">USD</span>
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">Final Selling Price (USD) weighted by m², MYR at today's rate</p>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 @lg:grid-cols-2 @5xl:mt-auto @5xl:grid-cols-1 @5xl:pt-4">
                  <div
                    className="rounded-xl border border-slate-200/80 p-3.5"
                    title={fxRate ? `${fxRate.source}${fxRate.asOf ? ` · ${fxRate.asOf}` : ''}` : undefined}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        USD to MYR
                      </span>
                      {fxRate && <LiveBadge live={fxRate.live} />}
                    </div>
                    <div className="mt-2 font-mono text-lg font-semibold text-slate-900 tabular-nums">
                      {fxRate ? fxRate.rate.toFixed(4) : '—'}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {fxRate ? `Exchange rate · ${fxRate.asOf || fxRate.source}` : 'Exchange rate unavailable'}
                    </p>
                  </div>

                  <div
                    className="rounded-xl border border-slate-200/80 p-3.5"
                    title={lmePrice ? `${lmePrice.source} · ${lmePrice.asOf}` : undefined}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        {lmeChange !== null && lmeChange < 0 ? (
                          <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        LME aluminium
                      </span>
                      {lmePrice && <LiveBadge live={lmePrice.live} />}
                    </div>
                    <div className="mt-2 font-mono text-lg font-semibold text-slate-900 tabular-nums">
                      {lmePrice
                        ? lmePrice.cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : '—'}
                      {lmePrice && <span className="ml-1 text-xs font-medium text-slate-500">USD/t</span>}
                    </div>
                    <p
                      className={`mt-0.5 truncate font-mono text-xs tabular-nums ${
                        lmeChange === null ? 'text-slate-500' : lmeChange >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {lmeChange !== null && lmePrice?.previousCash
                        ? `${lmeChange >= 0 ? '+' : ''}${lmeChange.toFixed(2)} (${((lmeChange / lmePrice.previousCash) * 100).toFixed(2)}%)`
                        : lmePrice
                        ? `Cash · ${lmePrice.asOf}`
                        : 'LME price unavailable'}
                    </p>
                  </div>
                </div>
              </section>
            </div>

            {/* Pipeline: Design -> Processed -> Produced -> Dispatched -> Sailed */}
            <section className={`${PANEL} p-5 sm:p-6`}>
              <SectionHeading
                title="Production Pipeline"
                icon={Workflow}
                description={`${filterLabel} · m²${selectedMonth ? ' · each stage counted by its own date column' : ''}`}
              />
              <ol className="mt-6 grid grid-cols-1 gap-x-4 gap-y-6 @lg:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-5">
                {STAGES.map((s, idx) => {
                  const base = totals.design || Math.max(...STAGES.map((x) => totals[x]), 0);
                  const pct = base > 0 ? Math.min(100, (totals[s] / base) * 100) : 0;
                  const prev = idx > 0 ? totals[STAGES[idx - 1]] : 0;
                  const next = STAGES[idx + 1];
                  const conversion = next && totals[s] > 0 ? `${Math.round((totals[next] / totals[s]) * 100)}%` : '—';
                  return (
                    <li key={s} className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-white"
                          style={{ boxShadow: `0 0 0 2px ${STAGE_COLORS[s]}` }}
                          aria-hidden="true"
                        >
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STAGE_COLORS[s] }} />
                        </span>
                        {next && (
                          <span className="hidden min-w-0 flex-1 items-center gap-1.5 @4xl:flex" aria-hidden="true">
                            <span className="h-px flex-1 bg-slate-200" />
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-600 tabular-nums">
                              {conversion}
                            </span>
                            <span className="h-px flex-1 bg-slate-200" />
                          </span>
                        )}
                      </div>
                      <div className="mt-3 text-xs font-medium text-slate-500">{STAGE_LABELS[s]}</div>
                      <div className="mt-1 font-mono text-xl font-semibold tracking-tight text-slate-900 tabular-nums">
                        {formatNum(totals[s])}
                        <span className="ml-1 text-xs font-medium text-slate-500">m²</span>
                      </div>
                      <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full transition-[width] duration-300"
                          style={{ width: `${pct}%`, backgroundColor: STAGE_COLORS[s] }}
                        />
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
                  icon={Globe}
                  description={`Design, processed, produced, dispatched and sailed${
                    selectedMonth ? ' · counted by each stage’s date in this month' : ''
                  }`}
                />
                <div className="mt-5 h-72">
                  <Bar
                    data={regionChartData}
                    role="img"
                    aria-label={`Bar chart of m² by stage for ${visibleRegions.map((r) => REGION_LABELS[r]).join(', ')}`}
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
                  icon={Truck}
                  description={`m² out of the warehouse, by date of dispatch${selectedMonth ? ` · ${selectedMonth.key} highlighted` : ''}`}
                />
                <div className="relative mt-5 h-72">
                  <Bar
                    data={regionDispatchData}
                    role="img"
                    aria-label={`Stacked bar chart of dispatched m² per month for ${visibleRegions.map((r) => REGION_LABELS[r]).join(', ')}`}
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
          </div>
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
