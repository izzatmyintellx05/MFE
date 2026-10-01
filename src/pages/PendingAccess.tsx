import React from 'react';
import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';

export const PendingAccess: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center border border-slate-200">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Registration Successful</h2>
        <p className="text-sm font-semibold text-slate-600 mb-6">
          Your account has been created. Please contact an administrator to receive system access.
        </p>
        <p className="text-xs text-slate-400 mb-8">
          Accounts remain locked until explicitly approved and assigned department roles by an administrator.
        </p>
        <Link
          to="/login"
          className="inline-block w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition"
        >
          Return to Sign In
        </Link>
      </div>
    </div>
  );
};