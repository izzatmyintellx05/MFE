import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../api/client';
import { ZoomControls } from '../components/common/ZoomControls';
import { FullscreenButton } from '../components/common/FullscreenButton';
import { Mr11Table, HeaderGroup } from '../components/workbook/Mr11Table';
import { useDepartmentHighlight } from '../components/workbook/DepartmentHighlight';
import { columnGroupOf, columnGroups } from '../components/workbook/ColumnGroupsMenu';
import { Mr11SidePanel } from '../components/workbook/Mr11SidePanel';
import { usePersistentState } from '../utils/usePersistentState';
import { applyFilters, activeFilterCount, remergeStreamBlocks, FILTER_FIELDS } from '../utils/mr11Filters';
import {
  FileSpreadsheet,
  Download,
  RefreshCw,
  AlertTriangle,
  Search,
  X,
  SlidersHorizontal,
  ArrowRightLeft,
  Trash2,
} from 'lucide-react';
import { ExchangeRateCard, LmePriceCard, FxRate, LmePrice, CurrencyRate } from '../components/common/MarketRates';
import { DeletedRowsMenu, DeletedRow } from '../components/workbook/DeletedRowsMenu';
import { useAuthStore } from '../store/auth.store';
import { isAdmin } from '../utils/access';

// A symbol on the right-hand icon bar; dark when what it opens is showing
const RailButton: React.FC<{
  active: boolean;
  onClick: () => void;
  title: string;
  dot?: boolean;
  children: React.ReactNode;
}> = ({ active, onClick, title, dot, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    aria-pressed={active}
    className={`relative w-8 h-8 flex items-center justify-center rounded-lg transition cursor-pointer ${
      active ? 'bg-stone-900 text-amber-200 shadow-sm' : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
    }`}
  >
    {children}
    {dot && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white" />}
  </button>
);

export const Mr11Dashboard: React.FC = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [headerGroups, setHeaderGroups] = useState<HeaderGroup[]>([]);
  const [numberFormats, setNumberFormats] = useState<Record<string, number>>({});
  // Live USD -> MYR exchange rate, shown in its own box
  const [fxRate, setFxRate] = useState<FxRate | null>(null);
  const [currencyRates, setCurrencyRates] = useState<CurrencyRate[]>([]);
  // Latest LME aluminium price (USD per tonne), shown for reference
  const [lmePrice, setLmePrice] = useState<LmePrice | null>(null);
  const [columnDepartments, setColumnDepartments] = useState<Record<string, string>>({});
  const [departmentColors, setDepartmentColors] = useState<Record<string, string>>({});
  const { active, toggle, highlightColumns } = useDepartmentHighlight(columnDepartments, departmentColors);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<Record<string, string[]>>({});

  // Remembered in this browser: zoom, the side panel, hidden column groups and the rates cards
  const [zoom, setZoom] = usePersistentState<number>('mr11.zoom', 100);
  const [panelOpen, setPanelOpen] = usePersistentState<boolean>('mr11.sidePanelOpen', true);
  const [hiddenGroups, setHiddenGroups] = usePersistentState<string[]>('mr11.hiddenColumnGroups', []);
  const [showRates, setShowRates] = usePersistentState<boolean>('mr11.showRatesStrip', true);
  const tableRef = useRef<HTMLDivElement>(null);

  // Administrators can delete MR11 rows (and restore them from the Deleted rows list)
  const { user } = useAuthStore();
  const admin = isAdmin(user);
  const [deletedRows, setDeletedRows] = useState<DeletedRow[]>([]);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  // The row waiting for the administrator to confirm its deletion
  const [confirmRow, setConfirmRow] = useState<any | null>(null);

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
      setCurrencyRates(data?.currencyRates || []);
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

  useEffect(() => {
    if (!admin) return;
    api
      .get('/mr11/deleted-rows')
      .then((res) => setDeletedRows(res.data?.data || []))
      .catch(() => setDeletedRows([]));
  }, [admin]);

  const describeRow = (r: any) =>
    `${r['Short Name'] || r['Project No'] || 'this project'}, stream ${r['Stream'] ?? '—'}${r['Products type'] ? ` (${r['Products type']})` : ''}`;

  const handleDeleteRow = async (row: any) => {
    if (rowBusy) return;
    setConfirmRow(null);
    setRowBusy(row._rowKey);
    setError(null);
    try {
      const res = await api.post('/mr11/rows/delete', { key: row._rowKey });
      setDeletedRows(res.data?.data || []);
      await fetchMr11Data();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Could not delete the row');
    } finally {
      setRowBusy(null);
    }
  };

  const handleRestoreRow = async (row: DeletedRow) => {
    if (rowBusy) return;
    setRowBusy(row.key);
    setError(null);
    try {
      const res = await api.post('/mr11/rows/restore', { key: row.key });
      setDeletedRows(res.data?.data || []);
      await fetchMr11Data();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Could not restore the row');
    } finally {
      setRowBusy(null);
    }
  };

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

  // The export needs the signed-in user's token, so it is fetched and then saved as a file
  const handleExport = async () => {
    try {
      const res = await api.get('/mr11/export', { responseType: 'blob' });
      const name =
        /filename="?([^";]+)"?/.exec(res.headers['content-disposition'] || '')?.[1] || `MR11_Master_Order_${Date.now()}.xlsx`;
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      let message = err.message || 'Export failed';
      // Error responses also arrive as a blob
      try {
        message = JSON.parse(await err.response?.data?.text())?.error?.message || message;
      } catch {}
      setError(message);
    }
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

  // Search, then filters; merged Shell Plan / Design cells are redone over the rows left
  const shownRecords = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const searched = term
      ? records.filter((r) =>
          [r['Project No'] || r['Project No.'], r['Customer & Project Name'] || r['Project Name'], r['Short Name'] || r['Project Shortname']]
            .map((v) => String(v || '').toLowerCase())
            .some((v) => v.includes(term))
        )
      : records;
    return remergeStreamBlocks(records, applyFilters(searched, filters));
  }, [records, searchTerm, filters]);

  const filterCount = activeFilterCount(filters);
  const isNarrowed = shownRecords.length !== records.length;
  const filterSummary = FILTER_FIELDS.filter((f) => (filters[f.key] || []).length > 0)
    .map((f) => `${f.label}: ${filters[f.key].join(', ')}`)
    .join(' · ');

  return (
    <div className="relative flex h-full bg-[#FAF9F6] p-5 overflow-hidden select-none">
      {/* Confirm deleting an MR11 row */}
      {confirmRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-row-title"
          onMouseDown={(e) => e.target === e.currentTarget && setConfirmRow(null)}
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
            <div className="flex items-start gap-3 px-5 pt-5">
              <span className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <h2 id="delete-row-title" className="text-sm font-extrabold text-stone-900">
                  Delete this row from MR11?
                </h2>
                <p className="mt-1 text-xs text-stone-600">
                  <span className="font-semibold text-stone-900">{describeRow(confirmRow)}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-stone-500 truncate" title={confirmRow['Customer & Project Name']}>
                  {confirmRow['Customer & Project Name']}
                </p>
                <p className="mt-3 text-[11px] text-stone-500">
                  It stays out of MR11 after new uploads too. You can bring it back any time from{' '}
                  <span className="font-semibold text-stone-700">Deleted rows</span>.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 mt-4 bg-stone-50 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setConfirmRow(null)}
                className="px-3.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
                autoFocus
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteRow(confirmRow)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete row
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-stone-200/80 rounded-xl px-4 py-3 shadow-sm mb-3.5 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-stone-900 flex items-center justify-center text-amber-200 shadow-sm flex-shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="text-sm font-extrabold text-stone-900 tracking-tight uppercase truncate">MR11 Master Operations Ledger</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-stone-100 text-stone-700 whitespace-nowrap">
                  {isNarrowed ? `${shownRecords.length} of ${records.length}` : records.length} Contracts
                </span>
              </div>
              <p className="text-[11px] text-stone-400 mt-0.5 truncate">Production, dispatch milestones & fulfillment schedule</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search project, no. or short name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-60 pl-8 pr-7 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-900 focus:bg-white transition"
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

            <ZoomControls zoom={zoom} setZoom={setZoom} min={20} max={135} step={5} />

            <FullscreenButton target={tableRef} />

            {admin && <DeletedRowsMenu rows={deletedRows} busyKey={rowBusy} onRestore={handleRestoreRow} />}

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

        {/* Exchange rate and LME (slides in and out from the icon bar on the right) */}
        <div
          className={`grid transition-all duration-300 ease-out flex-shrink-0 ${
            showRates ? 'grid-rows-[1fr] opacity-100 mb-3.5' : 'grid-rows-[0fr] opacity-0 mb-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] items-stretch gap-3">
              <ExchangeRateCard fxRate={fxRate} currencyRates={currencyRates} />
              <LmePriceCard lmePrice={lmePrice} />
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
          className="flex-1 min-h-0 bg-white border border-stone-200/90 rounded-xl shadow-sm overflow-hidden flex flex-col relative"
        >
          {!loading && records.length > 0 && (filterCount > 0 || hiddenGroups.length > 0) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 border-b border-amber-200/70 bg-amber-50/70 text-[11px] text-amber-900 flex-shrink-0">
              {filterCount > 0 && (
                <span className="flex items-center gap-2 min-w-0">
                  <span className="truncate" title={filterSummary}>
                    <strong className="font-semibold">Filtered</strong> · {filterSummary}
                  </span>
                  <button type="button" onClick={() => setFilters({})} className="font-semibold whitespace-nowrap hover:underline cursor-pointer">
                    Clear filters
                  </button>
                </span>
              )}
              {hiddenGroups.length > 0 && (
                <span className="flex items-center gap-2 whitespace-nowrap">
                  {headers.length - visibleHeaders.length} of {headers.length} columns hidden
                  <button type="button" onClick={() => setHiddenGroups([])} className="font-semibold hover:underline cursor-pointer">
                    Show all columns
                  </button>
                </span>
              )}
            </div>
          )}
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-stone-400">
              <RefreshCw className="w-7 h-7 animate-spin text-stone-700 mb-2" />
              <p className="text-xs font-semibold tracking-wider uppercase text-stone-500">Loading Central MR11 Master Schedule...</p>
            </div>
          ) : shownRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-stone-400 p-8">
              <FileSpreadsheet className="w-10 h-10 stroke-1 mb-2 text-stone-300" />
              {records.length > 0 ? (
                <>
                  <p className="text-xs font-bold text-stone-700 uppercase tracking-wider">No matching contracts</p>
                  <p className="text-[11px] text-stone-400 mt-0.5">Change the search or filters to see contracts again</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setFilters({});
                    }}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 cursor-pointer"
                  >
                    Clear search &amp; filters
                  </button>
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
              records={shownRecords}
              headers={visibleHeaders}
              headerGroups={headerGroups}
              numberFormats={numberFormats}
              highlightColumns={highlightColumns}
              zoom={zoom}
              onDeleteRow={admin && !rowBusy ? setConfirmRow : undefined}
            />
          )}
        </div>
      </div>

      {/* Right panel: view options, column highlight and filters; slides out from the icon bar.
          On wide screens it sits beside the table, on narrower ones it floats over it. */}
      <div
        className={`absolute z-30 top-5 bottom-5 right-[4.75rem] w-72 rounded-xl shadow-2xl transition-all duration-300 ease-out ${
          panelOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'
        } xl:static xl:z-auto xl:h-full xl:shadow-none xl:translate-x-0 xl:flex-shrink-0 xl:overflow-hidden ${
          panelOpen ? 'xl:w-72 xl:ml-4' : 'xl:w-0 xl:ml-0'
        }`}
        aria-hidden={!panelOpen}
      >
        <Mr11SidePanel
          groups={groups}
          hiddenGroups={hiddenGroups}
          onHiddenGroupsChange={setHiddenGroups}
          departmentColors={departmentColors}
          highlighted={active}
          onToggleHighlight={toggle}
          records={records}
          filters={filters}
          onFiltersChange={setFilters}
          onClose={() => setPanelOpen(false)}
        />
      </div>

      {/* Icon bar: open / close the options panel and the rates cards */}
      <div className="ml-3 flex-shrink-0 w-11 self-start flex flex-col items-center gap-1.5 py-2 bg-white border border-stone-200/80 rounded-xl shadow-sm">
        <RailButton
          active={panelOpen}
          onClick={() => setPanelOpen(!panelOpen)}
          title={panelOpen ? 'Hide options, highlight & filters' : 'Show options, highlight & filters'}
          dot={!panelOpen && (filterCount > 0 || hiddenGroups.length > 0)}
        >
          <SlidersHorizontal className="w-4 h-4" />
        </RailButton>
        <RailButton
          active={showRates}
          onClick={() => setShowRates(!showRates)}
          title={showRates ? 'Hide exchange rate & LME' : 'Show exchange rate & LME'}
        >
          <ArrowRightLeft className="w-4 h-4" />
        </RailButton>
      </div>
    </div>
  );
};
