import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { HighFidelityViewer } from '../components/workbook/HighFidelityViewer';
import { ZoomControls } from '../components/common/ZoomControls';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

const DEPARTMENT_NAMES: Record<string, string> = {
  BD: 'Business Development',
  FINANCE: 'Finance',
  SHELLPLAN: 'ShellPlan',
  DESIGN: 'Design',
  PLANNING: 'Planning',
  PRODUCTION: 'Production',
  DISPATCH: 'Dispatch',
};

export const DepartmentPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const deptCode = (code || 'BD').toUpperCase();
  const deptDisplayName = DEPARTMENT_NAMES[deptCode] || deptCode;

  const [department, setDepartment] = useState<any>(null);
  const [workbookData, setWorkbookData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(100);

  const fetchDepartmentData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/departments/${deptCode}`);
      const deptData = res.data?.data;
      setDepartment(deptData);

      const parsed = deptData?.activeVersion?.parsedWorkbook;
      if (Array.isArray(parsed)) {
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post(`/departments/${deptCode}/upload`, formData);
      await fetchDepartmentData();
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
      <div className="luxury-deck rounded-xl px-5 py-3 mb-3 flex items-center justify-between flex-shrink-0">
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
            {department?.activeVersion?.originalFilename ? (
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
          <ZoomControls zoom={zoom} setZoom={setZoom} min={75} max={135} step={5} />

          <label className="luxury-btn-black flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer">
            <Upload className={`w-3.5 h-3.5 ${uploading ? 'animate-spin' : ''}`} />
            {uploading ? 'Deploying...' : 'Upload & Deploy'}
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

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-200/90 text-rose-800 px-4 py-2.5 rounded-xl mb-3 text-xs font-medium shadow-sm">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Sheet Container */}
      <div className="luxury-deck flex-1 rounded-xl overflow-hidden flex flex-col">
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
            <p className="text-xs font-bold text-slate-800 uppercase tracking-widest">No Active Ledger</p>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm text-center">
              Upload an authorized Excel (.xlsx) file to initialize {deptDisplayName} data.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};