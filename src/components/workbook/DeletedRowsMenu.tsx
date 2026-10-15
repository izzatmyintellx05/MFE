import React, { useEffect, useRef, useState } from 'react';
import { Trash2, RotateCcw } from 'lucide-react';

export interface DeletedRow {
  key: string;
  shortName: string | null;
  projectNo: string | null;
  projectName: string | null;
  stream: string | null;
  productType: string | null;
  deletedAt: string;
  deletedBy: string | null;
}

// Administrators: the MR11 rows they deleted, each with a Restore button
export const DeletedRowsMenu: React.FC<{
  rows: DeletedRow[];
  busyKey: string | null;
  onRestore: (row: DeletedRow) => void;
}> = ({ rows, busyKey, onRestore }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer ${
          open ? 'bg-stone-900 text-amber-200 border-stone-900' : 'bg-white hover:bg-stone-50 text-stone-700 border-stone-200'
        }`}
        title="Rows deleted from MR11"
        aria-expanded={open}
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>Deleted rows</span>
        {rows.length > 0 && (
          <span className="px-1.5 rounded-full text-[10px] font-mono font-bold bg-rose-100 text-rose-700">{rows.length}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-96 max-w-[90vw] bg-white border border-stone-200 rounded-xl shadow-xl z-40 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-stone-100 text-[11px] font-bold uppercase tracking-wider text-stone-500">
            Deleted from MR11
          </div>
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-[11px] text-stone-400">
              No rows deleted. Hover over a row number and click the bin to delete a row.
            </p>
          ) : (
            <ul className="max-h-80 overflow-auto divide-y divide-stone-100">
              {rows.map((r) => (
                <li key={r.key} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-stone-900 truncate" title={r.projectName || undefined}>
                      {r.shortName || r.projectNo || 'Row'} · Stream {r.stream || '—'}
                    </div>
                    <div className="text-[11px] text-stone-500 truncate">{r.productType || '—'}</div>
                    <div className="text-[10px] text-stone-400">
                      {new Date(r.deletedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                      {r.deletedBy ? ` · ${r.deletedBy}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRestore(r)}
                    disabled={busyKey !== null}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-[11px] font-semibold hover:bg-emerald-100 cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className={`w-3 h-3 ${busyKey === r.key ? 'animate-spin' : ''}`} />
                    {busyKey === r.key ? 'Restoring…' : 'Restore'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
