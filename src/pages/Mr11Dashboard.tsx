import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { ZoomControls } from '../components/common/ZoomControls';
import { 
  FileSpreadsheet, 
  Download, 
  RefreshCw, 
  AlertTriangle, 
  Search 
} from 'lucide-react';

const STREAM_MERGE_COLUMNS = [
  'Shell Plan Status - Pending Consultant Drawings',
  'Shell Plan Approved Date',
  'Formwork Design Status',
  'Actual Formwork Order Completion Date',
  'Total Quantity Ordered m2',
];

export const Mr11Dashboard: React.FC = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(100);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchMr11Data = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/mr11');
      const data = res.data?.data;
      setRecords(data?.run?.records || []);
      setHeaders(data?.orderedHeaders || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to fetch MR11 records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMr11Data();
  }, []);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await api.post('/mr11/regenerate');
      await fetchMr11Data();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Regeneration failed');
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = () => {
    window.open(`${api.defaults.baseURL}/mr11/export`, '_blank');
  };

  const isStreamMergeColumn = (colHeader: string) => {
    return STREAM_MERGE_COLUMNS.some(
      (c) => c === colHeader || colHeader.toLowerCase().startsWith(c.toLowerCase())
    );
  };

  const isAtdColumn = (colHeader: string) => {
    const clean = String(colHeader || '').toLowerCase().trim();
    return clean === 'atd' || clean.includes('atd') || clean.includes('actual time of departure');
  };

  const filteredRecords = records.filter((r) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const projNo = String(r['Project No'] || r['Project No.'] || '').toLowerCase();
    const projName = String(r['Customer & Project Name'] || r['Project Name'] || '').toLowerCase();
    const shortName = String(r['Short Name'] || r['Project Shortname'] || '').toLowerCase();
    return projNo.includes(term) || projName.includes(term) || shortName.includes(term);
  });

  return (
    <div className="flex flex-col h-full bg-[#FAF9F6] p-5 overflow-hidden select-none">
      {/* Top Header Card */}
      <div className="flex items-center justify-between bg-white border border-stone-200/80 rounded-xl px-5 py-3.5 shadow-sm mb-3.5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center text-amber-200">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-sm font-extrabold text-stone-900 tracking-tight uppercase">
                MR11 Master Operations Ledger
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-stone-100 text-stone-700">
                {records.length} Contracts
              </span>
            </div>
            <p className="text-[11px] text-stone-400 mt-0.5">
              Production, dispatch milestones & fulfillment schedule
            </p>
          </div>
        </div>

        {/* Clean Action Controls & Zoom Bar */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search contracts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-44 px-2.5 py-1.5 pl-7 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-900 focus:bg-white transition"
            />
            <Search className="w-3 h-3 text-stone-400 absolute left-2.5 top-2.5" />
          </div>

          <ZoomControls zoom={zoom} setZoom={setZoom} min={70} max={135} step={5} />

          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-stone-500 ${regenerating ? 'animate-spin' : ''}`} />
            <span>{regenerating ? 'Syncing...' : 'Sync'}</span>
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-stone-950 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2.5 rounded-lg mb-3 text-xs font-medium shadow-sm">
          <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Clean Table Container */}
      <div className="flex-1 bg-white border border-stone-200/90 rounded-xl shadow-sm overflow-hidden flex flex-col relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-stone-400">
            <RefreshCw className="w-7 h-7 animate-spin text-stone-700 mb-2" />
            <p className="text-xs font-semibold tracking-wider uppercase text-stone-500">
              Loading Central MR11 Master Schedule...
            </p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-stone-400 p-8">
            <FileSpreadsheet className="w-10 h-10 stroke-1 mb-2 text-stone-300" />
            <p className="text-xs font-bold text-stone-700 uppercase tracking-wider">No Contracts Loaded</p>
            <p className="text-[11px] text-stone-400 mt-0.5">Upload the Business Development (BD) workbook to instantiate contracts</p>
          </div>
        ) : (
          <div className="overflow-auto flex-1 h-full select-text">
            <div
              style={{
                zoom: `${zoom}%`,
                transformOrigin: 'top left',
                transition: 'zoom 0.15s ease',
              }}
              className="inline-block min-w-full align-middle"
            >
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#FAF9F6] text-stone-600 font-extrabold uppercase sticky top-0 z-20 text-[10px] tracking-wider border-b border-stone-200">
                  <tr>
                    <th className="p-2.5 border-r border-stone-200 text-center w-10 bg-[#FAF9F6] sticky left-0 z-30 font-mono">
                      #
                    </th>
                    {headers.map((h, idx) => (
                      <th
                        key={idx}
                        className="p-2.5 border-r border-stone-200 whitespace-nowrap bg-[#FAF9F6]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-800">
                  {filteredRecords.map((row, rIdx) => {
                    const fontColor = row?._fontColor || '#000000';
                    const isStreamLead = row?._isStreamLead !== false;
                    const streamSpan = row?._streamSpan || 1;
                    const rowBg = row?._fillColor || undefined;

                    return (
                      <tr
                        key={rIdx}
                        className="hover:bg-stone-50/70 transition-colors"
                        style={{ backgroundColor: rowBg }}
                      >
                        {/* Sticky Index Column */}
                        <td className="p-2 border-r border-stone-200 text-center text-stone-400 font-mono text-[11px] sticky left-0 z-10 bg-white font-medium">
                          {rIdx + 1}
                        </td>

                        {/* Cell Data */}
                        {headers.map((h, cIdx) => {
                          const isMergeTarget = isStreamMergeColumn(h);

                          // Stream merged columns (Shellplan & Design)
                          if (isMergeTarget) {
                            if (!isStreamLead) return null;
                            return (
                              <td
                                key={cIdx}
                                rowSpan={streamSpan}
                                className="p-2 border-r border-stone-200 whitespace-nowrap text-center align-middle font-bold text-stone-900 bg-stone-50/80"
                              >
                                {row?.[h] !== null && row?.[h] !== undefined && row?.[h] !== ''
                                  ? String(row[h])
                                  : '—'}
                              </td>
                            );
                          }

                          // ATD Highlight check
                          const cellBgColor =
                            row?._cellColors?.[h] ||
                            (isAtdColumn(h) ? row?._atdColor : undefined);

                          const isYellowAtd = cellBgColor === '#FFFF00';

                          return (
                            <td
                              key={cIdx}
                              className={`p-2 border-r border-stone-200 whitespace-nowrap transition-colors ${
                                isYellowAtd
                                  ? 'bg-[#FEF08A] font-extrabold text-amber-950 ring-1 ring-amber-300'
                                  : ''
                              }`}
                              style={{
                                color: isYellowAtd
                                  ? '#78350F'
                                  : fontColor !== '#000000' && cIdx < 4
                                  ? fontColor
                                  : undefined,
                                fontWeight: fontColor !== '#000000' && cIdx < 4 ? 'bold' : 'normal',
                              }}
                            >
                              {row?.[h] !== null && row?.[h] !== undefined && row?.[h] !== ''
                                ? String(row[h])
                                : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};