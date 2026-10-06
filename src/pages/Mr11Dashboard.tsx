import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { ZoomControls } from '../components/common/ZoomControls';
import { Mr11Table, HeaderGroup } from '../components/workbook/Mr11Table';
import { useDepartmentHighlight, DepartmentLegend } from '../components/workbook/DepartmentHighlight';
import { 
  FileSpreadsheet, 
  Download, 
  RefreshCw, 
  AlertTriangle, 
  Search
} from 'lucide-react';
import { ExchangeRateCard, LmePriceCard, FxRate, LmePrice } from '../components/common/MarketRates';

export const Mr11Dashboard: React.FC = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [headerGroups, setHeaderGroups] = useState<HeaderGroup[]>([]);
  const [numberFormats, setNumberFormats] = useState<Record<string, number>>({});
  // Live USD -> MYR exchange rate, shown in its own box
  const [fxRate, setFxRate] = useState<FxRate | null>(null);
  // Latest LME aluminium price (USD per tonne), shown for reference
  const [lmePrice, setLmePrice] = useState<LmePrice | null>(null);
  const [columnDepartments, setColumnDepartments] = useState<Record<string, string>>({});
  const [departmentColors, setDepartmentColors] = useState<Record<string, string>>({});
  const { active, toggle, highlightColumns } = useDepartmentHighlight(columnDepartments, departmentColors);
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
      setHeaderGroups(data?.headerGroups || []);
      setNumberFormats(data?.numberFormats || {});
      setFxRate(data?.fxRate || null);
      setLmePrice(data?.lmePrice || null);
      setColumnDepartments(data?.columnDepartments || {});
      setDepartmentColors(data?.departmentColors || {});
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

          <ZoomControls zoom={zoom} setZoom={setZoom} min={20} max={135} step={5} />

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

      {/* Exchange rate box and department highlight key */}
      <div className="flex items-stretch gap-3 mb-3.5 flex-shrink-0">
        <ExchangeRateCard fxRate={fxRate} />

        <LmePriceCard lmePrice={lmePrice} />

        <div className="flex-1 flex items-center bg-white border border-stone-200/80 rounded-xl px-4 py-2.5 shadow-sm">
          <DepartmentLegend departmentColors={departmentColors} active={active} onToggle={toggle} />
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
          <Mr11Table records={filteredRecords} headers={headers} headerGroups={headerGroups} numberFormats={numberFormats} highlightColumns={highlightColumns} zoom={zoom} />
        )}
      </div>
    </div>
  );
};