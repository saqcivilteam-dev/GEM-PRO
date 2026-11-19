import React, { useState, useEffect } from 'react';
import {
  Server,
  Users,
  Wifi,
  WifiOff,
  Copy,
  Check,
  RefreshCw,
  X,
  ExternalLink,
  ShieldCheck,
  Radio,
  Clock,
  Sparkles,
  Share2,
  MessageCircle,
  Mail,
  CheckCircle2,
} from 'lucide-react';
import { realtimeClient, OnlineUser, ConnectionStatus } from '../utils/realtimeClient';
import { UserAccount } from '../types/tracker';
import { getPublicShareUrl } from '../utils/shareUtils';

interface TeamServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
  onlineUsers: OnlineUser[];
  connectionStatus: ConnectionStatus;
  onForceSyncPush: () => void;
  onForceSyncPull: () => void;
  trackersCount: number;
  rowsCount: number;
  activeTrackerId?: string;
}

export const TeamServerModal: React.FC<TeamServerModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onlineUsers,
  connectionStatus,
  onForceSyncPush,
  onForceSyncPull,
  trackersCount,
  rowsCount,
  activeTrackerId,
}) => {
  const [copied, setCopied] = useState(false);
  const [serverHealth, setServerHealth] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pingTime, setPingTime] = useState<number | null>(null);

  // Determine public accessible share URL (automatically converts private ais-dev- to public ais-pre-)
  const shareUrl = getPublicShareUrl({ trackerId: activeTrackerId, role: 'editor' });

  useEffect(() => {
    if (isOpen) {
      loadHealth();
      measurePing();
    }
  }, [isOpen]);

  const loadHealth = async () => {
    const health = await realtimeClient.fetchServerHealth();
    if (health) setServerHealth(health);
  };

  const measurePing = () => {
    const start = performance.now();
    fetch('/api/health')
      .then(() => {
        setPingTime(Math.round(performance.now() - start));
      })
      .catch(() => {
        setPingTime(null);
      });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(`Here is our SAQ Civil Team Real-Time Tracker link: ${shareUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent('SAQ Civil Team Real-Time Tracker Link');
    const body = encodeURIComponent(`Hello Team,\n\nHere is our live project tracker. Any updates or changes you make will sync in real time across the team:\n\n${shareUrl}\n\nNo installation or setup needed.`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleManualPush = async () => {
    setIsSyncing(true);
    try {
      await onForceSyncPush();
      await loadHealth();
    } finally {
      setTimeout(() => setIsSyncing(false), 600);
    }
  };

  const handleManualPull = async () => {
    setIsSyncing(true);
    try {
      await onForceSyncPull();
      await loadHealth();
    } finally {
      setTimeout(() => setIsSyncing(false), 600);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-3 md:p-6 overflow-y-auto">
      <div className="relative w-full max-w-2xl flex flex-col rounded-2xl bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Server className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Free Real-Time Database &amp; Team Sharing
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  100% Free · 0 Setup
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Instant team collaboration without Cloudflare, Firebase, or external setup
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Server Status Banner */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                {connectionStatus === 'connected' ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 block" />
                    <span className="absolute inset-0 w-3.5 h-3.5 rounded-full bg-emerald-400 animate-ping opacity-75" />
                  </>
                ) : connectionStatus === 'connecting' ? (
                  <span className="w-3.5 h-3.5 rounded-full bg-amber-500 block animate-pulse" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full bg-rose-500 block" />
                )}
              </div>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Server Connection:</span>
                  <span
                    className={
                      connectionStatus === 'connected'
                        ? 'text-emerald-400'
                        : connectionStatus === 'connecting'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }
                  >
                    {connectionStatus === 'connected'
                      ? 'Online & Streaming'
                      : connectionStatus === 'connecting'
                      ? 'Connecting to Server...'
                      : 'Offline (Local Mode)'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                  <span>WebSocket: ws:// / wss://</span>
                  <span>·</span>
                  <span>Latency: {pingTime !== null ? `${pingTime}ms` : 'Checking...'}</span>
                  {serverHealth && (
                    <>
                      <span>·</span>
                      <span>Uptime: {serverHealth.uptimeSeconds}s</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => realtimeClient.retryConnection()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Reconnect WebSocket"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reconnect</span>
              </button>
            </div>
          </div>

          {/* Share with Team Card (Zero Trouble, 100% Free) */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-indigo-950/20 border border-indigo-700/60 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  1-Click Team Invite &amp; Real-Time Sync
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                Active &amp; Free Forever
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-200 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>No Cloudflare or Firebase setup required!</strong> Your tracker already has a built-in real-time database with live WebSockets. Just share this link with your team — anyone who opens it gets live real-time sync with 0 installation.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400">Shareable Team Tracker Link:</label>
              <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-700">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="w-full bg-transparent text-xs text-sky-300 font-mono focus:outline-hidden px-1 select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Share Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700/60 text-emerald-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Share via WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleShareEmail}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5 text-sky-400" />
                <span>Send via Email</span>
              </button>

              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in New Tab</span>
              </a>
            </div>
          </div>

          {/* Active Online Teammates */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-400" />
                <span>Teammates Currently Online ({onlineUsers.length || 1})</span>
              </h3>
              <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold">
                <Radio className="w-3 h-3 animate-pulse" /> Live Presence Active
              </span>
            </div>

            <div className="divide-y divide-slate-800 rounded-xl bg-slate-950 border border-slate-800 max-h-48 overflow-y-auto">
              {onlineUsers.length === 0 ? (
                <div className="p-3 text-xs text-slate-400 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white text-[11px]">
                      {currentUser.name.charAt(0)}
                    </div>
                    <div>
                      <span className="font-semibold text-white">{currentUser.name}</span>
                      <span className="text-slate-500 ml-1.5">({currentUser.email})</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">You (Connected)</span>
                </div>
              ) : (
                onlineUsers.map((u, idx) => (
                  <div key={u.id || idx} className="p-3 text-xs text-slate-300 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white text-xs shadow-xs">
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{u.name}</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-slate-800 text-sky-400 border border-slate-700">
                            {u.role}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {u.email}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/70 border border-emerald-800 text-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Online
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Data Synchronization Controls */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-semibold">Active Cloud Portfolio State:</span>
              <span className="text-emerald-400 font-mono font-bold">
                {trackersCount} Trackers · {rowsCount} Sites Tracked
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-850">
              <button
                type="button"
                onClick={handleManualPush}
                disabled={isSyncing}
                className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
                <span>Push Local State to Server</span>
              </button>

              <button
                type="button"
                onClick={handleManualPull}
                disabled={isSyncing}
                className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-white' : ''}`} />
                <span>Pull Latest from Server</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Automatic continuous sync active on port 3000 / Cloud Run</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
