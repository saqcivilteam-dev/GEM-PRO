import React, { useState } from 'react';
import { Users, Check, Sparkles, ArrowRight, ShieldCheck, UserPlus } from 'lucide-react';
import { UserAccount } from '../types/tracker';
import { realtimeClient } from '../utils/realtimeClient';

interface CoworkerJoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackerName: string;
  trackerId: string;
  roleRequested: string;
  prefilledName?: string;
  onJoinSuccess: (user: UserAccount) => void;
}

export const CoworkerJoinModal: React.FC<CoworkerJoinModalProps> = ({
  isOpen,
  onClose,
  trackerName,
  trackerId,
  roleRequested,
  prefilledName = '',
  onJoinSuccess,
}) => {
  const [name, setName] = useState(prefilledName);
  const [title, setTitle] = useState('Site Engineer / Co-worker');

  const presetTitles = [
    'Site Engineer',
    'SAQ Officer',
    'Civil Inspector',
    'Project Coordinator',
    'Subcontractor PIC',
    'Team Lead',
  ];

  if (!isOpen) return null;

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim() || 'Team Co-worker';
    const email = `${finalName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@saqcivil.team`;

    const newUser: UserAccount = {
      id: 'user_collab_' + Date.now(),
      name: finalName,
      username: finalName.toLowerCase().replace(/\s+/g, '_'),
      email,
      role: roleRequested === 'admin' ? 'admin' : roleRequested === 'viewer' ? 'guest' : 'staff',
      status: 'approved',
      assignedProjects: [trackerId],
      title: title || 'Collaborator',
      joinedAt: new Date().toISOString(),
      isCollaborator: true,
    };

    realtimeClient.setUser(newUser, trackerId);
    onJoinSuccess(newUser);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-slate-900 border border-indigo-500/40 rounded-2xl shadow-2xl overflow-hidden p-6 animate-scale-up">
        {/* Glow effect */}
        <div className="absolute -top-12 -left-12 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-6 relative">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-inner">
            <Users className="w-7 h-7" />
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
            Free Real-Time Collaboration
          </span>
          <h2 className="text-xl font-extrabold text-white mt-2">Welcome to Live Tracker!</h2>
          <p className="text-xs text-slate-400 mt-1">
            You've been invited to collaborate live on{' '}
            <span className="text-indigo-300 font-semibold">{trackerName}</span>. Any updates you make sync across the team instantly.
          </p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4 relative">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Your Name or Nickname
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Engr. Mark, Sarah, or Dave"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Select Your Role / Tag
            </label>
            <div className="flex flex-wrap gap-1.5">
              {presetTitles.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTitle(t)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                    title === t
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs'
                      : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Start Live Collaboration</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-300 text-xs transition-colors cursor-pointer underline"
            >
              Skip and continue with default profile
            </button>
          </div>
        </form>

        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>100% Free · No registration or credit card needed</span>
        </div>
      </div>
    </div>
  );
};
