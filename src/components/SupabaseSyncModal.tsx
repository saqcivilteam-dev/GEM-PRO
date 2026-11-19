import React, { useState, useEffect } from 'react';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  testSupabaseConnection,
  saveTrackersToSupabase,
  loadTrackersFromSupabase,
  getSupabaseSqlSchema,
  SupabaseConfig,
  ConnectionTestResult,
} from '../utils/supabaseClient';
import { Tracker } from '../types/tracker';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  ExternalLink,
  ShieldCheck,
  Key,
  Globe,
  Trash2,
  X,
  Code2,
  HelpCircle,
  Layers,
} from 'lucide-react';

interface SupabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackers: Tracker[];
  onTrackersLoaded?: (trackers: Tracker[]) => void;
  onConfigChanged?: (config: SupabaseConfig) => void;
}

export const SupabaseSyncModal: React.FC<SupabaseSyncModalProps> = ({
  isOpen,
  onClose,
  trackers,
  onTrackersLoaded,
  onConfigChanged,
}) => {
  const [config, setConfig] = useState<SupabaseConfig>(getSupabaseConfig());
  const [activeTab, setActiveTab] = useState<'connect' | 'sql' | 'sync'>('connect');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [isCopied, setIsCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = getSupabaseConfig();
      setConfig(cfg);
      setTestResult(null);
    }
  }, [isOpen]);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 4000);
  };

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testSupabaseConnection(config.url, config.anonKey, config.tableName);
      setTestResult(result);
      if (result.success && result.tableExists) {
        showToast('Supabase connection verified and table is ready!', 'success');
      } else if (result.success && !result.tableExists) {
        showToast('Connected to Supabase! Run the SQL schema to create the table.', 'info');
      } else {
        showToast(result.message, 'error');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection failed',
        tableExists: false,
      });
      showToast('Connection failed: ' + err.message, 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = () => {
    if (!config.url.trim() || !config.anonKey.trim()) {
      showToast('Please enter both Supabase Project URL and Anon Public Key', 'error');
      return;
    }
    const updated = {
      ...config,
      url: config.url.trim(),
      anonKey: config.anonKey.trim(),
      tableName: (config.tableName.trim() || 'trackers').toLowerCase(),
      isConnected: testResult ? testResult.success : true,
    };
    saveSupabaseConfig(updated);
    setConfig(updated);
    onConfigChanged?.(updated);
    showToast('Supabase configuration saved!', 'success');
  };

  const handleDisconnect = () => {
    clearSupabaseConfig();
    const reset: SupabaseConfig = {
      url: '',
      anonKey: '',
      tableName: 'trackers',
      autoSync: true,
      isConnected: false,
    };
    setConfig(reset);
    setTestResult(null);
    onConfigChanged?.(reset);
    showToast('Supabase account disconnected.', 'info');
  };

  const handlePushToSupabase = async () => {
    if (!config.url || !config.anonKey) {
      showToast('Connect your Supabase account first.', 'error');
      return;
    }
    setIsPushing(true);
    try {
      const res = await saveTrackersToSupabase(trackers, config);
      if (res.success) {
        const updated = { ...config, lastSyncedAt: new Date().toISOString(), isConnected: true };
        saveSupabaseConfig(updated);
        setConfig(updated);
        onConfigChanged?.(updated);
        showToast(`Successfully pushed ${res.count} trackers to Supabase!`, 'success');
      } else {
        showToast(`Failed to push to Supabase: ${res.error}`, 'error');
      }
    } catch (e: any) {
      showToast(`Error syncing to Supabase: ${e.message}`, 'error');
    } finally {
      setIsPushing(false);
    }
  };

  const handlePullFromSupabase = async () => {
    if (!config.url || !config.anonKey) {
      showToast('Connect your Supabase account first.', 'error');
      return;
    }
    setIsPulling(true);
    try {
      const res = await loadTrackersFromSupabase(config);
      if (res.success && res.trackers) {
        if (res.trackers.length === 0) {
          showToast('No trackers found in your Supabase table.', 'info');
        } else {
          onTrackersLoaded?.(res.trackers);
          const updated = { ...config, lastSyncedAt: new Date().toISOString(), isConnected: true };
          saveSupabaseConfig(updated);
          setConfig(updated);
          onConfigChanged?.(updated);
          showToast(`Successfully pulled ${res.trackers.length} trackers from Supabase!`, 'success');
        }
      } else {
        showToast(`Failed to load from Supabase: ${res.error}`, 'error');
      }
    } catch (e: any) {
      showToast(`Error pulling from Supabase: ${e.message}`, 'error');
    } finally {
      setIsPulling(false);
    }
  };

  const handleCopySql = () => {
    const sql = getSupabaseSqlSchema(config.tableName);
    navigator.clipboard.writeText(sql);
    setIsCopied(true);
    showToast('SQL script copied to clipboard!', 'success');
    setTimeout(() => setIsCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Connect Supabase Account</h2>
                {config.isConnected ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Connected
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                    Not Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Save & sync all tracker sheets directly with your free Supabase PostgreSQL cloud database.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 bg-slate-950/60 border-b border-slate-800 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('connect')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 border-b-2 ${
              activeTab === 'connect'
                ? 'text-emerald-400 border-emerald-500 bg-slate-900/60'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Account Credentials
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 border-b-2 ${
              activeTab === 'sql'
                ? 'text-emerald-400 border-emerald-500 bg-slate-900/60'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            SQL Table Setup
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sync')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 border-b-2 ${
              activeTab === 'sync'
                ? 'text-emerald-400 border-emerald-500 bg-slate-900/60'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Push & Pull Trackers
          </button>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div
            className={`px-4 py-2.5 mx-6 mt-4 rounded-lg text-xs font-semibold flex items-center justify-between border ${
              toastType === 'success'
                ? 'bg-emerald-950/80 border-emerald-700 text-emerald-200'
                : toastType === 'error'
                ? 'bg-rose-950/80 border-rose-700 text-rose-200'
                : 'bg-sky-950/80 border-sky-700 text-sky-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {toastType === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              {toastType === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
              {toastType === 'info' && <RefreshCw className="w-4 h-4 text-sky-400 shrink-0" />}
              <span>{toastMessage}</span>
            </div>
            <button type="button" onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'connect' && (
            <div className="space-y-4">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>Supabase Project URL</span>
                    <a
                      href="https://supabase.com/dashboard"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-normal"
                    >
                      Supabase Dashboard <ExternalLink className="w-3 h-3" />
                    </a>
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={config.url}
                      onChange={(e) => setConfig({ ...config, url: e.target.value })}
                      placeholder="https://xyzabcdefg.supabase.co"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Found in: Supabase Dashboard &rarr; Project Settings &rarr; Configuration &rarr; API &rarr; Project URL
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>Anon / Public API Key</span>
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="text-[11px] text-slate-400 hover:text-slate-200"
                    >
                      {showKey ? 'Hide Key' : 'Show Key'}
                    </button>
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={config.anonKey}
                      onChange={(e) => setConfig({ ...config, anonKey: e.target.value })}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Public <code className="text-emerald-400">anon</code> key with Row Level Security (RLS) enabled.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Database Table Name
                    </label>
                    <input
                      type="text"
                      value={config.tableName}
                      onChange={(e) => setConfig({ ...config, tableName: e.target.value })}
                      placeholder="trackers"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
                      <input
                        type="checkbox"
                        checked={config.autoSync}
                        onChange={(e) => setConfig({ ...config, autoSync: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span>Auto-Save to Supabase when clicking <strong>Save Changes</strong></span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Test Connection Results Badge */}
              {testResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs ${
                    testResult.success
                      ? testResult.tableExists
                        ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200'
                        : 'bg-amber-950/60 border-amber-700 text-amber-200'
                      : 'bg-rose-950/60 border-rose-700 text-rose-200'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {testResult.success ? (
                      testResult.tableExists ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      )
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-bold">
                        {testResult.success
                          ? testResult.tableExists
                            ? 'Connection Verified'
                            : 'Connected — Table Setup Needed'
                          : 'Connection Error'}
                      </div>
                      <div className="mt-0.5 text-slate-300">{testResult.message}</div>
                      {testResult.success && !testResult.tableExists && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('sql')}
                          className="mt-2 text-xs font-bold text-amber-300 underline hover:text-white"
                        >
                          Click here to view and copy the 1-click SQL setup script &rarr;
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    {isTesting ? 'Testing Connection...' : 'Test Connection'}
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Save & Connect
                  </button>
                </div>

                {config.url && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="px-3 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Disconnect Account
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Supabase SQL Editor Schema
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Run this quick script in your Supabase SQL editor to create the table and allow live saving.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  {isCopied ? 'Copied!' : 'Copy SQL Script'}
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-emerald-300 overflow-x-auto max-h-60 leading-relaxed select-all">
                <pre>{getSupabaseSqlSchema(config.tableName)}</pre>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 text-xs space-y-2 text-slate-300">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-emerald-400" />
                  Quick Instructions:
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px]">
                  <li>Log in to your <strong>Supabase Dashboard</strong> and open your project.</li>
                  <li>Click on <strong>SQL Editor</strong> in the left sidebar.</li>
                  <li>Click <strong>+ New Query</strong>, paste the copied SQL above, and click <strong>Run</strong>.</li>
                  <li>Return here and click <strong>Test Connection</strong>!</li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'sync' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">Manual Cloud Sync Actions</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Push your current working tracker sheets to Supabase or pull latest records saved by team members.
                    </div>
                  </div>
                  {config.lastSyncedAt && (
                    <div className="text-[10px] text-slate-400 font-mono">
                      Last Synced: {new Date(config.lastSyncedAt).toLocaleTimeString()}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handlePushToSupabase}
                    disabled={isPushing || !config.url}
                    className="p-3 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/80 rounded-xl text-left transition-all disabled:opacity-40 group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mb-1">
                      <UploadCloud className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                      Push to Supabase
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Upload current <strong>{trackers.length} trackers</strong> & all rows to table <code className="text-emerald-300">{config.tableName || 'trackers'}</code>.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handlePullFromSupabase}
                    disabled={isPulling || !config.url}
                    className="p-3 bg-sky-950/60 hover:bg-sky-900/60 border border-sky-700/80 rounded-xl text-left transition-all disabled:opacity-40 group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-sky-400 font-bold text-xs mb-1">
                      <DownloadCloud className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                      Pull from Supabase
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Retrieve and restore latest tracker sheets and rows directly from your Supabase database.
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Supabase JS v2 Client Ready</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
