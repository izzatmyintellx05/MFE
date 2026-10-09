import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { api } from '../../api/client';
import { todayInMalaysia } from '../../utils/designDates';

export interface DispatchMonthlyRow {
  shortName: string | null;
  projectNo: string | null;
  stream: string;
  productType: string | null;
  file: 'Local' | 'Overseas' | null;
  fontColor: string | null;
  fillColor: string | null;
  totalDispatch: number | string | null;
  months: Record<string, number>;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "2026-10" -> "Oct-26"
const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]}-${key.slice(2, 4)}`;
const m2 = (v: number) => Number(v.toFixed(2)).toLocaleString('en-US');

// m2 dispatched per month for each MR11 row (Dispatch page). The current month is month to date.
export const DispatchMonthlyTable: React.FC<{ reloadKey?: number }> = ({ reloadKey = 0 }) => {
  const [rows, setRows] = useState<DispatchMonthlyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get('/mr11/dispatch-monthly')
      .then((res) => !cancelled && setRows(res.data?.data || []))
      .catch((err) => !cancelled && setError(err.response?.data?.error?.message || err.message || 'Could not load the monthly dispatched m2'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const shown = file ? rows.filter((r) => r.file === file) : rows;
  const months = useMemo(() => [...new Set(shown.flatMap((r) => Object.keys(r.months)))].sort(), [shown]);
  const currentMonth = todayInMalaysia().slice(0, 7);
  const monthTotal = (key: string) => shown.reduce((t, r) => t + (r.months[key] || 0), 0);

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 flex-shrink-0">
        <CalendarDays className="w-4 h-4 text-slate-500" />
        <span className="text-xs font-black uppercase tracking-wider text-slate-800">Monthly Dispatched (m²)</span>
        <span className="px-1.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-600">{shown.length}</span>
        <select
          value={file}
          onChange={(e) => setFile(e.target.value)}
          className="ml-auto text-[11px] bg-white border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:border-slate-500"
          title="Show one Dispatch file"
        >
          <option value="">Local and Overseas</option>
          <option value="Local">Local</option>
          <option value="Overseas">Overseas</option>
        </select>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-[11px] text-slate-400">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading...
          </div>
        ) : error ? (
          <div className="py-6 text-center text-[11px] text-rose-600">{error}</div>
        ) : shown.length === 0 || months.length === 0 ? (
          <div className="py-8 text-center text-[11px] text-slate-400">
            Nothing dispatched yet. Local projects count the m² in their daily columns; Overseas projects count how much
            Cumulative Dispatched goes up from one month's uploads to the next.
          </div>
        ) : (
          <table className="w-full text-[11px] text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
              <tr>
                {['Project', 'Stream', 'Product type', 'File'].map((h) => (
                  <th key={h} className="px-3 py-2 font-bold border-b border-slate-200 whitespace-nowrap">
                    {h}
                  </th>
                ))}
                {months.map((k) => (
                  <th key={k} className="px-3 py-2 font-bold border-b border-slate-200 whitespace-nowrap text-right">
                    {monthLabel(k)}
                    {k === currentMonth && <div className="text-[9px] font-mono normal-case text-amber-700">so far</div>}
                  </th>
                ))}
                <th className="px-3 py-2 font-bold border-b border-slate-200 whitespace-nowrap text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((r, i) => {
                const total = months.reduce((t, k) => t + (r.months[k] || 0), 0);
                return (
                  <tr key={i} className="hover:bg-slate-50/70">
                    <td className="px-3 py-1.5 whitespace-nowrap" title={r.projectNo || undefined}>
                      <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: r.fontColor && r.fontColor !== '#000000' ? r.fontColor : undefined }}>
                        {r.fillColor && <span className="w-2.5 h-2.5 rounded-sm ring-1 ring-black/10" style={{ backgroundColor: r.fillColor }} />}
                        {r.shortName || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-slate-700">{r.stream}</td>
                    <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{r.productType || '—'}</td>
                    <td className="px-3 py-1.5 text-slate-500">{r.file || '—'}</td>
                    {months.map((k) => (
                      <td key={k} className="px-3 py-1.5 font-mono text-right text-slate-800">
                        {r.months[k] ? m2(r.months[k]) : <span className="text-slate-300">—</span>}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 font-mono text-right font-bold text-slate-900">{total ? m2(total) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 bg-slate-50">
              <tr className="font-bold text-slate-900">
                <td className="px-3 py-2 border-t border-slate-200" colSpan={4}>
                  Total
                </td>
                {months.map((k) => (
                  <td key={k} className="px-3 py-2 border-t border-slate-200 font-mono text-right">
                    {monthTotal(k) ? m2(monthTotal(k)) : '—'}
                  </td>
                ))}
                <td className="px-3 py-2 border-t border-slate-200 font-mono text-right">
                  {m2(months.reduce((t, k) => t + monthTotal(k), 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
};
