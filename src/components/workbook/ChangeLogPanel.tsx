import React, { useEffect, useMemo, useState } from 'react';
import { History, RefreshCw, Search, X, FilePlus2, FileMinus2, PencilLine, FileSpreadsheet } from 'lucide-react';
import { api } from '../../api/client';

interface ChangeSummary {
  cellsChanged: number;
  rowsAdded: number;
  rowsRemoved: number;
  rowsModified: number;
  sheetsAdded: number;
  sheetsRemoved: number;
}

interface LogEntry {
  id: string;
  originalFilename: string | null;
  previousFilename: string | null;
  source: string | null;
  uploadedByName: string | null;
  isFirst: boolean;
  summary: ChangeSummary;
  truncated: boolean;
  createdAt: string;
  changes?: SheetChange[];
}

interface SheetChange {
  sheet: string;
  status: 'added' | 'removed' | 'changed';
  columnsAdded: string[];
  columnsRemoved: string[];
  rows: any[];
}

// One line of the changes table
interface ChangeLine {
  kind: 'changed' | 'added' | 'removed';
  sheet: string;
  row: string;
  item: string;
  column: string;
  before: string;
  after: string;
}

type KindFilter = 'all' | ChangeLine['kind'];

const SHOWN_LINES = 500;

const dayOf = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const columnName = (c: { column?: string; header?: string | null }) =>
  c.header ? (c.column ? `${c.column} · ${c.header}` : c.header) : c.column || '—';
const valuesText = (values: any[]) => values.map((v) => `${v.header || v.column}: ${v.value}`).join(' | ');

function linesOf(changes: SheetChange[], multiSheet: boolean): ChangeLine[] {
  const lines: ChangeLine[] = [];
  for (const s of changes) {
    const sheet = multiSheet ? s.sheet : '';
    if (s.status === 'added' || s.status === 'removed') {
      lines.push({ kind: s.status, sheet: s.sheet, row: '—', item: `Sheet "${s.sheet}"`, column: '—', before: '', after: '' });
      continue;
    }
    for (const c of s.columnsAdded) lines.push({ kind: 'added', sheet, row: '—', item: 'Column', column: c, before: '', after: '' });
    for (const c of s.columnsRemoved) lines.push({ kind: 'removed', sheet, row: '—', item: 'Column', column: c, before: '', after: '' });
    for (const r of s.rows) {
      if (r.type === 'modified') {
        const row = r.previousRow !== r.row ? `${r.row} (was ${r.previousRow})` : String(r.row);
        for (const c of r.cells) {
          lines.push({ kind: 'changed', sheet, row, item: r.label, column: columnName(c), before: c.before, after: c.after });
        }
      } else if (r.type === 'added') {
        lines.push({ kind: 'added', sheet, row: String(r.row), item: r.label, column: 'Whole row', before: '', after: valuesText(r.values) });
      } else {
        lines.push({ kind: 'removed', sheet, row: String(r.previousRow), item: r.label, column: 'Whole row', before: valuesText(r.values), after: '' });
      }
    }
  }
  return lines;
}

const KIND_STYLE: Record<ChangeLine['kind'], { label: string; className: string }> = {
  changed: { label: 'Changed', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  added: { label: 'Added', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  removed: { label: 'Removed', className: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const SummaryChips: React.FC<{ s: ChangeSummary }> = ({ s }) => {
  const chips = [
    s.cellsChanged > 0 && { icon: PencilLine, text: `${s.cellsChanged} cell${s.cellsChanged === 1 ? '' : 's'}`, cls: 'text-amber-700' },
    s.rowsAdded > 0 && { icon: FilePlus2, text: `+${s.rowsAdded} row${s.rowsAdded === 1 ? '' : 's'}`, cls: 'text-emerald-700' },
    s.rowsRemoved > 0 && { icon: FileMinus2, text: `−${s.rowsRemoved} row${s.rowsRemoved === 1 ? '' : 's'}`, cls: 'text-rose-700' },
  ].filter(Boolean) as { icon: any; text: string; cls: string }[];
  if (chips.length === 0) return <span className="text-[10px] text-slate-400">No value changes</span>;
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-0.5">
      {chips.map(({ icon: Icon, text, cls }) => (
        <span key={text} className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${cls}`}>
          <Icon className="w-3 h-3" />
          {text}
        </span>
      ))}
    </span>
  );
};

/**
 * The Log tab: each upload (or MR11 rebuild), newest first, with only what changed from the
 * one before it. `endpoint` is /departments/:code/changelog or /mr11/changelog.
 */
export const ChangeLogPanel: React.FC<{ endpoint: string; reloadKey?: number; emptyHint?: string }> = ({
  endpoint,
  reloadKey = 0,
  emptyHint = 'Upload a new version of the file: what changed from the previous upload is listed here.',
}) => {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LogEntry | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [day, setDay] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get(endpoint)
      .then((res) => {
        if (cancelled) return;
        const list: LogEntry[] = res.data?.data || [];
        setEntries(list);
        setSelectedId((current) => (current && list.some((e) => e.id === current) ? current : list[0]?.id ?? null));
      })
      .catch((err) => !cancelled && setError(err.response?.data?.error?.message || err.message || 'Could not load the log'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [endpoint, reloadKey]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setShowAll(false);
    api
      .get(`${endpoint}/${selectedId}`)
      .then((res) => !cancelled && setDetail(res.data?.data || null))
      .catch(() => !cancelled && setDetail(null))
      .finally(() => !cancelled && setDetailLoading(false));
    return () => {
      cancelled = true;
    };
  }, [endpoint, selectedId]);

  const days = useMemo(() => [...new Set(entries.map((e) => dayOf(e.createdAt)))], [entries]);
  const shownEntries = day ? entries.filter((e) => dayOf(e.createdAt) === day) : entries;
  const grouped = useMemo(() => {
    const map = new Map<string, LogEntry[]>();
    for (const e of shownEntries) map.set(dayOf(e.createdAt), [...(map.get(dayOf(e.createdAt)) || []), e]);
    return [...map.entries()];
  }, [shownEntries]);

  const allLines = useMemo(() => {
    const changes = detail?.changes || [];
    return linesOf(changes, new Set(changes.map((c) => c.sheet)).size > 1);
  }, [detail]);
  const needle = search.trim().toLowerCase();
  const lines = allLines.filter(
    (l) =>
      (kind === 'all' || l.kind === kind) &&
      (!needle || [l.sheet, l.row, l.item, l.column, l.before, l.after].some((t) => t.toLowerCase().includes(needle)))
  );
  const hasSheetColumn = allLines.some((l) => l.sheet);
  const visibleLines = showAll ? lines : lines.slice(0, SHOWN_LINES);

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 h-full text-[11px] text-slate-400">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading log...
      </div>
    );
  }
  if (error) return <div className="flex items-center justify-center h-full text-[11px] text-rose-600">{error}</div>;
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
        <History className="w-8 h-8 stroke-1 mb-2 text-slate-300" />
        <p className="text-xs font-bold text-slate-800 uppercase tracking-widest">No changes logged yet</p>
        <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm text-center">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 select-text">
      {/* Uploads, newest first, by day */}
      <div className="w-72 flex-shrink-0 border-r border-slate-200 flex flex-col min-h-0">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-200 flex-shrink-0">
          <History className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-800">Change log</span>
          <select
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="ml-auto max-w-[8.5rem] text-[11px] bg-white border border-slate-200 rounded-md px-1.5 py-1 focus:outline-none focus:border-slate-500"
            title="Show one day"
          >
            <option value="">All dates</option>
            {days.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 overflow-auto">
          {grouped.map(([d, list]) => (
            <div key={d}>
              <div className="sticky top-0 z-10 px-3 py-1 bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {d}
              </div>
              {list.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setSelectedId(e.id)}
                  aria-pressed={selectedId === e.id}
                  className={`w-full text-left px-3 py-2 border-b border-slate-100 transition cursor-pointer ${
                    selectedId === e.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className={`font-mono font-bold ${selectedId === e.id ? 'text-amber-200' : 'text-slate-900'}`}>{timeOf(e.createdAt)}</span>
                    <span className={`truncate ${selectedId === e.id ? 'text-slate-300' : 'text-slate-500'}`}>
                      {e.uploadedByName || e.source || ''}
                    </span>
                  </div>
                  <div
                    className={`text-[11px] truncate mt-0.5 ${selectedId === e.id ? 'text-slate-200' : 'text-slate-700'}`}
                    title={e.originalFilename || e.source || undefined}
                  >
                    {e.originalFilename || e.source}
                  </div>
                  <div className="mt-1">
                    {e.isFirst ? (
                      <span className="text-[10px] text-slate-400">First upload: nothing earlier to compare</span>
                    ) : selectedId === e.id ? (
                      <span className="text-[10px] text-slate-300">
                        {e.summary.cellsChanged} cells changed · +{e.summary.rowsAdded} / −{e.summary.rowsRemoved} rows
                      </span>
                    ) : (
                      <SummaryChips s={e.summary} />
                    )}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* What changed in the selected upload */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {detail && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-slate-200 flex-shrink-0">
            <div className="min-w-0 mr-auto">
              <div className="text-xs font-bold text-slate-900 truncate">
                {dayOf(detail.createdAt)}, {timeOf(detail.createdAt)}
                {detail.uploadedByName && <span className="font-normal text-slate-500"> · by {detail.uploadedByName}</span>}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {detail.isFirst
                  ? `${detail.originalFilename || detail.source || ''} · first upload, nothing earlier to compare`
                  : detail.previousFilename
                    ? `Compared with the previous upload (${detail.previousFilename})`
                    : `${detail.source || 'Rebuilt'} · compared with the previous version`}
              </div>
            </div>
            <div className="flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg" role="group" aria-label="Kind of change">
              {(['all', 'changed', 'added', 'removed'] as KindFilter[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  aria-pressed={kind === k}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize transition cursor-pointer ${
                    kind === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search changes..."
                className="w-44 pl-7 pr-6 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] focus:outline-none focus:border-slate-500 focus:bg-white"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-800 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[11px] text-slate-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading changes...
            </div>
          ) : !detail ? (
            <div className="py-10 text-center text-[11px] text-slate-400">Pick an upload on the left to see what changed.</div>
          ) : detail.isFirst ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <FileSpreadsheet className="w-7 h-7 stroke-1 mb-2 text-slate-300" />
              <p className="text-[11px] max-w-sm text-center">
                This is the first upload in the log. The next upload is compared with it, and only the cells that differ are listed.
              </p>
            </div>
          ) : allLines.length === 0 ? (
            <div className="py-10 text-center text-[11px] text-slate-400">The values are the same as in the previous upload.</div>
          ) : (
            <>
              <table className="w-full text-[11px] text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] z-10">
                  <tr>
                    {['Change', ...(hasSheetColumn ? ['Sheet'] : []), 'Row', 'Item', 'Column', 'Before', 'After'].map((h) => (
                      <th key={h} className="px-3 py-2 font-bold border-b border-slate-200 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleLines.map((l, i) => (
                    <tr key={i} className="hover:bg-slate-50/70 align-top">
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${KIND_STYLE[l.kind].className}`}>
                          {KIND_STYLE[l.kind].label}
                        </span>
                      </td>
                      {hasSheetColumn && <td className="px-3 py-1.5 whitespace-nowrap text-slate-600">{l.sheet}</td>}
                      <td className="px-3 py-1.5 whitespace-nowrap font-mono text-slate-500">{l.row}</td>
                      <td className="px-3 py-1.5 max-w-[16rem] truncate font-semibold text-slate-800" title={l.item}>
                        {l.item}
                      </td>
                      <td className="px-3 py-1.5 max-w-[14rem] truncate text-slate-700" title={l.column}>
                        {l.column}
                      </td>
                      <td className="px-3 py-1.5 max-w-[18rem] break-words text-rose-700">
                        {l.before ? <span className="line-through decoration-rose-300">{l.before}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-1.5 max-w-[18rem] break-words text-emerald-700 font-medium">
                        {l.after || <span className="text-slate-300 font-normal">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lines.length === 0 && <div className="py-8 text-center text-[11px] text-slate-400">No changes match the search.</div>}
              {!showAll && lines.length > SHOWN_LINES && (
                <div className="py-3 text-center">
                  <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    className="px-3 py-1 rounded-md border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Show all {lines.length} changes
                  </button>
                </div>
              )}
              {detail.truncated && (
                <div className="py-2 text-center text-[10px] text-slate-400">
                  This upload changed a very large part of the file; only the first changes were kept.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
