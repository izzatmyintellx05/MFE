import React, { useRef, useState } from 'react';
import { useAuthStore } from '../store/auth.store';
import { BrandLogo } from '../components/common/BrandLogo';
import { api } from '../api/client';
import { Lock, Mail, ArrowRight, ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  // Forgot password: the request goes to an administrator, who sets a temporary password
  const [mode, setMode] = useState<'signin' | 'forgot'>('signin');
  const [resetSent, setResetSent] = useState(false);

  const openForgot = () => {
    setMode('forgot');
    setResetSent(false);
    setError(null);
  };

  const backToSignIn = () => {
    setMode('signin');
    setError(null);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Enter the email address you sign in with.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setResetSent(true);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Your request could not be sent. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const performLogin = async (targetEmail: string, targetPass: string) => {
    console.log('[SIGN-IN TRIGGERED]', { email: targetEmail, passLength: targetPass.length });

    if (!targetEmail.trim() || !targetPass.trim()) {
      setError('Please provide both corporate email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[SIGN-IN] Sending request to backend /api/auth/login...');
      await login(targetEmail.trim(), targetPass.trim());
      console.log('[SIGN-IN SUCCESS] Redirecting to MR11 Master Ledger...');
      window.location.replace('/mr11');
    } catch (err: any) {
      console.error('[SIGN-IN FAILURE]', err);
      let message = 'Authentication failed. Please verify credentials.';

      if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        message = 'Cannot connect to backend server. Make sure "npm run dev" is running in the backend folder.';
      } else if (err.response?.data?.error?.message) {
        message = err.response.data.error.message;
      } else if (err.message) {
        message = err.message;
      }

      setError(message);
      // Wrong password: keep the email, clear the password and let the user retype it
      if (err.response?.data?.error?.code === 'WRONG_PASSWORD') {
        setPassword('');
        setTimeout(() => passwordInput.current?.focus(), 0);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(email, password);
  };

  return (
    <div className="min-h-screen w-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-6 select-none">
      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-sm mb-4 flex items-center justify-center">
            <BrandLogo size="lg" showSubtitle={true} />
          </div>
          <h1 className="text-base font-black tracking-wider uppercase text-slate-900 text-center">
            Enterprise Operations OS
          </h1>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">
            MR11 Project Tracking & Master Ledger
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-7 shadow-[0_1px_3px_rgba(15,23,42,0.02),0_12px_36px_-6px_rgba(15,23,42,0.04)]">
          {mode === 'forgot' ? (
            <>
              <div className="mb-5">
                <h2 className="text-sm font-bold text-slate-900">Reset your password</h2>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Your administrator will set a temporary password and give it to you. You choose your own password
                  when you sign in with it.
                </p>
              </div>

              {error && (
                <div role="alert" className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 text-rose-800 px-3.5 py-2.5 rounded-xl mb-4 text-xs font-medium leading-relaxed">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {resetSent ? (
                <div role="status" className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-3 rounded-xl text-xs font-medium leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>
                    Request sent. If <strong>{email.trim()}</strong> has an account, your administrator will give you a
                    temporary password.
                  </span>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="forgot-email" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Corporate Email
                    </label>
                    <div className="relative">
                      <input
                        id="forgot-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@mfeformwork.com"
                        autoComplete="username"
                        autoFocus
                        required
                        className="w-full px-3 py-2 pl-9 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition"
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? 'Sending…' : 'Send reset request'}
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={backToSignIn}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to sign in
              </button>
            </>
          ) : (
          <>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Sign in to workspace</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Enter corporate credentials to access authorized departments
              </p>
            </div>
          </div>

          {/* Explicit Error Banner */}
          {error && (
            <div role="alert" className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 text-rose-800 px-3.5 py-2.5 rounded-xl mb-4 text-xs font-medium leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Corporate Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@mfeformwork.com"
                  autoComplete="username"
                  required
                  className="w-full px-3 py-2 pl-9 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Password
                </label>
                <button
                  type="button"
                  onClick={openForgot}
                  className="text-[11px] font-semibold text-[#004B87] hover:underline underline-offset-2 cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  ref={passwordInput}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                  required
                  className="w-full px-3 py-2 pl-9 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
          </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;