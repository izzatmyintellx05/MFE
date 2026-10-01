import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { DollarSign, Layers, CheckCircle2, TrendingUp } from 'lucide-react';

export const VisualizationDashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.get('/visualization').then((res) => setData(res.data.data));
  }, []);

  const kpi = data?.kpi || { totalProjects: 0, totalSellingUSD: 0, totalOrderedM2: 0, totalProduced: 0 };
  const designStatusCounts = data?.designStatusCounts || {};
  const streamDistribution = data?.streamDistribution || {};

  return (
    <div className="flex flex-col h-full bg-slate-50 p-6 overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">EXECUTIVE VISUALIZATION DASHBOARD</h1>
        <p className="text-xs text-slate-500 font-medium">Derived Business Analytics from Live Departmental Workbooks</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Total Active Projects</p>
            <p className="text-2xl font-black text-slate-900">{kpi.totalProjects}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Total Selling Value</p>
            <p className="text-2xl font-black text-slate-900">${kpi.totalSellingUSD.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Ordered Area (M²)</p>
            <p className="text-2xl font-black text-slate-900">{kpi.totalOrderedM2.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Produced Area (M²)</p>
            <p className="text-2xl font-black text-slate-900">{kpi.totalProduced.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-4">Design Status Breakdown</h2>
          <div className="space-y-3">
            {Object.entries(designStatusCounts).map(([status, count]) => (
              <div key={status} className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-sm font-medium text-slate-700">{status}</span>
                <span className="px-3 py-1 bg-slate-100 text-slate-900 font-bold rounded-lg text-xs">{count as number}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-4">Stream Distribution</h2>
          <div className="space-y-3">
            {Object.entries(streamDistribution).map(([stream, count]) => (
              <div key={stream} className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-sm font-medium text-slate-700">{stream}</span>
                <span className="px-3 py-1 bg-slate-100 text-slate-900 font-bold rounded-lg text-xs">{count as number}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};