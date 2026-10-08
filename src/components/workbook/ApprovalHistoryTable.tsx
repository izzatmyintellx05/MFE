import React, { useEffect, useMemo, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { api } from '../../api/client';

export interface ApprovalHistoryRow {
  projectNo: string | null;
  shortName: string | null;
  projectName: string | null;
  stream: string;
  fillColor: string;
  status: string;
  revision: string | null;
  approvedDate: string | null;
  submittedDate: string | null;
  recordedOn: string;
}

// Shell Plan approval history: every Approved / Reapprove with its revision, newest first
export const ApprovalHistoryTable: React.FC<{ reloadKey?: number }> = ({ reloadKey = 0 }) => {
  const [rows, setRows] = useState<ApprovalHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get('/mr11/shellplan-history')
      .then((res) => !cancelled && setRows(res.data?.data || []))
      .catch((err) => !cancelled && setError(err.response?.data?.error?.message || err.message || 'Could not load the history'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const projects = useMemo(
    () => [...new Set(rows.map((r) => r.shortName || r.projectNo || ''))].filter(Boolean).sort(),
    [rows]
  );
  const shown = project ? rows.filter((r) => (r.shortName || r.projectNo) === project) : rows;

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 flex-shrink-0">
        <History className="w-4 h-4 text-slate-500" />
        <span className="text-xs font-black uppercase tracking-wider text-slate-800">Shell Plan Approval History</span>
        <span className="px-1.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-600">{shown.length}</span>
        <select
          value={project}
          onChange={(e) => setProject(e.target.value)}
          className="ml-auto text-[11px] bg-white border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:border-slate-500"
          title="Show one project"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-[11px] text-slate-400">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading history...
          </div>
        ) : error ? (
          <div className="py-6 text-center text-[11px] text-rose-600">{error}</div>
        ) : shown.length === 0 ? (
          <div className="py-8 text-center text-[11px] text-slate-400">
            No approvals recorded yet. Each Approved or Reapprove status in this file is added here when MR11 is rebuilt.
          </div>
        ) : (
          <table className="w-full text-[11px] text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
              <tr>
                {['Project', 'Project No.', 'Stream', 'Status', 'Revision', 'Approved', 'Submitted', 'Noted on'].map((h) => (
                  <th key={h} className="px-3 py-2 font-bold border-b border-slate-200 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/70">
                  <td className="px-3 py-1.5 whitespace-nowrap" title={r.projectName || undefined}>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                      {r.fillColor && (
                        <span className="w-2.5 h-2.5 rounded-sm ring-1 ring-black/10" style={{ backgroundColor: r.fillColor }} />
                      )}
                      {r.shortName || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-slate-600">{r.projectNo || '—'}</td>
                  <td className="px-3 py-1.5 text-slate-700">{r.stream}</td>
                  <td className="px-3 py-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        /re[\s-]?approv/i.test(r.status) ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-slate-700">{r.revision || '—'}</td>
                  <td className="px-3 py-1.5 font-mono text-slate-700">{r.approvedDate || '—'}</td>
                  <td className="px-3 py-1.5 font-mono text-slate-500">{r.submittedDate || '—'}</td>
                  <td className="px-3 py-1.5 font-mono text-slate-500">{r.recordedOn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
