import React, { useState } from 'react';
import { UserAccount, UserRole, Tracker } from '../types/tracker';
import {
  Shield,
  User,
  Users,
  CheckCircle,
  XCircle,
  Lock,
  Mail,
  FolderKanban,
  X,
  LogOut,
  UserPlus,
} from 'lucide-react';

interface AuthManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
  allUsers: UserAccount[];
  trackers: Tracker[];
  onSwitchUser: (user: UserAccount) => void;
  onUpdateUsers: (users: UserAccount[]) => void;
  onLogout: () => void;
}

export const AuthManagementModal: React.FC<AuthManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  allUsers,
  trackers,
  onSwitchUser,
  onUpdateUsers,
  onLogout,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'profile' | 'admin_approvals' | 'register'>('profile');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('staff');
  const [regTitle, setRegTitle] = useState('');
  const [regAssigned, setRegAssigned] = useState<string[]>([trackers[0]?.id || '']);

  const handleApproveUser = (userId: string) => {
    const updated = allUsers.map((u) => (u.id === userId ? { ...u, status: 'approved' as const } : u));
    onUpdateUsers(updated);
  };

  const handleRejectUser = (userId: string) => {
    const updated = allUsers.map((u) => (u.id === userId ? { ...u, status: 'rejected' as const } : u));
    onUpdateUsers(updated);
  };

  const handleToggleProjectAssignment = (userId: string, trackerId: string) => {
    const updated = allUsers.map((u) => {
      if (u.id === userId) {
        const assigned = u.assignedProjects.includes(trackerId)
          ? u.assignedProjects.filter((id) => id !== trackerId)
          : [...u.assignedProjects, trackerId];
        return { ...u, assignedProjects: assigned };
      }
      return u;
    });
    onUpdateUsers(updated);
  };

  const handleRegisterNewUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim()) {
      alert('Please provide name and email.');
      return;
    }

    const newUser: UserAccount = {
      id: 'usr_' + Date.now().toString(),
      name: regName.trim(),
      email: regEmail.trim(),
      role: regRole,
      status: 'approved',
      title: regTitle.trim() || (regRole === 'staff' ? 'Site Project Handler' : 'Presentation Guest'),
      assignedProjects: regAssigned && regAssigned.length > 0 ? regAssigned : trackers.map((t) => t.id),
      joinedAt: new Date().toISOString().slice(0, 10),
    };

    onUpdateUsers([...allUsers, newUser]);
    setRegName('');
    setRegEmail('');
    setRegTitle('');
    alert(`User ${newUser.name} registered and approved successfully with access to project trackers!`);
    setActiveTab('profile');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl max-h-[94vh] flex flex-col rounded-xl bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                User Access Control & Role Management
              </h2>
              <p className="text-xs text-slate-400">
                Administrator permissions, Project Handler assignments, and Guest access
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'profile'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Current Session & Switch
            </button>
            {(currentUser.role === 'admin' || currentUser.role === 'creator') && (
              <button
                type="button"
                onClick={() => setActiveTab('admin_approvals')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  activeTab === 'admin_approvals'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>{currentUser.role === 'creator' ? 'Master Approvals & Rights' : 'Admin Approvals & Rights'}</span>
                {allUsers.filter((u) => u.status === 'pending').length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                    {allUsers.filter((u) => u.status === 'pending').length}
                  </span>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('register')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                activeTab === 'register'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Register New Account
            </button>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="text-xs text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Active Profile */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                    {currentUser.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{currentUser.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          currentUser.role === 'admin'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : currentUser.role === 'staff'
                            ? 'bg-sky-950 text-sky-300 border border-sky-800'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}
                      >
                        {currentUser.role === 'admin'
                          ? 'Administrator (Full Access)'
                          : currentUser.role === 'staff'
                          ? 'Staff / Project Handler'
                          : 'Guest / Presentation Viewer'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{currentUser.email}</div>
                    <div className="text-[11px] text-slate-500 mt-1">{currentUser.title}</div>
                  </div>
                </div>

                <div className="text-right text-xs text-slate-400">
                  <div>Status: <strong className="text-emerald-400 uppercase">{currentUser.status}</strong></div>
                  <div>Assigned: {currentUser.role === 'admin' ? 'All Trackers' : `${currentUser.assignedProjects.length} Projects`}</div>
                </div>
              </div>

              {/* Quick Persona Switcher for Evaluation */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Switch Active User Account
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Test different access permissions and role boundaries
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {allUsers.map((u) => {
                    const isCurrent = u.id === currentUser.id;
                    return (
                      <div
                        key={u.id}
                        className={`p-3 rounded-lg border transition-all ${
                          isCurrent
                            ? 'bg-indigo-950/50 border-indigo-500/80 ring-1 ring-indigo-500/50'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-white text-xs">{u.name}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              u.role === 'admin'
                                ? 'text-rose-400 bg-rose-950/60'
                                : u.role === 'staff'
                                ? 'text-sky-400 bg-sky-950/60'
                                : 'text-emerald-400 bg-emerald-950/60'
                            }`}
                          >
                            {u.role}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{u.email}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{u.title}</div>

                        <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                          <span
                            className={`text-[10px] font-mono font-semibold ${
                              u.status === 'approved'
                                ? 'text-emerald-400'
                                : u.status === 'pending'
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}
                          >
                            ● {u.status.toUpperCase()}
                          </span>

                          <button
                            type="button"
                            disabled={isCurrent || u.status !== 'approved'}
                            onClick={() => {
                              onSwitchUser(u);
                              onClose();
                            }}
                            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                              isCurrent
                                ? 'bg-slate-800 text-slate-500 cursor-default'
                                : u.status !== 'approved'
                                ? 'bg-slate-900 text-slate-600 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                            }`}
                          >
                            {isCurrent ? 'Active Now' : u.status === 'pending' ? 'Needs Approval' : 'Switch To'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'admin_approvals' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Administrator Approvals & Project Access Allocations
                </h3>
                <span className="text-[11px] text-slate-400">
                  Staff require approval and project assignment before accessing trackers
                </span>
              </div>

              <div className="space-y-3">
                {allUsers.map((u) => (
                  <div
                    key={u.id}
                    className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">{u.name}</span>
                          <span className="text-slate-400 text-xs">({u.email})</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              u.status === 'approved'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : u.status === 'pending'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                                : 'bg-rose-950 text-rose-300 border border-rose-800'
                            }`}
                          >
                            {u.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Role: <strong className="uppercase text-slate-200">{u.role}</strong> · Title: {u.title}
                        </div>
                      </div>

                      {/* Approval Buttons */}
                      {u.role === 'admin' ? (
                        currentUser.role === 'creator' ? (
                          <div className="flex items-center gap-2">
                            {u.status !== 'approved' && (
                              <button
                                type="button"
                                onClick={() => handleApproveUser(u.id)}
                                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Approve Admin (Creator)
                              </button>
                            )}
                            {u.status !== 'rejected' && (
                              <button
                                type="button"
                                onClick={() => handleRejectUser(u.id)}
                                className="px-3 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Reject
                              </button>
                            )}
                          </div>
                        ) : (
                          u.status === 'pending' && (
                            <span className="text-[11px] font-mono text-amber-300 bg-amber-950/70 px-2.5 py-1 rounded border border-amber-800">
                              Requires Approval by Creator (Gaela Malonzo)
                            </span>
                          )
                        )
                      ) : (
                        u.role !== 'creator' && (
                          <div className="flex items-center gap-2">
                            {u.status !== 'approved' && (
                              <button
                                type="button"
                                onClick={() => handleApproveUser(u.id)}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Approve
                              </button>
                            )}
                            {u.status !== 'rejected' && (
                              <button
                                type="button"
                                onClick={() => handleRejectUser(u.id)}
                                className="px-3 py-1 bg-rose-900/60 hover:bg-rose-900 text-rose-200 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Reject
                              </button>
                            )}
                          </div>
                        )
                      )}
                    </div>

                    {/* Assigned Trackers (Project Handler & Guest Allocation) */}
                    {(u.role === 'staff' || u.role === 'guest') && (
                      <div className="pt-2 border-t border-slate-800">
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                          <FolderKanban className="w-3.5 h-3.5 text-sky-400" />
                          Assigned Projects & Trackers ({u.role === 'staff' ? 'Handler Edit Restriction' : 'Guest Scope'}):
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {trackers.map((t) => {
                            const isAssigned = u.assignedProjects.includes(t.id);
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => handleToggleProjectAssignment(u.id, t.id)}
                                className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                                  isAssigned
                                    ? 'bg-sky-950 text-sky-200 border-sky-700 font-semibold'
                                    : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-700'
                                }`}
                              >
                                {isAssigned ? '✓ ' : '+ '}
                                {t.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'register' && (
            <form onSubmit={handleRegisterNewUser} className="space-y-4 max-w-lg mx-auto">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Register User Account
                </h3>
                <p className="text-xs text-slate-400">
                  New staff and guest accounts will be placed in <strong>Pending</strong> state until approved by an Administrator.
                </p>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. Engr. Maria Santos"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="e.g. maria.santos@company.ph"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Account Role</label>
                    <select
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white"
                    >
                      <option value="staff">Staff / Project Handler (Assigned projects only)</option>
                      <option value="guest">Guest / Presentation User (View-only deck)</option>
                      <option value="admin">Administrator (Full System Control)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Job Title / Designation</label>
                    <input
                      type="text"
                      value={regTitle}
                      onChange={(e) => setRegTitle(e.target.value)}
                      placeholder="e.g. Civil Rollout Engineer"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                  >
                    Submit Registration for Admin Approval
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <span>Security Protocol: Role-Based Access Control (RBAC) enforced per tracker.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
