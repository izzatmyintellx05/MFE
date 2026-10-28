import React, { useEffect, useRef, useState } from 'react';
import { EyeOff, Eye } from 'lucide-react';

// The MR11 rows hidden in this browser, each with a Show button
export const HiddenRowsMenu: React.FC<{
  rows: any[];
  onUnhide: (row: any) => void;
  onUnhideAll: () => void;
}> = ({ rows, onUnhide, onUnhideAll }) => {
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
        title="Rows hidden from the MR11 table"
        aria-expanded={open}
      >
        <EyeOff className="w-3.5 h-3.5" />
        <span>Hidden rows</span>
        <span className="px-1.5 rounded-full text-[10px] font-mono font-bold bg-stone-200 text-stone-700">{rows.length}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-96 max-w-[90vw] bg-white border border-stone-200 rounded-xl shadow-xl z-40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Hidden in this browser</span>
            <button
              type="button"
              onClick={() => {
                onUnhideAll();
                setOpen(false);
              }}
              className="text-[11px] font-semibold text-stone-700 hover:underline cursor-pointer"
            >
              Show all
            </button>
          </div>
          <ul className="max-h-80 overflow-auto divide-y divide-stone-100">
            {rows.map((r) => (
              <li key={r._rowKey} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-stone-900 truncate" title={r['Customer & Project Name'] || undefined}>
                    {r['Short Name'] || r['Project No'] || 'Row'} · Stream {r['Stream'] ?? '—'}
                  </div>
                  <div className="text-[11px] text-stone-500 truncate">{r['Products type'] || '—'}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onUnhide(r)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-stone-200 bg-stone-50 text-stone-800 text-[11px] font-semibold hover:bg-stone-100 cursor-pointer"
                >
                  <Eye className="w-3 h-3" />
                  Show
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
