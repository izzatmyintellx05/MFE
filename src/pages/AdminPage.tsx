import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { 
  ShieldCheck, 
  Users, 
  Check, 
  X, 
  RefreshCw, 
  AlertTriangle, 
  Lock, 
  Crown, 
  UserPlus,
  Trash2
} from 'lucide-react';

const DEPARTMENT_PRESETS = [
  { code: 'CUSTOM', label: 'Custom Permissions' },
  { code: 'ADMIN', label: 'System Administrator (Full Access)' },
  { code: 'BD', label: 'Business Development' },
  { code: 'FINANCE', label: 'Finance' },
  { code: 'SHELLPLAN', label: 'ShellPlan' },
  { code: 'DESIGN', label: 'Design' },
  { code: 'PLANNING', label: 'Planning' },
  { code: 'PRODUCTION', label: 'Production' },
  { code: 'DISPATCH', label: 'Dispatch' },
];

const ALL_DEPARTMENTS = [
  { code: 'BD', label: 'Business Development' },
  { code: 'FINANCE', label: 'Finance' },
  { code: 'SHELLPLAN', label: 'ShellPlan' },
  { code: 'DESIGN', label: 'Design' },
  { code: 'PLANNING', label: 'Planning' },
  { code: 'PRODUCTION', label: 'Production' },
  { code: 'DISPATCH', label: 'Dispatch' },
];

export const AdminPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Provision User Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newProfile, setNewProfile] = useState('DESIGN');
  const [creatingUser, setCreatingUser] = useState(false);

  // Delete User Confirmation State
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load user list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) {
      setError('Email and Password are required');
      return;
    }

    setCreatingUser(true);
    setError(null);
    try {
      await api.post('/admin/users', {
        email: newEmail,
        fullName: newFullName,
        password: newPassword,
        primaryProfile: newProfile,
      });

      setIsModalOpen(false);
      setNewEmail('');
      setNewFullName('');
      setNewPassword('');
      setSuccessMsg('User created successfully and provisioned.');
      setTimeout(() => setSuccessMsg(null), 3500);
      await fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUserConfirm = async () => {
    if (!userToDelete) return;
    setDeletingUser(true);
    setError(null);

    try {
      await api.delete(`/admin/users/${userToDelete.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setSuccessMsg(`Account for ${userToDelete.email} has been permanently deleted.`);
      setTimeout(() => setSuccessMsg(null), 3500);
      setUserToDelete(null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to delete user');
    } finally {
      setDeletingUser(false);
    }
  };

  const handleApplyPreset = async (userId: string, presetCode: string) => {
    if (presetCode === 'CUSTOM') return;

    setSavingId(userId);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.patch(`/admin/users/${userId}/permissions`, { primaryProfile: presetCode });
      const updatedUser = res.data?.data;
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, roles: updatedUser.roles } : u))
      );
      setSuccessMsg(`Default tabs for ${presetCode} applied automatically.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to apply department preset');
    } finally {
      setSavingId(null);
    }
  };

  const handleManualToggleRole = async (userId: string, currentRoles: string[], targetRole: string) => {
    setSavingId(userId);
    setError(null);
    setSuccessMsg(null);

    const hasRole = currentRoles.includes(targetRole);
    const updatedRoles = hasRole
      ? currentRoles.filter((r) => r !== targetRole)
      : [...currentRoles, targetRole];

    try {
      await api.patch(`/admin/users/${userId}/permissions`, { roles: updatedRoles });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, roles: updatedRoles } : u))
      );
      setSuccessMsg('Permissions modified manually.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to update user authorization');
    } finally {
      setSavingId(null);
    }
  };

  const detectActivePreset = (roles: string[] = []): string => {
    if (roles.includes('ADMIN')) return 'ADMIN';
    if (roles.length === 1 && ALL_DEPARTMENTS.some((d) => d.code === roles[0])) {
      return roles[0];
    }
    return 'CUSTOM';
  };

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] p-6 overflow-hidden select-none">
      {/* Top Deck Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl px-6 py-4 mb-4 shadow-sm flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-amber-200 shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-sm font-black text-slate-900 tracking-wider uppercase leading-none">
                Executive Access & Department Role Provisioning
              </h1>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-widest bg-amber-50 text-amber-800 border border-amber-200/80">
                Super Admin
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal mt-0.5">
              Assign primary department roles to auto-configure tabs, or manually customize tab visibility per account.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-950 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Provision New User</span>
          </button>

          <button
            type="button"
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-2.5 rounded-xl mb-3 text-xs font-medium shadow-sm">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl mb-3 text-xs font-medium shadow-sm">
          <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* User Table Matrix */}
      <div className="flex-1 bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            <h2 className="text-xs font-bold text-slate-900 tracking-wider uppercase">
              User Department Provisioning Matrix
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">
            Use <strong>Primary Role Preset</strong> to auto-assign defaults, then fine-tune tabs manually as needed
          </span>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#FAF9F6] text-slate-500 font-extrabold uppercase sticky top-0 z-10 text-[9px] tracking-[0.14em] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 border-r border-slate-200/60">User Account</th>
                <th className="py-3 px-4 border-r border-slate-200/60 w-56">Primary Role (Auto-Config)</th>
                <th className="py-3 px-4 border-r border-slate-200/60 text-center w-28">Global MR11</th>
                {ALL_DEPARTMENTS.map((dept) => (
                  <th key={dept.code} className="py-3 px-3 border-r border-slate-200/60 text-center">
                    {dept.label}
                  </th>
                ))}
                <th className="py-3 px-4 text-center w-20">State</th>
                <th className="py-3 px-3 text-center w-16">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {users.map((u) => {
                const isRootAdmin = u.email === 'admin@mfeformwork.com';
                const hasAdminRole = isRootAdmin || u.roles?.includes('ADMIN');
                const isSaving = savingId === u.id;
                const activePreset = detectActivePreset(u.roles);

                return (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 border-r border-slate-200/60">
                      <div className="flex items-center gap-2">
                        {hasAdminRole && <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                        <span className="font-semibold text-slate-900 leading-tight">
                          {u.fullName || 'Corporate User'}
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                        {u.email}
                      </div>
                    </td>

                    <td className="py-3 px-4 border-r border-slate-200/60">
                      {isRootAdmin ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          <Lock className="w-3 h-3" /> Root Administrator
                        </span>
                      ) : (
                        <select
                          value={activePreset}
                          disabled={isSaving}
                          onChange={(e) => handleApplyPreset(u.id, e.target.value)}
                          className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none focus:border-slate-900 focus:bg-white transition cursor-pointer disabled:opacity-50"
                        >
                          {DEPARTMENT_PRESETS.map((p) => (
                            <option key={p.code} value={p.code}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>

                    <td className="py-3 px-4 border-r border-slate-200/60 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <Check className="w-3 h-3" /> Always ON
                      </span>
                    </td>

                    {ALL_DEPARTMENTS.map((dept) => {
                      const isAllowed = hasAdminRole || u.roles?.includes(dept.code);

                      return (
                        <td key={dept.code} className="py-3 px-3 border-r border-slate-200/60 text-center">
                          {hasAdminRole ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500">
                              <Check className="w-2.5 h-2.5 text-slate-400" /> Full Access
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleManualToggleRole(u.id, u.roles || [], dept.code)}
                              disabled={isSaving}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-tight transition-all cursor-pointer active:scale-95 disabled:opacity-50 ${
                                isAllowed
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-sm'
                                  : 'bg-slate-100 text-slate-400 hover:text-slate-600 border border-slate-200'
                              }`}
                            >
                              {isAllowed ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>Enabled</span>
                                </>
                              ) : (
                                <>
                                  <X className="w-3 h-3 text-slate-400" />
                                  <span>Hidden</span>
                                </>
                              )}
                            </button>
                          )}
                        </td>
                      );
                    })}

                    <td className="py-3 px-4 text-center font-mono text-[10px] border-r border-slate-200/60">
                      {isSaving ? (
                        <span className="text-blue-600 font-semibold animate-pulse">Saving...</span>
                      ) : hasAdminRole ? (
                        <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          ADMIN
                        </span>
                      ) : (
                        <span className="text-slate-400">ACTIVE</span>
                      )}
                    </td>

                    {/* Delete User Action */}
                    <td className="py-3 px-3 text-center">
                      {isRootAdmin ? (
                        <span className="text-slate-300" title="Protected System Account">
                          —
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setUserToDelete(u)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete User Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-sm p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete User Account</h3>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-5 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
              Are you sure you want to permanently delete{' '}
              <strong className="text-slate-900">{userToDelete.email}</strong>? Their access rights and session tokens will be revoked immediately.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={deletingUser}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUserConfirm}
                disabled={deletingUser}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                {deletingUser ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Provision New User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center text-white">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Provision New User</h3>
                  <p className="text-[11px] text-slate-400">Create an authorized employee account</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex Wong"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Corporate Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@mfeformwork.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Temporary Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Primary Department Profile
                </label>
                <select
                  value={newProfile}
                  onChange={(e) => setNewProfile(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition"
                >
                  <option value="BD">Business Development</option>
                  <option value="FINANCE">Finance</option>
                  <option value="SHELLPLAN">ShellPlan</option>
                  <option value="DESIGN">Design</option>
                  <option value="PLANNING">Planning</option>
                  <option value="PRODUCTION">Production</option>
                  <option value="DISPATCH">Dispatch</option>
                  <option value="ADMIN">System Administrator</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="px-4 py-1.5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {creatingUser ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};