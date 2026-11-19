import React, { useState, useEffect } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Users,
  Shield,
  Edit3,
  Eye,
  Crown,
  QrCode,
  MessageCircle,
  Mail,
  Wifi,
  Sparkles,
  ExternalLink,
  Radio,
  Clock,
  Send,
} from 'lucide-react';
import { UserAccount } from '../types/tracker';
import { OnlineUser, ConnectionStatus, realtimeClient } from '../utils/realtimeClient';
import { getPublicShareUrl } from '../utils/shareUtils';

interface ShareCollaborateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
  onlineUsers: OnlineUser[];
  connectionStatus: ConnectionStatus;
  activeTrackerId: string;
  activeTrackerName: string;
}

export const ShareCollaborateModal: React.FC<ShareCollaborateModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onlineUsers,
  connectionStatus,
  activeTrackerId,
  activeTrackerName,
}) => {
  const [selectedRole, setSelectedRole] = useState<'editor' | 'viewer' | 'admin'>('editor');
  const [coworkerName, setCoworkerName] = useState('');
  const [copied, setCopied] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [pingSent, setPingSent] = useState(false);

  // Generate shareable public URL with options
  const shareUrl = getPublicShareUrl({
    trackerId: activeTrackerId,
    role: selectedRole,
    coworkerName: coworkerName.trim() || undefined,
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2800);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `👋 Hello! Here is the live link to collaborate on our project tracker "${activeTrackerName}". You can update rows, dates, and SLA status in real time (100% Free):\n\n${shareUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent(`Live Project Tracker Link: ${activeTrackerName}`);
    const body = encodeURIComponent(
      `Hello,\n\nPlease use this link to access and update our live project tracker in real time:\n\nProject: ${activeTrackerName}\nLink: ${shareUrl}\n\nAny edits made will automatically sync across the entire team in real time without any software installation or setup required.\n\nBest regards,\n${currentUser.name}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleBroadcastPing = () => {
    realtimeClient.send({
      type: 'STATE_UPDATED',
      payload: {
        userName: `${currentUser.name} (Live Ping)`,
        timestamp: new Date().toISOString(),
      },
    });
    setPingSent(true);
    setTimeout(() => setPingSent(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8 max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Share Tracker with Co-workers</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
                  100% Free Real-Time
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Generate free live links so teammates can view and update <span className="text-indigo-300 font-semibold">{activeTrackerName}</span> together.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* 1. Permission Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Step 1: Choose Co-worker Access Level
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Co-worker Editor */}
              <button
                type="button"
                onClick={() => setSelectedRole('editor')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                  selectedRole === 'editor'
                    ? 'bg-indigo-950/50 border-indigo-500 ring-2 ring-indigo-500/20 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Edit3 className={`w-4 h-4 ${selectedRole === 'editor' ? 'text-indigo-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold text-white">Co-worker Editor</span>
                  </div>
                  {selectedRole === 'editor' && <Check className="w-4 h-4 text-indigo-400" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Can edit cells, update dates, change SLA, and add rows in real-time.
                </p>
                <span className="mt-2 inline-block px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">
                  Recommended for Team
                </span>
              </button>

              {/* View Only */}
              <button
                type="button"
                onClick={() => setSelectedRole('viewer')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                  selectedRole === 'viewer'
                    ? 'bg-sky-950/50 border-sky-500 ring-2 ring-sky-500/20 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Eye className={`w-4 h-4 ${selectedRole === 'viewer' ? 'text-sky-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold text-white">View Only</span>
                  </div>
                  {selectedRole === 'viewer' && <Check className="w-4 h-4 text-sky-400" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Can view all sites, SLA status, and dashboards. Cannot edit data.
                </p>
                <span className="mt-2 inline-block px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 text-[10px] font-semibold">
                  For Auditors & Clients
                </span>
              </button>

              {/* Admin Access */}
              <button
                type="button"
                onClick={() => setSelectedRole('admin')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                  selectedRole === 'admin'
                    ? 'bg-rose-950/50 border-rose-500 ring-2 ring-rose-500/20 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Crown className={`w-4 h-4 ${selectedRole === 'admin' ? 'text-rose-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold text-white">Full Admin</span>
                  </div>
                  {selectedRole === 'admin' && <Check className="w-4 h-4 text-rose-400" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Full control: edit, delete rows, approve teammates, and customize columns.
                </p>
                <span className="mt-2 inline-block px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[10px] font-semibold">
                  For Project Leads
                </span>
              </button>
            </div>
          </div>

          {/* 2. Optional Personalization for Co-worker */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Step 2: Co-worker Name <span className="text-slate-500 font-normal lowercase">(optional)</span>
            </label>
            <input
              type="text"
              value={coworkerName}
              onChange={(e) => setCoworkerName(e.target.value)}
              placeholder="e.g. Engr. Mark, Sarah SAQ, or Civil Contractor"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500 transition-colors"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Adding a name personalizes the welcome message and automatically labels their edits in the real-time activity feed.
            </p>
          </div>

          {/* 3. Generated Shareable Link Box */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Generated Free Collaboration Link</span>
              </span>
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Sync Enabled
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs font-mono select-all focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleCopy}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-md ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mt-2.5 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>
                <strong>Landing Page:</strong> Recipients will automatically arrive at the <strong className="text-white">Login &amp; Governance Portal</strong> to authenticate or continue via Instant View Mode.
              </span>
            </p>

            {/* Quick Share Buttons */}
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700/50 text-emerald-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Share via WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleShareEmail}
                className="px-3 py-1.5 rounded-lg bg-sky-950/60 hover:bg-sky-900/80 border border-sky-700/50 text-sky-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5 text-sky-400" />
                <span>Send Email</span>
              </button>

              <button
                type="button"
                onClick={() => setShowQrCode(!showQrCode)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  showQrCode
                    ? 'bg-slate-800 border-indigo-500 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <QrCode className="w-3.5 h-3.5 text-indigo-400" />
                <span>{showQrCode ? 'Hide QR Code' : 'Scan QR on Mobile'}</span>
              </button>

              <button
                type="button"
                onClick={handleBroadcastPing}
                disabled={pingSent}
                className="ml-auto px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Send test signal to test real-time connection across devices"
              >
                <Send className="w-3 h-3 text-indigo-400" />
                <span>{pingSent ? 'Ping Broadcasted!' : 'Test Live Ping'}</span>
              </button>
            </div>

            {/* QR Code Expansion */}
            {showQrCode && (
              <div className="mt-4 p-4 bg-white rounded-xl flex flex-col items-center justify-center text-center animate-fade-in">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`}
                  alt="Scan QR Code to open tracker"
                  className="w-40 h-40 object-contain rounded-md shadow-xs"
                />
                <p className="text-slate-800 font-bold text-xs mt-2">Scan with Smartphone or Tablet Camera</p>
                <p className="text-slate-500 text-[11px]">Opens live editable tracker on mobile browser with 0 setup</p>
              </div>
            )}
          </div>

          {/* 4. Live Connected Co-workers Strip */}
          <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/40">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white">Active Co-workers Online ({onlineUsers.length || 1})</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                <span
                  className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                <span>{connectionStatus === 'connected' ? 'WebSocket + REST Polling Active' : 'Connecting...'}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {/* Current User */}
              <div className="px-3 py-1.5 rounded-lg bg-indigo-950/40 border border-indigo-700/50 flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-semibold text-white">{currentUser.name}</span>
                <span className="px-1.5 py-0.2 rounded bg-indigo-600/30 text-indigo-300 text-[10px] font-mono">
                  {currentUser.role === 'creator' ? 'Creator (You)' : 'You'}
                </span>
              </div>

              {/* Connected Remote Coworkers */}
              {onlineUsers
                .filter((u) => u.name && u.name !== currentUser.name)
                .map((user, idx) => (
                  <div
                    key={user.id || user.clientId || idx}
                    className="px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-700/50 flex items-center gap-2 text-xs animate-fade-in"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-semibold text-emerald-200">{user.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">Co-worker</span>
                  </div>
                ))}

              {onlineUsers.filter((u) => u.name && u.name !== currentUser.name).length === 0 && (
                <div className="text-slate-500 text-xs italic py-1">
                  No other co-workers connected right now. Share the link above to collaborate together live!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Zero software to install · Works on Windows, Mac, Android & iOS</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
