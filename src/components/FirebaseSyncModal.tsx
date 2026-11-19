import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  X,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Layers,
  Clock,
  Radio,
  Server,
  Activity,
  HardDrive,
} from 'lucide-react';
import {
  getFirebaseConfigInfo,
  testFirestoreConnection,
  syncAllTrackersToFirestore,
  loadTrackersFromFirestore,
} from '../utils/firebaseClient';
import { Tracker } from '../types/tracker';

interface FirebaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackers: Tracker[];
  onTrackersLoaded: (trackers: Tracker[]) => void;
  isFirebaseActive: boolean;
  onToggleFirebaseAutoSync: (enabled: boolean) => void;
  lastSyncedAt: string | null;
}

export const FirebaseSyncModal: React.FC<FirebaseSyncModalProps> = ({
  isOpen,
  onClose,
  trackers,
  onTrackersLoaded,
  isFirebaseActive,
  onToggleFirebaseAutoSync,
  lastSyncedAt,
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'testing' | 'error'>('testing');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const configInfo = getFirebaseConfigInfo();

  useEffect(() => {
    if (isOpen) {
      handleTestConnection();
    }
  }, [isOpen]);

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setIsConnecting(true);
    setErrorMessage(null);
    try {
      const result = await testFirestoreConnection();
      if (result.success) {
        setConnectionStatus('connected');
        setLatencyMs(result.latencyMs || 25);
      } else {
        setConnectionStatus('error');
        setErrorMessage(result.error || 'Connection check failed');
      }
    } catch (e: any) {
      setConnectionStatus('error');
      setErrorMessage(e.message || 'Error communicating with Firestore');
    } finally {
      setIsConnecting(false);
    }
  };

  const handlePushToFirebase = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const result = await syncAllTrackersToFirestore(trackers);
      if (result.success) {
        setSyncFeedback(`Successfully synchronized ${result.count} trackers to Firestore!`);
      } else {
        setErrorMessage(result.error || 'Failed to sync trackers');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 3500);
    }
  };

  const handlePullFromFirebase = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const loaded = await loadTrackersFromFirestore();
      if (loaded && loaded.length > 0) {
        onTrackersLoaded(loaded);
        setSyncFeedback(`Restored ${loaded.length} trackers from Firestore!`);
      } else {
        setSyncFeedback('No trackers found in Firestore collection yet.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load from Firestore');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 3500);
    }
  };

  if (!isOpen) return null;

  const totalSites = trackers.reduce((sum, t) => sum + (Array.isArray(t.rows) ? t.rows.length : 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8 max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Free Cloud Database (Firebase Firestore)</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
                  Active & 100% Free
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Google Cloud Firestore provisioned with zero hosting cost & real-time multi-user synchronization.
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
          {/* 1. Connection Status Banner */}
          <div className="p-4 rounded-xl border bg-slate-950/60 border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-400 animate-pulse'
                    : connectionStatus === 'testing'
                    ? 'bg-amber-400 animate-ping'
                    : 'bg-rose-500'
                }`}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">
                    {connectionStatus === 'connected'
                      ? 'Firestore Database Connected'
                      : connectionStatus === 'testing'
                      ? 'Testing Connection...'
                      : 'Connection Warning'}
                  </span>
                  {latencyMs !== null && (
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {latencyMs}ms Latency
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Project: <span className="text-amber-300 font-mono font-medium">{configInfo.projectId}</span>
                  {' · '}
                  Database: <span className="text-slate-300 font-mono text-[10px]">{configInfo.databaseId}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isConnecting}
              onClick={handleTestConnection}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
              <span>Ping Database</span>
            </button>
          </div>

          {/* Feedback & Error Notices */}
          {syncFeedback && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{syncFeedback}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-700/60 text-rose-300 text-xs flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 2. Database Stats & Real-Time Sync Switch */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40">
              <span className="text-[11px] text-slate-400 font-medium">Local Trackers</span>
              <p className="text-lg font-bold text-white mt-1">{trackers.length} Trackers</p>
              <span className="text-[10px] text-slate-500">{totalSites} sites indexed</span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40">
              <span className="text-[11px] text-slate-400 font-medium">Free Plan Quota</span>
              <p className="text-lg font-bold text-emerald-400 mt-1">50,000 / day</p>
              <span className="text-[10px] text-slate-500">100% Free Forever</span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 flex flex-col justify-between">
              <div>
                <span className="text-[11px] text-slate-400 font-medium">Live Auto-Sync</span>
                <p className="text-xs font-bold text-slate-200 mt-1">
                  {isFirebaseActive ? 'Enabled (Instant Save)' : 'Manual Sync'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onToggleFirebaseAutoSync(!isFirebaseActive)}
                className={`mt-2 py-1 px-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer text-center ${
                  isFirebaseActive
                    ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {isFirebaseActive ? 'Auto-Sync ON' : 'Turn Auto-Sync ON'}
              </button>
            </div>
          </div>

          {/* 3. Manual Sync Actions */}
          <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/50 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Database Sync & Backup Actions
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isSyncing}
                onClick={handlePushToFirebase}
                className="p-3.5 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 border border-amber-600/50 text-white flex items-center justify-between transition-all cursor-pointer shadow-sm group disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                    <UploadCloud className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-bold text-amber-200 block">Push Trackers to Firebase</span>
                    <span className="text-[10px] text-slate-400">Backs up all sheets & sites to cloud</span>
                  </div>
                </div>
                <span className="text-[11px] text-amber-400 font-bold">Push</span>
              </button>

              <button
                type="button"
                disabled={isSyncing}
                onClick={handlePullFromFirebase}
                className="p-3.5 rounded-xl bg-sky-950/40 hover:bg-sky-900/60 border border-sky-600/50 text-white flex items-center justify-between transition-all cursor-pointer shadow-sm group disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400">
                    <DownloadCloud className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-bold text-sky-200 block">Restore from Firebase</span>
                    <span className="text-[10px] text-slate-400">Loads latest cloud database sheets</span>
                  </div>
                </div>
                <span className="text-[11px] text-sky-400 font-bold">Pull</span>
              </button>
            </div>

            {lastSyncedAt && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Last successfully synchronized: {lastSyncedAt}</span>
              </div>
            )}
          </div>

          {/* 4. Why This Database is 100% Free Guarantee */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Free Database Guarantee (Google Cloud Spark Tier)</span>
            </div>
            <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside">
              <li><strong className="text-slate-200">Zero Setup Required:</strong> Your Firebase project has been provisioned directly inside Google Cloud.</li>
              <li><strong className="text-slate-200">Never Expires:</strong> Includes 1 GB stored documents, 50,000 free reads/day, and 20,000 writes/day free forever.</li>
              <li><strong className="text-slate-200">Real-Time Sync:</strong> Edits sync automatically across co-workers and devices.</li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ready for multi-user real-time collaboration</span>
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
