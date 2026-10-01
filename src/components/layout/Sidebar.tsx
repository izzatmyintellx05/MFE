import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { BrandLogo } from '../common/BrandLogo';
import { 
  FileSpreadsheet, 
  LayoutDashboard, 
  LogOut, 
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  SlidersHorizontal,
  LineChart
} from 'lucide-react';



const DEPARTMENT_LINKS = [
  { code: 'BD', label: 'Business Development', path: '/departments/BD', badge: 'BD' },
  { code: 'FINANCE', label: 'Finance', path: '/departments/FINANCE', badge: 'FN' },
  { code: 'SHELLPLAN', label: 'ShellPlan', path: '/departments/SHELLPLAN', badge: 'SP' },
  { code: 'DESIGN', label: 'Design', path: '/departments/DESIGN', badge: 'DS' },
  { code: 'PLANNING', label: 'Planning', path: '/departments/PLANNING', badge: 'PL' },
  { code: 'PRODUCTION', label: 'Production', path: '/departments/PRODUCTION', badge: 'PR' },
  { code: 'DISPATCH', label: 'Dispatch', path: '/departments/DISPATCH', badge: 'DP' },
];

export const Sidebar: React.FC = () => {
  const { user, token, logout, initAuth } = useAuthStore();
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (token && (!user || !user.roles || user.roles.length === 0)) {
      initAuth();
    }
  }, [token, user, initAuth]);

  const isAdmin = !user || user.roles?.includes('ADMIN') || user.email === 'admin@mfeformwork.com';

  const visibleDepartments = DEPARTMENT_LINKS.filter((dept) => {
    if (isAdmin) return true;
    return user?.roles?.includes(dept.code) || (user as any)?.departmentRole === dept.code;
  });

  return (
    <aside
      className={`relative z-40 flex flex-col h-full bg-white border-r border-slate-200/80 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] select-none flex-shrink-0 ${
        isOpen ? 'w-64 shadow-[4px_0_24px_-4px_rgba(15,23,42,0.03)]' : 'w-[72px]'
      }`}
    >
      {/* Brand Header with Corporate Logo */}
      <div className="h-20 px-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center overflow-hidden min-w-0">
          {isOpen ? (
            <BrandLogo size="md" showSubtitle={true} className="transition-opacity duration-200" />
          ) : (
            <div className="w-10 h-10 flex items-center justify-center p-1 rounded-lg bg-slate-50 border border-slate-200 shadow-sm">
              <img
                src="/doka-mfe-logo.png"
                alt="MFE Doka Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100/80 rounded-lg transition-colors cursor-pointer flex-shrink-0 ml-1"
          title={isOpen ? 'Collapse Navigation' : 'Expand Navigation'}
        >
          {isOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2.5 space-y-6">
        <div>
          {isOpen && (
            <div className="px-3 mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Master System
            </div>
          )}
          <div className="space-y-0.5">
            <NavLink
              to="/mr11"
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-tight transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`
              }
            >
              <div className="flex items-center justify-center w-5 h-5 flex-shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <span className={`whitespace-nowrap transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
                MR11 Master Schedule
              </span>
              {isOpen && (
                <span className="ml-auto text-[8px] font-mono font-bold tracking-widest uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 border border-amber-300/40">
                  Live
                </span>
              )}
            </NavLink>

            <NavLink
                to="/ceo"
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-tight transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`
                }
              >
                <div className="flex items-center justify-center w-5 h-5 flex-shrink-0">
                  <LineChart className="w-4 h-4 text-amber-400" />
                </div>
                <span className={`whitespace-nowrap transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
                  CEO Executive Hub
                </span>
                {isOpen && (
                  <span className="ml-auto text-[8px] font-mono font-bold tracking-widest uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 border border-amber-300/40">
                    C-Level
                  </span>
                )}
              </NavLink>

            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-tight transition-all ${
                    isActive
                      ? 'bg-amber-50 text-amber-900 border border-amber-200/90 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent'
                  }`
                }
              >
                <div className="flex items-center justify-center w-5 h-5 flex-shrink-0">
                  <SlidersHorizontal className="w-4 h-4 text-amber-700" />
                </div>
                <span className={`whitespace-nowrap transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
                  Admin Permissions
                </span>
              </NavLink>
            )}
          </div>
        </div>

        <div>
          {isOpen && (
            <div className="px-3 mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Authorized Departments
            </div>
          )}
          <div className="space-y-0.5">
            {visibleDepartments.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-slate-400 italic">
                No department tabs assigned
              </div>
            ) : (
              visibleDepartments.map((dept) => (
                <NavLink
                  key={dept.code}
                  to={dept.path}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-tight transition-all ${
                      isActive
                        ? 'bg-slate-100 text-slate-950 font-bold border border-slate-200/90 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent'
                    }`
                  }
                >
                  <div className="flex items-center justify-center w-5 h-5 flex-shrink-0">
                    <LayoutDashboard className="w-4 h-4" />
                  </div>
                  <span className={`whitespace-nowrap transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
                    {dept.label}
                  </span>
                  {isOpen && (
                    <span className="ml-auto text-[9px] font-mono text-slate-400 group-hover:text-slate-600">
                      {dept.badge}
                    </span>
                  )}
                </NavLink>
              ))
            )}
          </div>
        </div>
      </div>

      {/* User Session Profile */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/40">
        <div className="flex items-center gap-3 px-1 py-1">
          <div className="w-7 h-7 rounded-lg bg-slate-200/70 flex items-center justify-center text-slate-700 flex-shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>

          <div
            className={`min-w-0 transition-opacity duration-200 ${
              isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <p className="text-xs font-bold text-slate-900 truncate leading-tight">
              {user?.fullName || user?.name || 'Authorized User'}
            </p>
            <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
              {user?.email || 'user@mfeformwork.com'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          className={`mt-2 w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer ${
            isOpen ? 'justify-start' : 'justify-center'
          }`}
          title="Sign Out"
        >
          <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
          {isOpen && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};