import React, { useState } from 'react';
import { useAuthStore } from '../store/auth.store';
import { BrandLogo } from '../components/common/BrandLogo';
import { ShieldCheck, Lock, Mail, ArrowRight, AlertTriangle, Zap } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuthStore();
  // Pre-fill default credentials for seamless development login
  const [email, setEmail] = useState('admin@mfeformwork.com');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 text-rose-800 px-3.5 py-2.5 rounded-xl mb-4 text-xs font-medium leading-relaxed">
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
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
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

            {/* Quick-Fill Root Admin Button */}
            <button
              type="button"
              onClick={() => performLogin('admin@mfeformwork.com', 'admin123')}
              disabled={loading}
              className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/90 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>Quick Login as System Admin</span>
            </button>

            {/* Quick Demo Switchers */}
            <div className="pt-1 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => performLogin('ceo@mfeformwork.com', 'admin123')}
                disabled={loading}
                className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold transition text-center cursor-pointer"
              >
                Login as CEO
              </button>
              <button
                type="button"
                onClick={() => performLogin('planning@mfeformwork.com', 'admin123')}
                disabled={loading}
                className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold transition text-center cursor-pointer"
              >
                Login as Planning
              </button>
            </div>
          </form>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1 font-mono text-[10px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Default Pass: <code className="text-slate-600 font-bold">admin123</code>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;