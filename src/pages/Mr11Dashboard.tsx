import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../api/client';
import { ZoomControls } from '../components/common/ZoomControls';
import { FullscreenButton } from '../components/common/FullscreenButton';
import { Mr11Table, HeaderGroup } from '../components/workbook/Mr11Table';
import { useDepartmentHighlight, DepartmentLegend } from '../components/workbook/DepartmentHighlight';
import { ColumnGroupsMenu, columnGroupOf, columnGroups } from '../components/workbook/ColumnGroupsMenu';
import { usePersistentState } from '../utils/usePersistentState';
import {
  FileSpreadsheet,
  Download,
  RefreshCw,
  AlertTriangle,
  Search,
  X,
  PanelTopClose,
  PanelTopOpen,
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
  const [searchTerm, setSearchTerm] = useState('');

  // Remembered in this browser: zoom, hidden column groups and the rates strip
  const [zoom, setZoom] = usePersistentState<number>('mr11.zoom', 100);
  const [hiddenGroups, setHiddenGroups] = usePersistentState<string[]>('mr11.hiddenColumnGroups', []);
  const [showRates, setShowRates] = usePersistentState<boolean>('mr11.showRatesStrip', true);
  const tableRef = useRef<HTMLDivElement>(null);

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

  const groups = useMemo(() => columnGroups(departmentColors), [departmentColors]);
  const visibleHeaders = useMemo(
    () =>
      headers.filter((h) => {
        const group = columnGroupOf(h, columnDepartments);
        return !group || !hiddenGroups.includes(group);
      }),
    [headers, columnDepartments, hiddenGroups]
  );

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
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-stone-200/80 rounded-xl px-5 py-3.5 shadow-sm mb-3.5 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-stone-900 flex items-center justify-center text-amber-200 shadow-sm flex-shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-sm font-extrabold text-stone-900 tracking-tight uppercase truncate">
                MR11 Master Operations Ledger
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-stone-100 text-stone-700 whitespace-nowrap">
                {searchTerm.trim() ? `${filteredRecords.length} of ${records.length}` : records.length} Contracts
              </span>
            </div>
            <p className="text-[11px] text-stone-400 mt-0.5 truncate">
              Production, dispatch milestones & fulfillment schedule
            </p>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search project, no. or short name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-56 pl-8 pr-7 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-900 focus:bg-white transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-stone-400 hover:text-stone-800 hover:bg-stone-100 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <ColumnGroupsMenu groups={groups} hidden={hiddenGroups} onChange={setHiddenGroups} />

          <button
            type="button"
            onClick={() => setShowRates(!showRates)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
            title={showRates ? 'Hide exchange rate, LME and highlight key' : 'Show exchange rate, LME and highlight key'}
          >
            {showRates ? <PanelTopClose className="w-3.5 h-3.5 text-stone-500" /> : <PanelTopOpen className="w-3.5 h-3.5 text-stone-500" />}
            <span className="hidden xl:inline">{showRates ? 'Hide rates' : 'Show rates'}</span>
          </button>

          <ZoomControls zoom={zoom} setZoom={setZoom} min={20} max={135} step={5} />

          <FullscreenButton target={tableRef} />

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

      {/* Exchange rate, LME and department highlight key (can be hidden) */}
      <div
        className={`grid transition-all duration-300 ease-out flex-shrink-0 ${
          showRates ? 'grid-rows-[1fr] opacity-100 mb-3.5' : 'grid-rows-[0fr] opacity-0 mb-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-wrap items-stretch gap-3">
            <ExchangeRateCard fxRate={fxRate} />
            <LmePriceCard lmePrice={lmePrice} />
            <div className="flex-1 min-w-[280px] flex items-center bg-white border border-stone-200/80 rounded-xl px-4 py-2.5 shadow-sm">
              <DepartmentLegend departmentColors={departmentColors} active={active} onToggle={toggle} />
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2.5 rounded-lg mb-3 text-xs font-medium shadow-sm">
          <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div
        ref={tableRef}
        className="flex-1 bg-white border border-stone-200/90 rounded-xl shadow-sm overflow-hidden flex flex-col relative"
      >
        {hiddenGroups.length > 0 && !loading && filteredRecords.length > 0 && (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-amber-200/70 bg-amber-50/70 text-[11px] text-amber-900 flex-shrink-0">
            <span>
              {hiddenGroups.length} column group{hiddenGroups.length > 1 ? 's' : ''} hidden ·{' '}
              {headers.length - visibleHeaders.length} of {headers.length} columns not shown
            </span>
            <button
              type="button"
              onClick={() => setHiddenGroups([])}
              className="font-semibold underline-offset-2 hover:underline cursor-pointer"
            >
              Show all columns
            </button>
          </div>
        )}
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
            {records.length > 0 ? (
              <>
                <p className="text-xs font-bold text-stone-700 uppercase tracking-wider">No matching contracts</p>
                <p className="text-[11px] text-stone-400 mt-0.5">Nothing matches "{searchTerm}"</p>
              </>
            ) : (
              <>
                <p className="text-xs font-bold text-stone-700 uppercase tracking-wider">No Contracts Loaded</p>
                <p className="text-[11px] text-stone-400 mt-0.5">Upload the Business Development (BD) workbook to instantiate contracts</p>
              </>
            )}
          </div>
        ) : (
          <Mr11Table
            records={filteredRecords}
            headers={visibleHeaders}
            headerGroups={headerGroups}
            numberFormats={numberFormats}
            highlightColumns={highlightColumns}
            zoom={zoom}
          />
        )}
      </div>
    </div>
  );
};
