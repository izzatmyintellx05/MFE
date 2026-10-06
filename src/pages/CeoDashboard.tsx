import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { ZoomControls } from '../components/common/ZoomControls';
import { Mr11Table, HeaderGroup } from '../components/workbook/Mr11Table';
import { ExchangeRateCard, LmePriceCard, FxRate, LmePrice } from '../components/common/MarketRates';
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
import {
  TrendingUp,
  Building2,
  CheckCircle2,
  CalendarClock,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  X,
  ArrowRight,
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
  lmeTypeCounts,
  monthColumns,
  monthlySeries,
  regionOf,
  stageTotals,
} from '../utils/ceoMetrics';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler, Title, Tooltip, Legend);

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

const formatUsd = (n: number | null, digits = 2) =>
  n === null ? '—' : `${n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const formatM2 = (n: number) => `${Math.round(n).toLocaleString('en-US')} m²`;

const axisM2 = { callback: (v: any) => Number(v).toLocaleString('en-US') };

const chartTooltipM2 = {
  callbacks: {
    label: (ctx: any) => `${ctx.dataset.label}: ${formatM2(ctx.parsed.y ?? 0)}`,
  },
};

export const CeoDashboard: React.FC = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [headerGroups, setHeaderGroups] = useState<HeaderGroup[]>([]);
  const [numberFormats, setNumberFormats] = useState<Record<string, number>>({});
  const [fxRate, setFxRate] = useState<FxRate | null>(null);
  const [lmePrice, setLmePrice] = useState<LmePrice | null>(null);
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
  // Final Selling Price per m², weighted by m²: MYR column (at today's rate) and USD column
  const avgPriceUsd = useMemo(() => averageSellingPrice(regionRows, months, monthKey), [regionRows, months, monthKey]);
  const avgPriceMyr = useMemo(
    () => averageSellingPrice(regionRows, months, monthKey, 'Final Selling Price (MYR)'),
    [regionRows, months, monthKey]
  );
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

  const visibleRegions = region === 'ALL' ? REGIONS : [region];
  const rowsOfRegion = (r: string) => records.filter((row) => regionOf(row) === r);

  const regionStageTotals = visibleRegions.map((r) => stageTotals(rowsOfRegion(r), monthKey));
  const regionDispatched = visibleRegions.map((r) => dispatchedByMonth(rowsOfRegion(r), months));
  const regionDispatchedHasData = regionDispatched.some((values) => values.some((v) => v > 0));

  // Actual line covers completed months; the forecast line starts at the last actual
  // month so the two lines join up
  const lastActualIdx = series.findIndex((p) => p.kind === 'forecast') - 1;
  const pointRadius = (i: number) => (selectedMonth && series[i]?.key === selectedMonth.key ? 7 : 4);
  const monthlyChartData = {
    labels: series.map((p) => p.key),
    datasets: [
      {
        label: 'Actual',
        data: series.map((p) => (p.kind === 'actual' ? p.value : null)),
        borderColor: ACTUAL_COLOR,
        backgroundColor: `${ACTUAL_COLOR}1A`,
        pointBackgroundColor: ACTUAL_COLOR,
        pointRadius: series.map((_, i) => pointRadius(i)),
        fill: true,
        tension: 0.25,
      },
      {
        label: 'Forecast',
        data: series.map((p, i) => (p.kind === 'forecast' || i === lastActualIdx ? p.value : null)),
        borderColor: FORECAST_COLOR,
        backgroundColor: `${FORECAST_COLOR}14`,
        borderDash: [6, 4],
        // Hollow points mark months using the 100,000 m² default
        pointBackgroundColor: series.map((p) => (p.isDefault ? '#FFFFFF' : FORECAST_COLOR)),
        pointBorderColor: FORECAST_COLOR,
        pointRadius: series.map((p, i) => (p.kind === 'forecast' ? pointRadius(i) : 0)),
        fill: true,
        tension: 0.25,
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
      borderRadius: 2,
    })),
  };

  const regionLabel = region === 'ALL' ? 'All regions' : REGION_LABELS[region];
  const filterLabel = `${regionLabel} · ${selectedMonth ? selectedMonth.key : 'All months'}`;

  const handleMonthClick = (_: any, elements: any[]) => {
    if (!elements.length) return;
    const key = months[elements[0].index]?.key;
    if (key) setMonth((prev) => (prev === key ? 'ALL' : key));
  };

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] p-4 sm:p-6 overflow-y-auto select-none">
      {/* Top Deck Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl px-5 py-4 mb-4 shadow-sm flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between flex-shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-sm font-black text-slate-900 tracking-wider uppercase leading-none">
              CEO Executive Intelligence Overview
            </h1>
            <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-widest bg-slate-900 text-amber-300">
              C-Suite Access
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-normal mt-0.5">
            Production, pipeline and actual vs forecast m² derived from the MR11 master ledger.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRawData(true)}
            disabled={records.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Raw Data</span>
          </button>
          <button
            type="button"
            onClick={fetchDashboardData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200/90 rounded-2xl px-5 py-3 mb-4 shadow-sm flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mr-1">Region</span>
          {(['ALL', ...REGIONS] as RegionFilter[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRegion(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                region === r
                  ? 'bg-[#004B87] border-[#004B87] text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {r === 'ALL' ? 'All' : REGION_LABELS[r]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="ceo-month" className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Month
          </label>
          <select
            id="ceo-month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#004B87] cursor-pointer"
          >
            <option value="ALL">All months</option>
            {months.map((m) => (
              <option key={m.key} value={m.key}>
                {m.key}
              </option>
            ))}
          </select>
          {(region !== 'ALL' || month !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setRegion('ALL');
                setMonth('ALL');
              }}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 underline underline-offset-2 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-2.5 rounded-xl mb-4 text-xs font-medium shadow-sm">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">
              Actual m² {selectedMonth ? `· ${selectedMonth.key}` : ''}
            </span>
            <CheckCircle2 className="w-4 h-4 text-[#004B87]" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {selectedPoint ? (selectedPoint.kind === 'actual' ? formatM2(selectedPoint.value) : '—') : formatM2(actualTotal)}
          </div>
          <span className="text-[10px] text-slate-400 mt-1">
            {selectedPoint
              ? selectedPoint.kind === 'actual'
                ? 'Completed month'
                : 'Month not completed yet'
              : lastActual
              ? `Completed months, ${series[0]?.key} to ${lastActual.key}`
              : 'No completed months yet'}
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">
              Forecast m² {selectedMonth ? `· ${selectedMonth.key}` : ''}
            </span>
            <CalendarClock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {selectedPoint ? (selectedPoint.kind === 'forecast' ? formatM2(selectedPoint.value) : '—') : formatM2(forecastTotal)}
          </div>
          <span className="text-[10px] text-slate-400 mt-1">
            {selectedPoint
              ? selectedPoint.kind === 'actual'
                ? 'Month completed, see Actual'
                : selectedPoint.isDefault
                ? `No forecast entered, default ${formatM2(DEFAULT_FORECAST_M2)}`
                : 'Forecast entered for this month'
              : defaultedCount > 0
              ? `Current and upcoming months · ${defaultedCount} use default ${formatM2(DEFAULT_FORECAST_M2)}`
              : 'Current and upcoming months'}
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Projects</span>
            <Building2 className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{projectCount}</div>
          <span className="text-[10px] text-slate-400 mt-1">{regionLabel}</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">
              Avg Selling Price {selectedMonth ? `· ${selectedMonth.key}` : ''}
            </span>
            <TrendingUp className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-lg font-black text-slate-900 font-mono leading-tight">
            <span className="whitespace-nowrap">
              {formatUsd(avgPriceMyr)} <span className="text-xs text-slate-500">MYR</span>
            </span>
            <span className="text-slate-300"> / </span>
            <span className="whitespace-nowrap">
              {formatUsd(avgPriceUsd)} <span className="text-xs text-slate-500">USD</span>
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Per m², Final Selling Price (MYR) and (USD) weighted by m²</span>
        </div>
      </div>

      {/* Market rates and contract LME from MR11 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
        <ExchangeRateCard fxRate={fxRate} className="rounded-2xl" />
        <LmePriceCard lmePrice={lmePrice} className="rounded-2xl" />
        <div className="flex items-center gap-3 bg-white border border-stone-200/80 rounded-2xl px-4 py-2.5 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
              Contract LME (MR11) {selectedMonth ? `· ${selectedMonth.key}` : ''}
            </span>
            <div className="text-sm font-extrabold text-stone-900 font-mono">
              <span className="whitespace-nowrap">Rate {formatUsd(avgLmeRate)}</span>
              <span className="text-stone-300"> · </span>
              <span className="whitespace-nowrap">
                Adjusted {formatUsd(avgLmeAdjusted)} <span className="text-[10px] text-stone-500">USD</span>
              </span>
            </div>
            <div className="text-[10px] text-stone-400 truncate">
              {lmeTypes.length ? lmeTypes.map((t) => `${t.count} ${t.type}`).join(' · ') : 'No projects'} · avg weighted by m²
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline: Design -> Processed -> Produced -> Dispatched -> Sailed */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm mb-4">
        <div className="mb-4">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Production Pipeline (m²)</h2>
          <p className="text-[10px] text-slate-400">
            {filterLabel}
            {selectedMonth ? ' · each stage counted by its own date column' : ''}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {STAGES.map((s, idx) => {
            const base = totals.design || Math.max(...STAGES.map((x) => totals[x]), 0);
            const pct = base > 0 ? Math.min(100, (totals[s] / base) * 100) : 0;
            const prev = idx > 0 ? totals[STAGES[idx - 1]] : 0;
            return (
              <div key={s} className="relative rounded-xl border border-slate-200 p-4 bg-slate-50/60">
                {idx > 0 && (
                  <ArrowRight className="hidden lg:block absolute -left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 bg-white rounded-full" />
                )}
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: STAGE_COLORS[s] }} />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    {STAGE_LABELS[s]}
                  </span>
                </div>
                <div className="text-xl font-black text-slate-900 font-mono">{formatM2(totals[s])}</div>
                <div className="h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: STAGE_COLORS[s] }} />
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {idx === 0
                    ? 'Ordered quantity from Design'
                    : prev > 0
                    ? `${Math.round((totals[s] / prev) * 100)}% of ${STAGE_LABELS[STAGES[idx - 1]].replace('Total ', '').toLowerCase()}`
                    : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actual vs Forecast by month */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm mb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Monthly m² · Actual vs Forecast</h2>
            <p className="text-[10px] text-slate-400">
              {regionLabel} · MR11 month columns · click a point to filter by that month
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-[10px] text-slate-600 font-medium">
              <span className="w-4 h-0.5 rounded" style={{ backgroundColor: ACTUAL_COLOR }} /> Actual
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-slate-600 font-medium">
              <span className="w-4 border-t-2 border-dashed" style={{ borderColor: FORECAST_COLOR }} /> Forecast
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-slate-600 font-medium">
              <span className="w-2.5 h-2.5 rounded-full border-2 bg-white" style={{ borderColor: FORECAST_COLOR }} />
              Default forecast ({Math.round(DEFAULT_FORECAST_M2 / 1000)}k)
            </span>
          </div>
        </div>
        <div className="h-64">
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
                      const priceMyr = averageSellingPrice(regionRows, months, p.key, 'Final Selling Price (MYR)');
                      const usd =
                        price !== null && !p.isDefault
                          ? ` · avg ${formatUsd(priceMyr)} MYR / ${formatUsd(price)} USD per m² · ≈ ${formatUsd(price * p.value, 0)} USD`
                          : '';
                      return `${kind}: ${formatM2(p.value)}${usd}`;
                    },
                  },
                },
              },
              scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, grid: { color: '#F1F5F9' }, ticks: axisM2 },
              },
            }}
          />
        </div>
      </div>

      {/* Breakdown by region */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Total m² by Region {selectedMonth ? `· ${selectedMonth.key}` : ''}
            </h2>
            <p className="text-[10px] text-slate-400">
              Design, processed, produced, dispatched and sailed
              {selectedMonth ? ' · counted by each stage’s date in this month' : ''}
            </p>
          </div>
          <div className="h-64">
            <Bar
              data={regionChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
                  tooltip: chartTooltipM2,
                },
                scales: {
                  x: { grid: { display: false } },
                  y: { grid: { color: '#F1F5F9' }, ticks: axisM2 },
                },
              }}
            />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Monthly Dispatched m² by Region</h2>
            <p className="text-[10px] text-slate-400">
              m² out of the warehouse, by Dispatched Date{selectedMonth ? ` · ${selectedMonth.key} highlighted` : ''}
            </p>
          </div>
          <div className="h-64 relative">
            <Bar
              data={regionDispatchData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                onClick: handleMonthClick,
                plugins: {
                  legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
                  tooltip: chartTooltipM2,
                },
                scales: {
                  x: { stacked: true, grid: { display: false } },
                  y: { stacked: true, grid: { color: '#F1F5F9' }, ticks: axisM2 },
                },
              }}
            />
            {!regionDispatchedHasData && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-xs font-semibold text-slate-400 bg-white/90 px-3 py-1.5 rounded-lg">
                  No dispatches with a Dispatched Date yet
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Raw data: the MR11 ledger, filtered by region */}
      {showRawData && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-stretch justify-center p-2 sm:p-6">
          <div className="flex flex-col w-full bg-[#FAF9F6] rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 bg-white border-b border-stone-200 px-5 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center text-amber-200 flex-shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-extrabold text-stone-900 tracking-tight uppercase truncate">
                    MR11 Raw Data
                  </h2>
                  <p className="text-[11px] text-stone-400">
                    {regionLabel} · {regionRows.length} rows
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ZoomControls zoom={rawZoom} setZoom={setRawZoom} min={20} max={135} step={5} />
                <button
                  type="button"
                  onClick={() => setShowRawData(false)}
                  aria-label="Close raw data"
                  className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 m-3 bg-white border border-stone-200/90 rounded-xl shadow-sm overflow-hidden flex flex-col">
              <Mr11Table records={regionRows} headers={headers} headerGroups={headerGroups} numberFormats={numberFormats} zoom={rawZoom} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CeoDashboard;
