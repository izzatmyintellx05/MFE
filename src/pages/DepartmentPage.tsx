import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { HighFidelityViewer } from '../components/workbook/HighFidelityViewer';
import { ZoomControls } from '../components/common/ZoomControls';
import { FullscreenButton } from '../components/common/FullscreenButton';
import { usePersistentState } from '../utils/usePersistentState';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle, Clock, History, CalendarDays } from 'lucide-react';
import { ApprovalHistoryTable } from '../components/workbook/ApprovalHistoryTable';
import { DispatchMonthlyTable } from '../components/workbook/DispatchMonthlyTable';

const DEPARTMENT_NAMES: Record<string, string> = {
  BD: 'Business Development',
  FINANCE: 'Finance',
  SHELLPLAN: 'Shell Plan & Design',
  DESIGN: 'Shell Plan & Design',
  PLANNING: 'Planning',
  PRODUCTION: 'Production',
  DISPATCH: 'Dispatch',
};

// Dispatch keeps two files: Local (Malaysia projects) and Overseas (every other country)
type DispatchPart = 'LOCAL' | 'OVERSEAS';
const DISPATCH_PARTS: { key: DispatchPart; label: string }[] = [
  { key: 'LOCAL', label: 'Local' },
  { key: 'OVERSEAS', label: 'Overseas' },
];

// A Dispatch file's sheets; a workbook saved before the split is the Overseas file
function dispatchFileOf(parsed: any, part: DispatchPart, filename?: string): { sheets: any[]; originalFilename: string | null } {
  if (parsed?.dispatchFiles) {
    const f = parsed.dispatchFiles[part];
    return { sheets: Array.isArray(f?.sheets) ? f.sheets : [], originalFilename: f?.originalFilename ?? null };
  }
  const sheets = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.sheets) ? parsed.sheets : [];
  return part === 'OVERSEAS' ? { sheets, originalFilename: sheets.length ? filename ?? null : null } : { sheets: [], originalFilename: null };
}

export const DepartmentPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  // Shell Plan and Design share one workbook, kept under DESIGN
  const requested = (code || 'BD').toUpperCase();
  const deptCode = requested === 'SHELLPLAN' ? 'DESIGN' : requested;
  const deptDisplayName = DEPARTMENT_NAMES[deptCode] || deptCode;

  const [department, setDepartment] = useState<any>(null);
  const [workbookData, setWorkbookData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Zoom is remembered in this browser; the sheet can be shown full screen
  const [zoom, setZoom] = usePersistentState<number>(`zoom.${deptCode}`, 100);
  const sheetRef = useRef<HTMLDivElement>(null);
  // Shell Plan & Design only: the approval history table, shown or hidden (remembered)
  const isShellplanDesign = deptCode === 'DESIGN';
  const [showHistory, setShowHistory] = usePersistentState<boolean>('design.showApprovalHistory', true);
  const [historyReload, setHistoryReload] = useState(0);
  // Dispatch only: which of its two files is shown and uploaded (remembered)
  const isDispatch = deptCode === 'DISPATCH';
  const [dispatchPart, setDispatchPart] = usePersistentState<DispatchPart>('dispatch.part', 'LOCAL');
  const [showMonthly, setShowMonthly] = usePersistentState<boolean>('dispatch.showMonthly', true);

  const fetchDepartmentData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/departments/${deptCode}`);
      const deptData = res.data?.data;
      setDepartment(deptData);

      const parsed = deptData?.activeVersion?.parsedWorkbook;
      if (isDispatch) {
        setWorkbookData(dispatchFileOf(parsed, dispatchPart).sheets);
      } else if (Array.isArray(parsed)) {
        setWorkbookData(parsed);
      } else if (parsed?.sheets && Array.isArray(parsed.sheets)) {
        setWorkbookData(parsed.sheets);
      } else {
        setWorkbookData([]);
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setDepartment(null);
        setWorkbookData([]);
      } else {
        setError(err.response?.data?.error?.message || err.message || 'Failed to load department data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartmentData();
  }, [deptCode]);

  // Switching between the Local and Overseas files shows that file's sheets
  useEffect(() => {
    if (isDispatch && department) {
      setWorkbookData(dispatchFileOf(department.activeVersion?.parsedWorkbook, dispatchPart).sheets);
    }
  }, [dispatchPart]);
  const dispatchFiles = isDispatch
    ? DISPATCH_PARTS.map((p) => ({
        ...p,
        originalFilename: dispatchFileOf(department?.activeVersion?.parsedWorkbook, p.key, department?.activeVersion?.originalFilename)
          .originalFilename,
      }))
    : [];
  const dispatchPartLabel = DISPATCH_PARTS.find((p) => p.key === dispatchPart)?.label ?? 'Local';

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Dispatch: the file goes in as the Local or Overseas file, whichever is selected
      await api.post(`/departments/${deptCode}/upload${isDispatch ? `?part=${dispatchPart.toLowerCase()}` : ''}`, formData);
      await fetchDepartmentData();
      setHistoryReload((k) => k + 1);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'File upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const activeStatus = String(department?.activeVersion?.status || '').toUpperCase();

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] p-5 overflow-hidden select-none">
      {/* Top Header Deck */}
      <div className="luxury-deck rounded-xl px-5 py-3 mb-3 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xs font-black text-slate-900 tracking-wider uppercase leading-none">
              {deptDisplayName}
            </h1>
            {activeStatus === 'READY' ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                <CheckCircle className="w-2.5 h-2.5 text-emerald-600" /> ONLINE
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-slate-100 text-slate-400 border border-slate-200">
                {activeStatus || 'INACTIVE'}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 font-normal mt-0.5">
            {isDispatch ? (
              <span>
                {dispatchFiles.map((f, i) => (
                  <React.Fragment key={f.key}>
                    {i > 0 && <span> • </span>}
                    {f.label}:{' '}
                    {f.originalFilename ? (
                      <strong className="text-slate-800 font-semibold font-mono">{f.originalFilename}</strong>
                    ) : (
                      <span className="italic">not uploaded</span>
                    )}
                  </React.Fragment>
                ))}
              </span>
            ) : department?.activeVersion?.originalFilename ? (
              <span>
                Active ledger:{' '}
                <strong className="text-slate-800 font-semibold font-mono">
                  {department.activeVersion.originalFilename}
                </strong>
                {department.activeVersion.uploadedBy?.fullName && (
                  <span> • Verified by {department.activeVersion.uploadedBy.fullName}</span>
                )}
              </span>
            ) : (
              'Upload Departmental Workbook (.xlsx) to update live synchronization'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isDispatch && (
            <div className="flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg" role="group" aria-label="Dispatch file">
              {DISPATCH_PARTS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setDispatchPart(p.key)}
                  aria-pressed={dispatchPart === p.key}
                  title={`Show and upload the ${p.label} Dispatch file`}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    dispatchPart === p.key ? 'bg-slate-900 text-amber-200 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <ZoomControls zoom={zoom} setZoom={setZoom} min={20} max={135} step={5} />
          <FullscreenButton target={sheetRef} />
          {isShellplanDesign && (
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer ${
                showHistory ? 'bg-slate-900 text-amber-200 border-slate-900' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
              title={showHistory ? 'Hide the Shell Plan approval history' : 'Show the Shell Plan approval history'}
              aria-pressed={showHistory}
            >
              <History className="w-3.5 h-3.5" />
              <span>Approval history</span>
            </button>
          )}

          {isDispatch && (
            <button
              type="button"
              onClick={() => setShowMonthly(!showMonthly)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer ${
                showMonthly ? 'bg-slate-900 text-amber-200 border-slate-900' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
              title={showMonthly ? 'Hide the m2 dispatched per month' : 'Show the m2 dispatched per month'}
              aria-pressed={showMonthly}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Monthly dispatched</span>
            </button>
          )}

          <label className="luxury-btn-black flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer">
            <Upload className={`w-3.5 h-3.5 ${uploading ? 'animate-spin' : ''}`} />
            {uploading ? 'Deploying...' : isDispatch ? `Upload ${dispatchPartLabel}` : 'Upload & Deploy'}
            <input
              type="file"
              accept=".xlsx"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Shell Plan approval history (Shell Plan & Design page only, can be hidden) */}
      {isShellplanDesign && showHistory && (
        <div className="luxury-deck bg-white rounded-xl mb-3 flex-shrink-0 h-64 overflow-hidden">
          <ApprovalHistoryTable reloadKey={historyReload} />
        </div>
      )}

      {/* Dispatch only: m2 dispatched per month (can be hidden) */}
      {isDispatch && showMonthly && (
        <div className="luxury-deck bg-white rounded-xl mb-3 flex-shrink-0 h-64 overflow-hidden">
          <DispatchMonthlyTable reloadKey={historyReload} />
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-200/90 text-rose-800 px-4 py-2.5 rounded-xl mb-3 text-xs font-medium shadow-sm">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Sheet Container */}
      <div ref={sheetRef} className="luxury-deck bg-white flex-1 rounded-xl overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Clock className="w-7 h-7 stroke-1 mb-2 animate-spin text-slate-800" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
              Parsing Structure...
            </p>
          </div>
        ) : workbookData && workbookData.length > 0 ? (
          <div
            className="flex-1 overflow-hidden"
            style={{ zoom: `${zoom}%`, transformOrigin: 'top left' }}
          >
            <HighFidelityViewer data={workbookData} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-2.5 text-slate-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-800 uppercase tracking-widest">
              {isDispatch ? `No ${dispatchPartLabel} file yet` : 'No Active Ledger'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm text-center">
              {isDispatch
                ? `Upload the ${dispatchPartLabel} Dispatch file (.xlsx). ${
                    dispatchPart === 'LOCAL' ? 'Malaysia projects' : 'Projects outside Malaysia'
                  } are read from it in MR11.`
                : `Upload an authorized Excel (.xlsx) file to initialize ${deptDisplayName} data.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};