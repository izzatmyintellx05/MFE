import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { HighFidelityViewer } from '../components/workbook/HighFidelityViewer';
import { ZoomControls } from '../components/common/ZoomControls';
import { Upload, History, FileSpreadsheet } from 'lucide-react';

export const ProductionPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sheet' | 'series'>('sheet');
  const [workbookData, setWorkbookData] = useState<any[]>([]);
  const [seriesList, setSeriesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [zoom, setZoom] = useState<number>(100);

  const fetchDepartmentData = async () => {
    setLoading(true);
    try {
      const deptRes = await api.get('/departments/PRODUCTION');
      setWorkbookData(deptRes.data.data?.activeVersion?.parsedWorkbook || []);

      const seriesRes = await api.get('/mr11/production-series');
      setSeriesList(seriesRes.data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartmentData();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post('/departments/PRODUCTION/upload', formData);
      await fetchDepartmentData();
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const cumulativeTotal = seriesList.reduce((acc, s) => acc + (s.totalProduced || 0), 0);

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] p-5 overflow-hidden select-none">
      {/* Top Header Deck */}
      <div className="luxury-deck rounded-xl px-5 py-3 mb-3 flex items-center justify-between flex-shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xs font-black text-slate-900 tracking-wider uppercase leading-none">
              Production
            </h1>
            <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-widest bg-slate-100 text-slate-700 border border-slate-200">
              {seriesList.length} Series Phases
            </span>
            <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider bg-amber-50 text-amber-900 border border-amber-200">
              Cumulative Yield: {cumulativeTotal.toLocaleString()} m²
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-normal mt-0.5">
            Integrates Column Q outputs and chronological daily timestamps (Cols R-AV)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ZoomControls zoom={zoom} setZoom={setZoom} min={75} max={135} step={5} />

          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('sheet')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === 'sheet'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Active Sheet
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('series')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === 'series'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Production Series
            </button>
          </div>

          <label className="luxury-btn-black flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer">
            <Upload className={`w-3.5 h-3.5 ${uploading ? 'animate-spin' : ''}`} />
            {uploading ? 'Processing...' : 'Upload & Sync'}
            <input type="file" accept=".xlsx" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* Main Container */}
      <div className="luxury-deck flex-1 rounded-xl overflow-hidden flex flex-col">
        {activeTab === 'sheet' ? (
          <div
            className="flex-1 overflow-hidden"
            style={{ zoom: `${zoom}%`, transformOrigin: 'top left' }}
          >
            <HighFidelityViewer data={workbookData} />
          </div>
        ) : (
          <div className="overflow-auto flex-1 h-full p-6">
            <div
              style={{ zoom: `${zoom}%`, transformOrigin: 'top left' }}
              className="inline-block min-w-full"
            >
              <div className="mb-4">
                <h2 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.16em]">
                  Production Series Registry
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Historical sequence production figures contributing to MR11 Column AQ master metrics
                </p>
              </div>

              <table className="w-full text-left border-collapse border border-slate-200/80 text-xs">
                <thead className="bg-[#FAF9F6] text-slate-500 text-[9px] font-bold uppercase tracking-[0.12em] sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 border-r border-slate-200/60">Shortcode</th>
                    <th className="py-2.5 px-3 border-r border-slate-200/60">Customer & Project Name</th>
                    <th className="py-2.5 px-3 border-r border-slate-200/60 text-center">Stream</th>
                    <th className="py-2.5 px-3 border-r border-slate-200/60">Signature Color</th>
                    <th className="py-2.5 px-3 border-r border-slate-200/60 text-center">Series</th>
                    <th className="py-2.5 px-3 border-r border-slate-200/60 text-right">Produced (Col Q)</th>
                    <th className="py-2.5 px-3 border-r border-slate-200/60">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {seriesList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        No production series recorded yet.
                      </td>
                    </tr>
                  ) : (
                    seriesList.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-2 px-3 border-r border-slate-200/60 font-mono font-bold text-slate-900">
                          {item.projectShortname}
                        </td>
                        <td
                          className="py-2 px-3 border-r border-slate-200/60 font-medium"
                          style={{ color: item.fontColor !== '#000000' ? item.fontColor : undefined }}
                        >
                          {item.projectName || item.projectShortname}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200/60 text-center font-bold text-slate-900">
                          Stream {item.stream}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200/60">
                          <span className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full ring-1 ring-slate-300"
                              style={{ backgroundColor: item.fontColor || '#000000' }}
                            />
                            <span className="font-mono text-[11px] text-slate-400">{item.fontColor}</span>
                          </span>
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200/60 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                            Series {item.seriesNumber}
                          </span>
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200/60 text-right font-mono font-bold text-slate-950">
                          {item.totalProduced?.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200/60 text-slate-400 font-mono text-[11px]">
                          {new Date(item.updatedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};