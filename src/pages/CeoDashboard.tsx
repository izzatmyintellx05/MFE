import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  TrendingUp,
  Building2,
  Layers,
  CheckCircle2,
  RefreshCw,
  PieChart as PieChartIcon,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export const CeoDashboard: React.FC = () => {
  const [mr11Data, setMr11Data] = useState<any>(null);
  const [planningSeries, setPlanningSeries] = useState<any[]>([]);
  const [productionSeries, setProductionSeries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mr11Res, planningRes, productionRes] = await Promise.allSettled([
        api.get('/mr11'),
        api.get('/mr11/planning-series'),
        api.get('/mr11/production-series'),
      ]);

      if (mr11Res.status === 'fulfilled') {
        setMr11Data(mr11Res.value.data?.data || mr11Res.value.data || null);
      }

      if (planningRes.status === 'fulfilled') {
        const pData = planningRes.value.data?.data || planningRes.value.data || [];
        setPlanningSeries(Array.isArray(pData) ? pData : []);
      }

      if (productionRes.status === 'fulfilled') {
        const prData = productionRes.value.data?.data || productionRes.value.data || [];
        setProductionSeries(Array.isArray(prData) ? prData : []);
      }
    } catch (err: any) {
      console.error('Failed to load CEO telemetry:', err);
      setError(err.response?.data?.error?.message || err.message || 'Failed to load executive telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Normalise MR11 rows whether stored in sheets, parsedWorkbook, or flat row array
  const extractedRows = useMemo(() => {
    if (!mr11Data) return [];
    if (Array.isArray(mr11Data)) return mr11Data;
    if (Array.isArray(mr11Data.rows)) return mr11Data.rows;
    if (Array.isArray(mr11Data.parsedWorkbook)) return mr11Data.parsedWorkbook;
    if (Array.isArray(mr11Data.sheets?.[0]?.data)) return mr11Data.sheets[0].data;
    if (Array.isArray(mr11Data.activeVersion?.parsedWorkbook)) return mr11Data.activeVersion.parsedWorkbook;
    return [];
  }, [mr11Data]);

  // Aggregate Key Performance Indicators
  const kpis = useMemo(() => {
    const totalProjects = Math.max(
      extractedRows.length,
      planningSeries.length,
      productionSeries.length
    );

    // Cumulative planned surface area from Planning Series
    const totalPlannedArea = planningSeries.reduce(
      (acc, item) => acc + (Number(item.totalProcessed) || Number(item.totalQuantity) || 0),
      0
    );

    // Cumulative produced surface area from Production Series
    const totalProducedArea = productionSeries.reduce(
      (acc, item) => acc + (Number(item.totalProduced) || 0),
      0
    );

    // Target contract volume
    const totalTargetVolume = planningSeries.reduce(
      (acc, item) => acc + (Number(item.totalQuantity) || 0),
      0
    );

    const completionRate =
      totalPlannedArea > 0
        ? Math.min(100, Math.round((totalProducedArea / totalPlannedArea) * 100))
        : 0;

    return {
      totalProjects,
      totalTargetVolume,
      totalPlannedArea,
      totalProducedArea,
      completionRate,
    };
  }, [extractedRows, planningSeries, productionSeries]);

  // Chart 1: Top Contract Series Comparison (Planned vs Produced)
  const seriesComparisonData = useMemo(() => {
    // Map projects by contract / shortcode
    const map = new Map<string, { label: string; planned: number; produced: number }>();

    planningSeries.forEach((p) => {
      const key = p.projectShortname || p.projectNo || 'Project';
      const existing = map.get(key) || { label: key, planned: 0, produced: 0 };
      existing.planned += Number(p.totalProcessed) || 0;
      map.set(key, existing);
    });

    productionSeries.forEach((pr) => {
      const key = pr.projectShortname || pr.projectNo || 'Project';
      const existing = map.get(key) || { label: key, planned: 0, produced: 0 };
      existing.produced += Number(pr.totalProduced) || 0;
      map.set(key, existing);
    });

    const entries = Array.from(map.values()).slice(0, 8);
    const labels = entries.length > 0 ? entries.map((e) => e.label) : ['No Data'];
    const planned = entries.length > 0 ? entries.map((e) => e.planned) : [0];
    const produced = entries.length > 0 ? entries.map((e) => e.produced) : [0];

    return {
      labels,
      datasets: [
        {
          label: 'Planned Area (m²)',
          data: planned,
          backgroundColor: '#004B87', // Doka/MFE Deep Blue
          borderRadius: 6,
        },
        {
          label: 'Produced Area (m²)',
          data: produced,
          backgroundColor: '#FFDA00', // Doka Yellow
          borderRadius: 6,
        },
      ],
    };
  }, [planningSeries, productionSeries]);

  // Chart 2: Factory Stream Allocation
  const streamData = useMemo(() => {
    const counts: Record<string, number> = { 'Stream 1': 0, 'Stream 2': 0, 'Stream 3': 0, 'Stream 4': 0 };

    [...planningSeries, ...productionSeries].forEach((item) => {
      const s = `Stream ${item.stream || 1}`;
      if (counts[s] !== undefined) counts[s] += 1;
    });

    const values = Object.values(counts);
    const hasData = values.some((v) => v > 0);

    return {
      labels: ['Stream 1', 'Stream 2', 'Stream 3', 'Stream 4'],
      datasets: [
        {
          data: hasData ? values : [1, 1, 1, 1],
          backgroundColor: ['#004B87', '#FFDA00', '#0F172A', '#38BDF8'],
          borderColor: '#FFFFFF',
          borderWidth: 2,
        },
      ],
    };
  }, [planningSeries, productionSeries]);

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] p-6 overflow-y-auto select-none">
      {/* Top Deck Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl px-6 py-4 mb-6 shadow-sm flex items-center justify-between flex-shrink-0">
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
            Real-time visual telemetry, project throughput, and production yields derived from the MR11 master ledger.
          </p>
        </div>

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

      {error && (
        <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-2.5 rounded-xl mb-6 text-xs font-medium shadow-sm">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Active Contracts</span>
            <Building2 className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {kpis.totalProjects}
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Monitored project series</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Target Contract Volume</span>
            <Layers className="w-4 h-4 text-[#004B87]" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {kpis.totalTargetVolume > 0 ? `${kpis.totalTargetVolume.toLocaleString()} m²` : '—'}
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Contract target surface area</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Production Output</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {kpis.totalProducedArea.toLocaleString()} m²
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold mt-1">Actual plant output recorded</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Execution Index</span>
            <CheckCircle2 className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {kpis.completionRate}%
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Produced vs. Planned yield</span>
        </div>
      </div>

      {/* Main Graph Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart: Planned vs Produced Area */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Production Fulfillment by Key Contracts (m²)
              </h2>
              <p className="text-[10px] text-slate-400">Comparing Planning (Col AO) vs Production (Col AQ)</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[10px] text-slate-600 font-medium">
                <span className="w-2.5 h-2.5 rounded bg-[#004B87]" /> Planned
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-slate-600 font-medium">
                <span className="w-2.5 h-2.5 rounded bg-[#FFDA00]" /> Produced
              </span>
            </div>
          </div>
          <div className="h-64">
            <Bar
              data={seriesComparisonData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { grid: { display: false } },
                  y: { grid: { color: '#F1F5F9' } },
                },
              }}
            />
          </div>
        </div>

        {/* Doughnut Chart: Factory Stream Load */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Manufacturing Stream Load
              </h2>
              <p className="text-[10px] text-slate-400">Active series distribution across factory streams</p>
            </div>
            <PieChartIcon className="w-4 h-4 text-slate-400" />
          </div>
          <div className="h-64 flex items-center justify-center">
            <Doughnut
              data={streamData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: { boxWidth: 10, font: { size: 10 } },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CeoDashboard;