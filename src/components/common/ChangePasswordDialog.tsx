import React, { useEffect, useRef, useState } from 'react';
import { KeyRound, Eye, EyeOff, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';

const MIN_LENGTH = 8;

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
}

const FIELD =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-900 transition-colors focus:border-[#004B87] focus:outline-none focus:ring-2 focus:ring-[#004B87]/20';

// Lets the signed-in user replace their password (the default admin123 included)
export const ChangePasswordDialog: React.FC<ChangePasswordDialogProps> = ({ open, onClose }) => {
  const { changePassword } = useAuthStore();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setCurrent('');
    setNext('');
    setConfirm('');
    setShow(false);
    setError(null);
    setDone(false);
    setTimeout(() => firstField.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < MIN_LENGTH) return setError(`The new password must be at least ${MIN_LENGTH} characters.`);
    if (next !== confirm) return setError('The new passwords do not match.');
    if (next === current) return setError('The new password must be different from your current password.');

    setSaving(true);
    try {
      await changePassword(current, next);
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Your password could not be changed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputType = show ? 'text' : 'password';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#004B87]/[0.07] text-[#004B87]" aria-hidden="true">
              <KeyRound className="h-4 w-4" />
            </span>
            <div>
              <h2 id="change-password-title" className="text-sm font-semibold text-slate-900">
                Change password
              </h2>
              <p className="text-xs text-slate-500">Your new password replaces the current one.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="mt-6">
            <div role="status" className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
              <span>Password changed. Use your new password the next time you sign in.</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="cp-current" className="mb-1.5 block text-xs font-medium text-slate-700">
                Current password
              </label>
              <input
                ref={firstField}
                id="cp-current"
                type={inputType}
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className={FIELD}
                required
              />
            </div>
            <div>
              <label htmlFor="cp-new" className="mb-1.5 block text-xs font-medium text-slate-700">
                New password
              </label>
              <div className="relative">
                <input
                  id="cp-new"
                  type={inputType}
                  autoComplete="new-password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  aria-describedby="cp-new-help"
                  className={FIELD}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Hide passwords' : 'Show passwords'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p id="cp-new-help" className="mt-1.5 text-xs text-slate-500">
                At least {MIN_LENGTH} characters, different from the default password.
              </p>
            </div>
            <div>
              <label htmlFor="cp-confirm" className="mb-1.5 block text-xs font-medium text-slate-700">
                Confirm new password
              </label>
              <input
                id="cp-confirm"
                type={inputType}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={FIELD}
                required
              />
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Saving…' : 'Change password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ChangePasswordDialog;
