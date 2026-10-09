import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { BrandLogo } from '../common/BrandLogo';
import { usePersistentState } from '../../utils/usePersistentState';
import { isAdmin as userIsAdmin, canSeeCeoDashboard, canSeeDepartment } from '../../utils/access';
import { ChangePasswordDialog } from '../common/ChangePasswordDialog';
import {
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  SlidersHorizontal,
  LineChart,
  KeyRound,
} from 'lucide-react';

// Shell Plan and Design share one workbook and one page; either role opens it
const DEPARTMENT_LINKS = [
  { code: 'BD', roles: ['BD'], label: 'Business Development', path: '/departments/BD', badge: 'BD' },
  { code: 'FINANCE', roles: ['FINANCE'], label: 'Finance', path: '/departments/FINANCE', badge: 'FN' },
  { code: 'DESIGN', roles: ['SHELLPLAN', 'DESIGN'], label: 'Shell Plan & Design', path: '/departments/DESIGN', badge: 'SD' },
  { code: 'PLANNING', roles: ['PLANNING'], label: 'Planning', path: '/departments/PLANNING', badge: 'PL' },
  { code: 'PRODUCTION', roles: ['PRODUCTION'], label: 'Production', path: '/departments/PRODUCTION', badge: 'PR' },
  { code: 'DISPATCH', roles: ['DISPATCH'], label: 'Dispatch', path: '/departments/DISPATCH', badge: 'DP' },
];

type LinkTone = 'dark' | 'amber' | 'light';

// One navigation link: icon and label when open, just the icon (with a tooltip) when collapsed
const SideLink: React.FC<{
  to: string;
  label: string;
  icon: React.ReactNode;
  open: boolean;
  tone?: LinkTone;
  badge?: React.ReactNode;
  collapsedBadge?: string;
}> = ({ to, label, icon, open, tone = 'light', badge, collapsedBadge }) => {
  const activeClass =
    tone === 'dark'
      ? 'bg-slate-900 text-white shadow-sm'
      : tone === 'amber'
      ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
      : 'bg-slate-100 text-slate-950 ring-1 ring-slate-200';
  return (
    <NavLink
      to={to}
      title={open ? undefined : label}
      className={({ isActive }) =>
        `group relative flex items-center rounded-lg text-xs font-semibold tracking-tight transition-all ${
          open ? 'gap-2.5 px-2.5 py-1.5' : 'justify-center w-9 h-9 mx-auto'
        } ${isActive ? activeClass : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'}`
      }
    >
      <span className="flex items-center justify-center w-4 h-4 flex-shrink-0">{icon}</span>
      {open && <span className="truncate">{label}</span>}
      {open && badge && <span className="ml-auto flex-shrink-0">{badge}</span>}
      {!open && collapsedBadge && (
        <span className="absolute -bottom-0.5 -right-0.5 text-[7px] font-mono font-bold leading-none px-0.5 rounded bg-white text-slate-400 ring-1 ring-slate-200">
          {collapsedBadge}
        </span>
      )}
    </NavLink>
  );
};

const SectionLabel: React.FC<{ open: boolean; children: React.ReactNode }> = ({ open, children }) =>
  open ? (
    <div className="px-2.5 mb-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">{children}</div>
  ) : (
    <div className="mx-auto mb-1.5 w-5 border-t border-slate-200" />
  );

export const Sidebar: React.FC = () => {
  const { user, token, logout, initAuth, usingDefaultPassword } = useAuthStore();
  const [passwordOpen, setPasswordOpen] = useState(false);
  // Collapsed or expanded is remembered in this browser
  const [isOpen, setIsOpen] = usePersistentState<boolean>('sidebar.open', true);

  useEffect(() => {
    if (token && (!user || !user.roles || user.roles.length === 0)) {
      initAuth();
    }
  }, [token, user, initAuth]);

  const isAdmin = userIsAdmin(user);
  const showCeo = canSeeCeoDashboard(user);

  const visibleDepartments = DEPARTMENT_LINKS.filter((dept) => canSeeDepartment(user, dept.code));

  const userName = user?.fullName || user?.name || 'Authorized User';
  const userEmail = user?.email || 'user@mfeformwork.com';

  return (
    <aside
      className={`relative z-40 flex flex-col h-full bg-white border-r border-slate-200/80 transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] select-none flex-shrink-0 ${
        isOpen ? 'w-56 shadow-[4px_0_24px_-4px_rgba(15,23,42,0.03)]' : 'w-14'
      }`}
    >
      {/* Brand header: logo and the collapse button when open, just the button when collapsed */}
      <div
        className={`border-b border-slate-100 flex items-center flex-shrink-0 ${
          isOpen ? 'h-14 px-3 justify-between' : 'h-14 justify-center'
        }`}
      >
        {isOpen && <BrandLogo size="sm" showSubtitle={true} className="min-w-0 overflow-hidden" />}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100/80 rounded-lg transition-colors cursor-pointer flex-shrink-0"
          title={isOpen ? 'Collapse navigation' : 'Expand navigation'}
        >
          {isOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation links */}
      <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-4 ${isOpen ? 'px-2' : 'px-1'}`}>
        <div>
          <SectionLabel open={isOpen}>Master System</SectionLabel>
          <div className="space-y-0.5">
            <SideLink
              to="/mr11"
              label="MR11 Master Schedule"
              icon={<FileSpreadsheet className="w-4 h-4" />}
              open={isOpen}
              tone="dark"
            />
            {showCeo && (
              <SideLink
                to="/ceo"
                label="CEO Executive Hub"
                icon={<LineChart className="w-4 h-4 text-amber-500" />}
                open={isOpen}
                tone="dark"
              />
            )}
            {isAdmin && (
              <SideLink
                to="/admin"
                label="Admin Permissions"
                icon={<SlidersHorizontal className="w-4 h-4 text-amber-700" />}
                open={isOpen}
                tone="amber"
              />
            )}
          </div>
        </div>

        <div>
          <SectionLabel open={isOpen}>Departments</SectionLabel>
          <div className="space-y-0.5">
            {visibleDepartments.length === 0 ? (
              isOpen && <div className="px-2.5 py-1.5 text-[11px] text-slate-400 italic">No department tabs assigned</div>
            ) : (
              visibleDepartments.map((dept) => (
                <SideLink
                  key={dept.code}
                  to={dept.path}
                  label={dept.label}
                  icon={<LayoutDashboard className="w-4 h-4" />}
                  open={isOpen}
                  collapsedBadge={dept.badge}
                  badge={<span className="text-[9px] font-mono text-slate-400 group-hover:text-slate-600">{dept.badge}</span>}
                />
              ))
            )}
          </div>
        </div>
      </nav>

      {/* Signed-in user, change password and sign out */}
      <div className={`border-t border-slate-100 bg-slate-50/40 flex-shrink-0 ${isOpen ? 'p-2.5' : 'py-2.5 px-1'}`}>
        {isOpen && usingDefaultPassword && (
          <button
            type="button"
            onClick={() => setPasswordOpen(true)}
            className="mb-2.5 w-full rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-left text-[11px] leading-snug text-amber-900 transition-colors hover:bg-amber-100 cursor-pointer"
          >
            <span className="font-semibold">You are using the default password.</span> Change it now.
          </button>
        )}
        {isOpen ? (
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-7 h-7 rounded-lg bg-slate-200/70 flex items-center justify-center text-slate-700 flex-shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 truncate leading-tight">{userName}</p>
              <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">{userEmail}</p>
            </div>
            <button
              type="button"
              onClick={() => setPasswordOpen(true)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer flex-shrink-0"
              title="Change password"
              aria-label="Change password"
            >
              <KeyRound className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={logout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer flex-shrink-0"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <div
              className="w-8 h-8 rounded-lg bg-slate-200/70 flex items-center justify-center text-slate-700"
              title={`${userName}\n${userEmail}`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <button
              type="button"
              onClick={() => setPasswordOpen(true)}
              className={`p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer ${
                usingDefaultPassword ? 'text-amber-600' : 'text-slate-500 hover:text-slate-900'
              }`}
              title={usingDefaultPassword ? 'Change password (default password in use)' : 'Change password'}
              aria-label="Change password"
            >
              <KeyRound className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={logout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </aside>
  );
};
