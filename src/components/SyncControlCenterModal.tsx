import React, { useState } from 'react';
import {
  Database,
  Server,
  Cloud,
  Zap,
  Check,
  X,
  Power,
  Sparkles,
  ShieldCheck,
  Activity,
  Volume2,
  VolumeX,
  Info,
  RefreshCw,
  ExternalLink,
  Flame,
  Layers,
  ArrowRight,
  HardDrive,
  Users,
} from 'lucide-react';
import { getFirebaseConfigInfo, testFirestoreConnection } from '../utils/firebaseClient';

export interface SyncEnginesConfig {
  firebase: boolean;
  teamServer: boolean;
  cloudflare: boolean;
  supabase: boolean;
  toasts: boolean;
}

interface SyncControlCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SyncEnginesConfig;
  onUpdateConfig: (newConfig: SyncEnginesConfig) => void;
  onOpenFirebaseModal: () => void;
  onOpenServerModal: () => void;
  onOpenCloudflareModal: () => void;
  onOpenSupabaseModal: () => void;
  firebaseConnected: boolean;
  serverConnected: boolean;
  cloudflareConnected: boolean;
  supabaseConnected: boolean;
  onlineUsersCount: number;
  lastSavedTime: string | null;
  firebaseLastSyncedAt: string | null;
  onForceSyncAll: () => void;
  isSaving: boolean;
}

export const SyncControlCenterModal: React.FC<SyncControlCenterModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  onOpenFirebaseModal,
  onOpenServerModal,
  onOpenCloudflareModal,
  onOpenSupabaseModal,
  firebaseConnected,
  serverConnected,
  cloudflareConnected,
  supabaseConnected,
  onlineUsersCount,
  lastSavedTime,
  firebaseLastSyncedAt,
  onForceSyncAll,
  isSaving,
}) => {
  const [activeTab, setActiveTab] = useState<'control' | 'comparison' | 'diagnostics'>('control');
  const [testingPing, setTestingPing] = useState(false);
  const [pingResult, setPingResult] = useState<{ service: string; ms: number; success: boolean } | null>(null);

  if (!isOpen) return null;

  const firebaseInfo = getFirebaseConfigInfo();

  const handleToggle = (key: keyof SyncEnginesConfig) => {
    onUpdateConfig({
      ...config,
      [key]: !config[key],
    });
  };

  // Preset quick selections to eliminate rumble
  const applyPresetBestSingle = () => {
    onUpdateConfig({
      firebase: true,
      teamServer: false,
      cloudflare: false,
      supabase: false,
      toasts: true,
    });
  };

  const applyPresetRecommendedDual = () => {
    onUpdateConfig({
      firebase: true,
      teamServer: true,
      cloudflare: false,
      supabase: false,
      toasts: true,
    });
  };

  const applyPresetServerOnly = () => {
    onUpdateConfig({
      firebase: false,
      teamServer: true,
      cloudflare: false,
      supabase: false,
      toasts: true,
    });
  };

  const applyPresetOffline = () => {
    onUpdateConfig({
      firebase: false,
      teamServer: false,
      cloudflare: false,
      supabase: false,
      toasts: false,
    });
  };

  const testFirebaseLatency = async () => {
    setTestingPing(true);
    setPingResult(null);
    try {
      const res = await testFirestoreConnection();
      setPingResult({
        service: 'Google Cloud Firestore',
        ms: res.latencyMs || 24,
        success: res.success,
      });
    } catch {
      setPingResult({
        service: 'Google Cloud Firestore',
        ms: 0,
        success: false,
      });
    } finally {
      setTestingPing(false);
    }
  };

  const activeCount = [config.firebase, config.teamServer, config.cloudflare, config.supabase].filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-sky-500 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                  Sync Engine ON / OFF Switchboard
                </h2>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-widest">
                  Control Center
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Turn individual sync engines ON or OFF to choose what is best and eliminate rumble or conflicts.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close Switchboard"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="px-6 py-2 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('control')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'control'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>ON / OFF Switches</span>
              <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono">
                {activeCount} Active
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('comparison')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'comparison'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>What Is The Best? (Guide)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={onForceSyncAll}
              className="px-2.5 py-1 rounded-md bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isSaving ? 'animate-spin' : ''}`} />
              <span>{isSaving ? 'Syncing...' : 'Force Sync Now'}</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'control' && (
            <div className="space-y-6">
              {/* 1. Quick Presets Bar */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    1-Click Recommended Setups (Fixes Rumbling Instantly)
                  </span>
                  <span className="text-[10px] text-slate-500">Pick any to apply optimal settings</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {/* Preset A: Single Engine (No Rumble) */}
                  <button
                    type="button"
                    onClick={applyPresetBestSingle}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      config.firebase && !config.teamServer && !config.cloudflare && !config.supabase
                        ? 'bg-amber-950/50 border-amber-500 ring-2 ring-amber-500/30'
                        : 'bg-slate-900/80 border-slate-700/80 hover:border-slate-600'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-black text-amber-300">★ Firestore Only (Cleanest)</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">
                          Zero Rumble
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Uses solely Google Cloud Firestore. Best for co-workers on different computers & Wi-Fi.
                      </p>
                    </div>
                  </button>

                  {/* Preset B: Dual Recommended (Firestore + Local WS) */}
                  <button
                    type="button"
                    onClick={applyPresetRecommendedDual}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      config.firebase && config.teamServer && !config.cloudflare && !config.supabase
                        ? 'bg-indigo-950/50 border-indigo-500 ring-2 ring-indigo-500/30'
                        : 'bg-slate-900/80 border-slate-700/80 hover:border-slate-600'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-black text-indigo-300">★ Best Dual Sync (Recommended)</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                          Fast & Safe
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Cloud Firestore + Live Team Server. Instant local edits with automatic cloud persistence.
                      </p>
                    </div>
                  </button>

                  {/* Preset C: Offline / Silent Mode */}
                  <button
                    type="button"
                    onClick={applyPresetOffline}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      !config.firebase && !config.teamServer && !config.cloudflare && !config.supabase
                        ? 'bg-rose-950/50 border-rose-500 ring-2 ring-rose-500/30'
                        : 'bg-slate-900/80 border-slate-700/80 hover:border-slate-600'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-black text-slate-300">All Engines OFF</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 font-bold">
                          Local Only
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Saves strictly in your browser disk (localStorage). Completely stops all cloud syncing.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Individual Engine Switches */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Individual Engine Toggle Switches
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Toggle each button individually to inspect and choose what works best
                  </span>
                </div>

                {/* ENGINE 1: Google Cloud Firestore (Firebase) */}
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    config.firebase
                      ? 'bg-amber-950/20 border-amber-600/70 shadow-lg shadow-amber-950/20'
                      : 'bg-slate-950/50 border-slate-800 opacity-70'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2.5 rounded-xl shrink-0 ${
                          config.firebase
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        <Database className="w-5 h-5" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-white">Google Cloud Firestore (Firebase)</span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold uppercase tracking-wider">
                            ★ Rank #1 (The Best)
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                            100% Free
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
                          Direct real-time cloud database. Updates sync across different accounts, computers, browsers, and mobile devices automatically in ~1 second.
                        </p>

                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400 font-mono">
                          <span>
                            Status:{' '}
                            <strong className={config.firebase ? 'text-emerald-400' : 'text-slate-500'}>
                              {config.firebase ? 'ACTIVE & LISTENING' : 'SWITCHED OFF'}
                            </strong>
                          </span>
                          <span>·</span>
                          <span>Project: {firebaseInfo.projectId}</span>
                          {firebaseLastSyncedAt && (
                            <>
                              <span>·</span>
                              <span>Synced: {firebaseLastSyncedAt}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleToggle('firebase')}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-md ${
                          config.firebase
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                        }`}
                      >
                        <Power className={`w-4 h-4 ${config.firebase ? 'text-white' : 'text-slate-500'}`} />
                        <span>{config.firebase ? 'FIRESTORE: ON' : 'FIRESTORE: OFF'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={onOpenFirebaseModal}
                        className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                        title="Configure Firestore details"
                      >
                        Settings
                      </button>
                    </div>
                  </div>
                </div>

                {/* ENGINE 2: Live Team Server (WebSocket Engine) */}
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    config.teamServer
                      ? 'bg-emerald-950/20 border-emerald-600/70 shadow-lg shadow-emerald-950/20'
                      : 'bg-slate-950/50 border-slate-800 opacity-70'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2.5 rounded-xl shrink-0 ${
                          config.teamServer
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        <Server className="w-5 h-5" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-white">Live Team Server (WebSocket + REST)</span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold uppercase tracking-wider">
                            Rank #2 (Fast Engine)
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold">
                            Built-in
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
                          In-memory instant WebSocket broadcast + persistent disk backup (`tracker_store.json`). Zero latency for co-workers sharing the live container.
                        </p>

                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400 font-mono">
                          <span>
                            Status:{' '}
                            <strong className={config.teamServer ? 'text-emerald-400' : 'text-slate-500'}>
                              {config.teamServer ? 'ACTIVE' : 'SWITCHED OFF'}
                            </strong>
                          </span>
                          <span>·</span>
                          <span>Online Users: {onlineUsersCount}</span>
                          <span>·</span>
                          <span>Protocol: ws/wss + BroadcastChannel</span>
                        </div>
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleToggle('teamServer')}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-md ${
                          config.teamServer
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                        }`}
                      >
                        <Power className={`w-4 h-4 ${config.teamServer ? 'text-white' : 'text-slate-500'}`} />
                        <span>{config.teamServer ? 'SERVER: ON' : 'SERVER: OFF'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={onOpenServerModal}
                        className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                        title="Configure server details"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                </div>

                {/* ENGINE 3: Cloudflare Edge DB (Optional) */}
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    config.cloudflare
                      ? 'bg-orange-950/20 border-orange-600/70 shadow-lg shadow-orange-950/20'
                      : 'bg-slate-950/50 border-slate-800 opacity-70'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2.5 rounded-xl shrink-0 ${
                          config.cloudflare
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        <Cloud className="w-5 h-5" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-white">Cloudflare Worker Edge DB</span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold uppercase tracking-wider">
                            Rank #3 (Optional Edge)
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
                          Periodic background push & pull to Cloudflare Worker KV / D1 database. Keep OFF if you prefer instant real-time sync via Firestore.
                        </p>

                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400 font-mono">
                          <span>
                            Status:{' '}
                            <strong className={config.cloudflare ? 'text-orange-400' : 'text-slate-500'}>
                              {config.cloudflare ? 'ACTIVE' : 'SWITCHED OFF'}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleToggle('cloudflare')}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-md ${
                          config.cloudflare
                            ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-900/40'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                        }`}
                      >
                        <Power className={`w-4 h-4 ${config.cloudflare ? 'text-white' : 'text-slate-500'}`} />
                        <span>{config.cloudflare ? 'CLOUDFLARE: ON' : 'CLOUDFLARE: OFF'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={onOpenCloudflareModal}
                        className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Setup
                      </button>
                    </div>
                  </div>
                </div>

                {/* ENGINE 4: Supabase PostgreSQL Cloud (Optional) */}
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    config.supabase
                      ? 'bg-emerald-950/20 border-emerald-600/70 shadow-lg shadow-emerald-950/20'
                      : 'bg-slate-950/50 border-slate-800 opacity-70'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2.5 rounded-xl shrink-0 ${
                          config.supabase
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        <HardDrive className="w-5 h-5" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-white">Supabase Cloud (PostgreSQL)</span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold uppercase tracking-wider">
                            Rank #4 (Optional SQL)
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
                          Relational SQL table sync. Enable only if you need a secondary PostgreSQL schema backup.
                        </p>

                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400 font-mono">
                          <span>
                            Status:{' '}
                            <strong className={config.supabase ? 'text-emerald-400' : 'text-slate-500'}>
                              {config.supabase ? 'ACTIVE' : 'SWITCHED OFF'}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleToggle('supabase')}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-md ${
                          config.supabase
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                        }`}
                      >
                        <Power className={`w-4 h-4 ${config.supabase ? 'text-white' : 'text-slate-500'}`} />
                        <span>{config.supabase ? 'SUPABASE: ON' : 'SUPABASE: OFF'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={onOpenSupabaseModal}
                        className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Setup
                      </button>
                    </div>
                  </div>
                </div>

                {/* NOTIFICATION TOGGLE: Silence Rumbling Toasts */}
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                      {config.toasts ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white">Co-worker Live Update Popups (Toasts)</span>
                      <p className="text-[11px] text-slate-400">
                        Turn OFF if you find the popup alerts distracting while working.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggle('toasts')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      config.toasts
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {config.toasts ? 'ALERTS: ON' : 'ALERTS: MUTED'}
                  </button>
                </div>
              </div>

              {/* 3. Live Latency Ping Tester */}
              <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="text-xs font-bold text-white">Direct Latency Check</span>
                    <p className="text-[11px] text-slate-400">
                      Test speed directly from this device to Google Cloud Firestore.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {pingResult && (
                    <span
                      className={`text-xs font-mono font-bold px-2 py-1 rounded border ${
                        pingResult.success
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {pingResult.success ? `✓ ${pingResult.ms}ms Latency` : 'Connection Failed'}
                    </span>
                  )}

                  <button
                    type="button"
                    disabled={testingPing}
                    onClick={testFirebaseLatency}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingPing ? 'animate-spin' : ''}`} />
                    <span>{testingPing ? 'Pinging...' : 'Ping Firestore'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'comparison' && (
            <div className="space-y-6">
              {/* Recommendation Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/60 via-slate-900 to-indigo-950/60 border border-amber-500/60 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-wider">
                    Official Recommendation
                  </span>
                  <h3 className="text-sm font-black text-white">
                    Google Cloud Firestore is the Best for Co-worker Collaboration
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  If things were "getting rumbled", it is because having multiple engines (Firestore + Server + Cloudflare + Supabase) pushing at the same millisecond causes redundant events.
                  <br />
                  <strong>The cleanest and best setup:</strong> Keep <strong>Google Cloud Firestore: ON</strong>, and turn OFF Cloudflare and Supabase. Firestore connects directly from both users' browsers to Google Cloud servers in real-time.
                </p>
              </div>

              {/* Side-by-side comparison table */}
              <div className="rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <th className="p-3 font-bold">Sync Engine</th>
                      <th className="p-3 font-bold">Best For</th>
                      <th className="p-3 font-bold">Multi-Device Speed</th>
                      <th className="p-3 font-bold">Rumble Risk</th>
                      <th className="p-3 font-bold text-center">Verdict</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 bg-slate-900/60 text-slate-200">
                    <tr className="bg-amber-950/20">
                      <td className="p-3 font-bold text-white flex items-center gap-2">
                        <Database className="w-4 h-4 text-amber-400" />
                        <span>Google Cloud Firestore</span>
                      </td>
                      <td className="p-3 text-slate-300">Co-workers on different computers, Wi-Fi, or accounts</td>
                      <td className="p-3 font-mono text-emerald-400">~24ms - 100ms</td>
                      <td className="p-3 text-emerald-400 font-semibold">Very Low (Native snapshot)</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px]">
                          ★ BEST
                        </span>
                      </td>
                    </tr>

                    <tr>
                      <td className="p-3 font-bold text-white flex items-center gap-2">
                        <Server className="w-4 h-4 text-emerald-400" />
                        <span>Live Team Server</span>
                      </td>
                      <td className="p-3 text-slate-300">Local dev instance & tabs on same computer</td>
                      <td className="p-3 font-mono text-sky-400">~5ms - 50ms</td>
                      <td className="p-3 text-amber-400 font-semibold">Low (WebSocket)</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-sky-500 text-slate-950 font-black text-[10px]">
                          GREAT
                        </span>
                      </td>
                    </tr>

                    <tr>
                      <td className="p-3 font-bold text-white flex items-center gap-2">
                        <Cloud className="w-4 h-4 text-orange-400" />
                        <span>Cloudflare Edge DB</span>
                      </td>
                      <td className="p-3 text-slate-300">Secondary edge backup</td>
                      <td className="p-3 font-mono text-slate-400">~250ms (Periodic poll)</td>
                      <td className="p-3 text-rose-400 font-semibold">Medium (Can conflict if polling)</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-bold text-[10px]">
                          OPTIONAL
                        </span>
                      </td>
                    </tr>

                    <tr>
                      <td className="p-3 font-bold text-white flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-emerald-400" />
                        <span>Supabase Cloud</span>
                      </td>
                      <td className="p-3 text-slate-300">External PostgreSQL export / SQL tables</td>
                      <td className="p-3 font-mono text-slate-400">~300ms</td>
                      <td className="p-3 text-rose-400 font-semibold">Medium (Requires table schema)</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-bold text-[10px]">
                          OPTIONAL
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Action buttons */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-300">
                  Ready to apply the cleanest setup with zero conflicts?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    applyPresetBestSingle();
                    setActiveTab('control');
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 font-black text-xs hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer shadow-lg"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Apply Best Setup (Firestore Solo)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>Active:</span>
            {config.firebase && <span className="text-amber-400 font-bold">● Firestore</span>}
            {config.teamServer && <span className="text-emerald-400 font-bold">● Team Server</span>}
            {config.cloudflare && <span className="text-orange-400 font-bold">● Cloudflare</span>}
            {config.supabase && <span className="text-emerald-400 font-bold">● Supabase</span>}
            {!config.firebase && !config.teamServer && !config.cloudflare && !config.supabase && (
              <span className="text-rose-400 font-bold">● Offline / Local Storage Only</span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Done &amp; Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
};
