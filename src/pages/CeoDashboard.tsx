import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { ZoomControls } from '../components/common/ZoomControls';
import { Mr11Table, HeaderGroup } from '../components/workbook/Mr11Table';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
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
  filterByRegion,
  firstRowPerProject,
  monthColumns,
  monthlySeries,
  monthValue,
  projectBreakdown,
  regionOf,
  stageTotals,
} from '../utils/ceoMetrics';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

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
const FORECAST_COLOR = '#FFDA00';
const DEFAULT_FORECAST_COLOR = '#FEF3C7';

const formatUsd = (n: number | null, digits = 2) =>
  n === null ? '—' : `${n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const formatM2 = (n: number) => `${Math.round(n).toLocaleString('en-US')} m²`;

const chartTooltipM2 = {
  callbacks: {
    label: (ctx: any) => `${ctx.dataset.label}: ${formatM2(ctx.parsed.x ?? ctx.parsed.y ?? 0)}`,
  },
};

export const CeoDashboard: React.FC = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [headerGroups, setHeaderGroups] = useState<HeaderGroup[]>([]);
  const [numberFormats, setNumberFormats] = useState<Record<string, number>>({});
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

  const regionRows = useMemo(() => filterByRegion(records, region), [records, region]);
  const totals = useMemo(() => stageTotals(regionRows, selectedMonth?.key ?? null), [regionRows, selectedMonth]);
  const series = useMemo(() => monthlySeries(regionRows, months, today), [regionRows, months, today]);
  const selectedPoint = selectedMonth ? series.find((p) => p.key === selectedMonth.key) || null : null;
  const projectCount = useMemo(() => firstRowPerProject(regionRows).length, [regionRows]);
  const avgPrice = useMemo(
    () => averageSellingPrice(regionRows, months, selectedMonth?.key ?? null),
    [regionRows, months, selectedMonth]
  );

  const actualTotal = series.filter((p) => p.kind === 'actual').reduce((a, p) => a + p.value, 0);
  const forecastTotal = series.filter((p) => p.kind === 'forecast').reduce((a, p) => a + p.value, 0);
  const defaultedCount = series.filter((p) => p.isDefault).length;

  const projects = useMemo(
    () =>
      projectBreakdown(regionRows, selectedMonth?.key ?? null).filter(
        (p) => p.month > 0 || STAGES.some((s) => p.stages[s] > 0)
      ),
    [regionRows, selectedMonth]
  );

  const visibleRegions = region === 'ALL' ? REGIONS : [region];

  const regionStageTotals = useMemo(
    () => visibleRegions.map((r) => stageTotals(records.filter((row) => regionOf(row) === r), null)),
    [records, region]
  );

  // Monthly chart: completed months are actual, the rest forecast (default when empty)
  const monthlyChartData = {
    labels: series.map((p) => p.key),
    datasets: [
      {
        label: 'm²',
        data: series.map((p) => p.value),
        backgroundColor: series.map((p) => {
          const base = p.kind === 'actual' ? ACTUAL_COLOR : p.isDefault ? DEFAULT_FORECAST_COLOR : FORECAST_COLOR;
          return selectedMonth && p.key !== selectedMonth.key ? `${base}55` : base;
        }),
        borderColor: series.map((p) => (p.isDefault ? '#F59E0B' : 'transparent')),
        borderWidth: series.map((p) => (p.isDefault ? 1 : 0)),
        borderRadius: 4,
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

  const regionMonthlyData = {
    labels: months.map((m) => m.key),
    datasets: visibleRegions.map((r) => ({
      label: REGION_LABELS[r],
      data: months.map((m) => monthValue(records.filter((row) => regionOf(row) === r), m.key)),
      backgroundColor: REGION_COLORS[r],
      borderRadius: 2,
    })),
  };
  const regionMonthlyHasData = regionMonthlyData.datasets.some((d) => d.data.some((v) => v > 0));

  const projectChartData = {
    labels: projects.map((p) => p.label),
    datasets: [
      {
        label: selectedPoint ? `${selectedPoint.kind === 'actual' ? 'Actual' : 'Forecast'} m² (${selectedPoint.key})` : 'Monthly m²',
        data: projects.map((p) => p.month),
        backgroundColor: selectedPoint?.kind === 'actual' ? ACTUAL_COLOR : FORECAST_COLOR,
        borderRadius: 3,
      },
      ...STAGES.map((s) => ({
        label: STAGE_LABELS[s],
        data: projects.map((p) => p.stages[s]),
        backgroundColor: STAGE_COLORS[s],
        borderRadius: 3,
      })),
    ],
  };

  const filterLabel = `${region === 'ALL' ? 'All regions' : REGION_LABELS[region]} · ${
    selectedMonth ? selectedMonth.key : 'All months'
  }`;

  const handleMonthBarClick = (_: any, elements: any[]) => {
    if (!elements.length) return;
    const key = series[elements[0].index]?.key;
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">
              Total m² Produced {selectedMonth ? `· ${selectedMonth.key}` : ''}
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{formatM2(totals.produced)}</div>
          <span className="text-[10px] text-slate-400 mt-1">
            {selectedMonth ? 'Produced Date in this month' : 'Overall, MR11 Total Produced'}
          </span>
        </div>

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
            {selectedPoint && selectedPoint.kind !== 'actual'
              ? 'Month not completed yet'
              : 'Completed months'}
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
                : 'Remaining month forecast'
              : defaultedCount > 0
              ? `${defaultedCount} month(s) use default ${formatM2(DEFAULT_FORECAST_M2)}`
              : 'Remaining months'}
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Projects</span>
            <Building2 className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{projectCount}</div>
          <span className="text-[10px] text-slate-400 mt-1">{filterLabel}</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">
              Avg Selling Price {selectedMonth ? `· ${selectedMonth.key}` : ''}
            </span>
            <TrendingUp className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{formatUsd(avgPrice)}</div>
          <span className="text-[10px] text-slate-400 mt-1">USD per m², Final Selling Price weighted by m²</span>
        </div>
      </div>

      {/* Pipeline: Design -> Processed -> Produced -> Dispatched */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Production Pipeline (m²)</h2>
            <p className="text-[10px] text-slate-400">
              {filterLabel}
              {selectedMonth ? ' · each stage counted by its own date column' : ''}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {STAGES.map((s, idx) => {
            const base = totals.design || Math.max(...STAGES.map((x) => totals[x]), 0);
            const pct = base > 0 ? Math.min(100, (totals[s] / base) * 100) : 0;
            const prev = idx > 0 ? totals[STAGES[idx - 1]] : 0;
            return (
              <div key={s} className="relative rounded-xl border border-slate-200 p-4 bg-slate-50/60">
                {idx > 0 && (
                  <ArrowRight className="hidden md:block absolute -left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 bg-white rounded-full" />
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
              {region === 'ALL' ? 'All regions' : REGION_LABELS[region]} · click a bar to filter by that month
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-[10px] text-slate-600 font-medium">
              <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: ACTUAL_COLOR }} /> Actual
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-slate-600 font-medium">
              <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: FORECAST_COLOR }} /> Forecast
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-slate-600 font-medium">
              <span
                className="w-2.5 h-2.5 rounded border border-dashed border-amber-500"
                style={{ backgroundColor: DEFAULT_FORECAST_COLOR }}
              />
              Default forecast ({Math.round(DEFAULT_FORECAST_M2 / 1000)}k)
            </span>
          </div>
        </div>
        <div className="h-64">
          <Bar
            data={monthlyChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              onClick: handleMonthBarClick,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx: any) => {
                      const p = series[ctx.dataIndex];
                      const kind = p.kind === 'actual' ? 'Actual' : p.isDefault ? 'Forecast (default, none entered)' : 'Forecast';
                      const price = averageSellingPrice(regionRows, months, p.key);
                      const usd = price !== null && !p.isDefault ? ` · avg ${formatUsd(price)}/m² · ≈ ${formatUsd(price * p.value, 0)}` : '';
                      return `${kind}: ${formatM2(p.value)}${usd}`;
                    },
                  },
                },
              },
              scales: {
                x: { grid: { display: false } },
                y: { grid: { color: '#F1F5F9' }, ticks: { callback: (v: any) => Number(v).toLocaleString('en-US') } },
              },
            }}
          />
        </div>
      </div>

      {/* Breakdown: by project for a month, otherwise by region */}
      {selectedMonth ? (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Breakdown by Project · {selectedMonth.key}
            </h2>
            <p className="text-[10px] text-slate-400">
              {region === 'ALL' ? 'All regions' : REGION_LABELS[region]} · monthly m² and pipeline quantities dated in this month
            </p>
          </div>
          {projects.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-slate-400">
              <FileSpreadsheet className="w-8 h-8 stroke-1 mb-2 text-slate-300" />
              <p className="text-xs font-semibold text-slate-500">No project activity recorded in {selectedMonth.key}</p>
            </div>
          ) : (
            <div style={{ height: Math.max(220, projects.length * 70) }}>
              <Bar
                data={projectChartData}
                options={{
                  indexAxis: 'y',
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
                    tooltip: chartTooltipM2,
                  },
                  scales: {
                    x: { grid: { color: '#F1F5F9' }, ticks: { callback: (v: any) => Number(v).toLocaleString('en-US') } },
                    y: { grid: { display: false }, ticks: { font: { size: 10 } } },
                  },
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
            <div className="mb-4">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Total m² by Region</h2>
              <p className="text-[10px] text-slate-400">Design, processed, produced and dispatched per region</p>
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
                    y: { grid: { color: '#F1F5F9' }, ticks: { callback: (v: any) => Number(v).toLocaleString('en-US') } },
                  },
                }}
              />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
            <div className="mb-4">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Monthly m² by Region</h2>
              <p className="text-[10px] text-slate-400">Entered monthly values (Jan-26 to Dec-27), stacked by region</p>
            </div>
            <div className="h-64 relative">
              <Bar
                data={regionMonthlyData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
                    tooltip: chartTooltipM2,
                  },
                  scales: {
                    x: { stacked: true, grid: { display: false } },
                    y: { stacked: true, grid: { color: '#F1F5F9' }, ticks: { callback: (v: any) => Number(v).toLocaleString('en-US') } },
                  },
                }}
              />
              {!regionMonthlyHasData && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-xs font-semibold text-slate-400 bg-white/90 px-3 py-1.5 rounded-lg">
                    No monthly m² entered in MR11 yet
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
                    {region === 'ALL' ? 'All regions' : REGION_LABELS[region]} · {regionRows.length} rows
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ZoomControls zoom={rawZoom} setZoom={setRawZoom} min={70} max={135} step={5} />
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
