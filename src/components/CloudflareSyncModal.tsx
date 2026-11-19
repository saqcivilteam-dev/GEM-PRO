import React, { useState, useEffect } from 'react';
import {
  CloudflareConfig,
  CloudflareTestResult,
  getCloudflareConfig,
  saveCloudflareConfig,
  clearCloudflareConfig,
  testCloudflareConnection,
  pushTrackersToCloudflare,
  loadTrackersFromCloudflare,
  getCloudflareWorkerTemplateCode,
  normalizeCloudflareUrl,
} from '../utils/cloudflareClient';
import { Tracker } from '../types/tracker';
import {
  Cloud,
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
  Zap,
  Activity,
  Layers,
  Sparkles,
  Wrench,
  AlertOctagon,
} from 'lucide-react';

interface CloudflareSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackers: Tracker[];
  onTrackersLoaded?: (trackers: Tracker[]) => void;
  onConfigChanged?: (config: CloudflareConfig) => void;
  userEmail?: string;
  userName?: string;
}

export const CloudflareSyncModal: React.FC<CloudflareSyncModalProps> = ({
  isOpen,
  onClose,
  trackers,
  onTrackersLoaded,
  onConfigChanged,
  userEmail,
  userName,
}) => {
  const [config, setConfig] = useState<CloudflareConfig>(getCloudflareConfig());
  const [activeTab, setActiveTab] = useState<'connect' | 'code' | 'guide' | 'troubleshoot'>('connect');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<CloudflareTestResult | null>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [isCopied, setIsCopied] = useState(false);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = getCloudflareConfig();
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
    if (!config.workerUrl.trim()) {
      showToast('Please enter your Cloudflare Worker URL first', 'error');
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testCloudflareConnection(config.workerUrl, config.authToken);
      setTestResult(res);
      if (res.success) {
        showToast(res.message, 'success');
        // Save tested url
        const updated = saveCloudflareConfig({
          workerUrl: normalizeCloudflareUrl(config.workerUrl),
          authToken: config.authToken,
        });
        setConfig(updated);
        onConfigChanged?.(updated);
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection failed',
      });
      showToast('Connection failed: ' + err.message, 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = () => {
    const updated = saveCloudflareConfig({
      workerUrl: normalizeCloudflareUrl(config.workerUrl),
      authToken: config.authToken,
      autoSync: config.autoSync,
      syncIntervalSeconds: config.syncIntervalSeconds,
    });
    setConfig(updated);
    onConfigChanged?.(updated);
    showToast('Cloudflare configuration saved successfully!', 'success');
  };

  const handleDisconnect = () => {
    if (confirm('Disconnect Cloudflare? Your local data will remain safe.')) {
      clearCloudflareConfig();
      const empty = getCloudflareConfig();
      setConfig(empty);
      setTestResult(null);
      onConfigChanged?.(empty);
      showToast('Cloudflare configuration cleared.', 'info');
    }
  };

  const handlePushTrackers = async () => {
    if (!config.workerUrl.trim()) {
      showToast('Configure your Cloudflare Worker URL first', 'error');
      return;
    }

    setIsPushing(true);
    try {
      const result = await pushTrackersToCloudflare(config, trackers, { userEmail, userName });
      if (result.success) {
        showToast(result.message, 'success');
        setConfig(getCloudflareConfig());
      } else {
        showToast(result.message, 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to push trackers', 'error');
    } finally {
      setIsPushing(false);
    }
  };

  const handlePullTrackers = async () => {
    if (!config.workerUrl.trim()) {
      showToast('Configure your Cloudflare Worker URL first', 'error');
      return;
    }

    setIsPulling(true);
    try {
      const result = await loadTrackersFromCloudflare(config);
      if (result.success && result.trackers && result.trackers.length > 0) {
        if (onTrackersLoaded) {
          onTrackersLoaded(result.trackers);
          showToast(`Loaded ${result.trackers.length} trackers from Cloudflare!`, 'success');
        } else {
          showToast(`Found ${result.trackers.length} trackers in Cloudflare.`, 'success');
        }
        setConfig(getCloudflareConfig());
      } else if (result.success) {
        showToast('Connected, but Cloudflare database is empty. Click "Push" to upload your current data.', 'info');
      } else {
        showToast(result.message, 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to pull trackers', 'error');
    } finally {
      setIsPulling(false);
    }
  };

  const workerCode = getCloudflareWorkerTemplateCode(config.authToken);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(workerCode);
    setIsCopied(true);
    showToast('Cloudflare Worker code copied to clipboard!', 'success');
    setTimeout(() => setIsCopied(false), 2500);
  };

  const isConfigured = Boolean(config.workerUrl.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-orange-950/20 to-slate-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-500/15 border border-orange-500/30 rounded-xl text-orange-400 shadow-sm">
              <Cloud className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Cloudflare Real-Time Database
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/40">
                  100% Free Tier
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Share tracker data, multi-user edge synchronization & instant backups with zero hosting costs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast Notification */}
        {toastMessage && (
          <div
            className={`px-4 py-2 text-xs font-semibold flex items-center justify-between border-b ${
              toastType === 'success'
                ? 'bg-emerald-950/80 border-emerald-800/80 text-emerald-200'
                : toastType === 'error'
                ? 'bg-rose-950/80 border-rose-800/80 text-rose-200'
                : 'bg-indigo-950/80 border-indigo-800/80 text-indigo-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {toastType === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              {toastType === 'error' && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
              {toastType === 'info' && <AlertTriangle className="w-4 h-4 text-indigo-400 shrink-0" />}
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="hover:opacity-75">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-2 bg-slate-950/60 border-b border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTab('connect')}
            className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'connect'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="truncate">Connect & Sync</span>
            {isConfigured && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'code'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="truncate">Worker Code</span>
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'guide'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="truncate">Setup Guide</span>
          </button>
          <button
            onClick={() => setActiveTab('troubleshoot')}
            className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'troubleshoot'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-amber-400/90 hover:text-amber-200 hover:bg-amber-950/40 bg-amber-500/10 border border-amber-500/20'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Fix Deploy Error</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* TAB 1: CONNECT & STATUS */}
          {activeTab === 'connect' && (
            <div className="space-y-5">
              {/* Status Card */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2.5 rounded-lg border ${
                      isConfigured
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">Cloudflare Edge Connection</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isConfigured
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {isConfigured ? 'Connected' : 'Not Connected'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isConfigured
                        ? config.lastSyncedAt
                          ? `Last synced: ${new Date(config.lastSyncedAt).toLocaleTimeString()} (${config.lastSyncMessage || 'OK'})`
                          : 'Configured and ready for sync'
                        : 'Deploy your free Cloudflare Worker to enable team real-time sync'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                  {isConfigured && (
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-900/50 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      title="Clear configuration"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting || !config.workerUrl}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
                  </button>
                </div>
              </div>

              {/* Test Result Message */}
              {testResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                    testResult.success
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-800/60 text-rose-200'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="font-semibold">{testResult.message}</p>
                    {testResult.latencyMs && (
                      <p className="text-[11px] opacity-80">
                        ⚡ Edge Latency: <span className="font-mono font-bold">{testResult.latencyMs}ms</span>
                        {testResult.trackerCount !== undefined && ` · Stored Trackers: ${testResult.trackerCount}`}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Configuration Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-orange-400" />
                      Cloudflare Worker URL (Required)
                    </span>
                    <span className="text-[11px] font-normal text-slate-400">e.g. *.workers.dev</span>
                  </label>
                  <input
                    type="text"
                    value={config.workerUrl}
                    onChange={(e) => setConfig({ ...config, workerUrl: e.target.value })}
                    placeholder="https://saq-civil-tracker.your-subdomain.workers.dev"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 text-xs font-mono focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Your free Cloudflare Worker endpoint URL from dash.cloudflare.com.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-orange-400" />
                      Secret Security Token (Optional)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="text-[11px] text-orange-400 hover:underline"
                    >
                      {showToken ? 'Hide Token' : 'Show Token'}
                    </button>
                  </label>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={config.authToken}
                      onChange={(e) => setConfig({ ...config, authToken: e.target.value })}
                      placeholder="e.g. saq-civil-team-secret-2025"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 text-xs font-mono focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Keeps your civil team's tracker private. Matches the <code className="text-orange-400">SECURITY_TOKEN</code> in your Worker code.
                  </p>
                </div>

                {/* Auto-Sync Toggle */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">Automatic Team Sync</span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Automatically sync changes when saving and pull team updates in the background
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.autoSync}
                      onChange={(e) => setConfig({ ...config, autoSync: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                  </label>
                </div>

                {/* Save Config Button */}
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Cloudflare Configuration</span>
                </button>
              </div>

              {/* Push & Pull Actions */}
              {isConfigured && (
                <div className="pt-2 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Team Data Transfer
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {trackers.length} Trackers Loaded Locally
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={handlePushTrackers}
                      disabled={isPushing}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-orange-500/50 hover:bg-slate-900 text-left transition-all group disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2 text-xs font-bold text-orange-400 mb-1">
                        <UploadCloud className={`w-4 h-4 ${isPushing ? 'animate-bounce' : ''}`} />
                        <span>{isPushing ? 'Uploading...' : 'Push to Cloudflare'}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Upload your current {trackers.length} trackers to Cloudflare so your team can see all edits.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={handlePullTrackers}
                      disabled={isPulling}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900 text-left transition-all group disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-1">
                        <DownloadCloud className={`w-4 h-4 ${isPulling ? 'animate-bounce' : ''}`} />
                        <span>{isPulling ? 'Downloading...' : 'Pull from Cloudflare'}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Download the latest tracker updates made by other team members on Cloudflare.
                      </p>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FREE WORKER CODE */}
          {activeTab === 'code' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-orange-400" />
                    Cloudflare Worker Script (100% Free Plan)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Deploy this code to Cloudflare Workers with 100,000 free requests per day.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>

              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>worker.js</span>
                  <span className="text-orange-400">100% Free Cloudflare Edge</span>
                </div>
                <pre className="p-4 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-[380px] leading-relaxed select-all">
                  {workerCode}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: 60-SECOND SETUP GUIDE */}
          {activeTab === 'guide' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-orange-500/10 border border-orange-500/25 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-orange-300">Why Cloudflare Workers for SAQ Civil Tracker?</p>
                  <p className="text-slate-300 mt-1 leading-relaxed">
                    Cloudflare provides a <strong>100% free forever tier</strong> with 100,000 requests per day and zero credit card required. It runs at the edge in 300+ cities globally, giving your civil engineering team instant, low-latency sync.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Step 1 */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/40 text-xs font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-white">Create a Free Cloudflare Account</p>
                    <p className="text-slate-400 leading-relaxed">
                      Go to{' '}
                      <a
                        href="https://dash.cloudflare.com/sign-up"
                        target="_blank"
                        rel="noreferrer"
                        className="text-orange-400 hover:underline inline-flex items-center gap-1 font-semibold"
                      >
                        dash.cloudflare.com/sign-up
                        <ExternalLink className="w-3 h-3" />
                      </a>{' '}
                      and sign up for free (no payment method needed).
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/40 text-xs font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-white">Create a New Worker</p>
                    <p className="text-slate-400 leading-relaxed">
                      In the left sidebar, click <strong>Workers & Pages</strong> &gt; <strong>Create application</strong> &gt; <strong>Create Worker</strong>. Name it (for example <code className="text-orange-300">civil-tracker</code>), and click <strong>Deploy</strong>.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/40 text-xs font-bold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-white">Paste the Free Worker Code</p>
                    <p className="text-slate-400 leading-relaxed">
                      Click <strong>Edit code</strong> in Cloudflare. Switch to the <strong>"Free Worker Code"</strong> tab above in this modal, copy the code, paste it into the Cloudflare editor, and click <strong>Deploy</strong>.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/40 text-xs font-bold flex items-center justify-center shrink-0">
                    4
                  </span>
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-white">Paste Worker URL into Civil Tracker</p>
                    <p className="text-slate-400 leading-relaxed">
                      Copy your Worker URL (ends with <code className="text-orange-300">.workers.dev</code>), paste it into the <strong>Connect & Live Sync</strong> tab, and click <strong>Save & Test</strong>.
                    </p>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center justify-center shrink-0">
                    5
                  </span>
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-white">Share App Link With Your Team</p>
                    <p className="text-slate-400 leading-relaxed">
                      Send your team the application URL. Every edit they make will automatically synchronize through your free Cloudflare database!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: FIX DEPLOY ERROR (TROUBLESHOOTING) */}
          {activeTab === 'troubleshoot' && (
            <div className="space-y-4">
              {/* Alert Banner */}
              <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/50 flex items-start gap-3 shadow-lg">
                <AlertOctagon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-300 text-sm">
                      Error: "Failed: error occurred while installing tools or dependencies"
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    This error happens in Cloudflare when creating a <strong>Pages</strong> project because older Cloudflare build containers default to Node 18 or fail package installation. Here is how to fix it immediately:
                  </p>
                </div>
              </div>

              {/* Solution 1: Zero-Install Worker (Easiest & Recommended) */}
              <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/40 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wide">
                      Recommended · 10 Seconds
                    </span>
                    <h4 className="text-xs font-bold text-white">Solution 1: Use Cloudflare Worker (Zero Dependencies)</h4>
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  For sharing tracker data with your team, you <strong>do not need to install any tools, node modules, or dependencies</strong>! Cloudflare Workers run entirely in the browser with 0 installation:
                </p>
                <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 text-xs space-y-2 text-slate-300">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-orange-400">1.</span>
                    <span>In Cloudflare sidebar, click <strong>Workers &amp; Pages</strong> &gt; <strong>Create application</strong> &gt; select <strong>Worker</strong> (do NOT select Pages).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-orange-400">2.</span>
                    <span>Click <strong>Deploy</strong>, then click <strong>Edit code</strong> (or Quick Edit).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-orange-400">3.</span>
                    <span>Go to the <strong>"Worker Code"</strong> tab in this dialog, click <strong>Copy Code</strong>, paste it into Cloudflare, and click <strong>Deploy</strong>!</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('code')}
                    className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>View &amp; Copy Worker Code</span>
                  </button>
                  <a
                    href="https://dash.cloudflare.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-all"
                  >
                    <span>Open Cloudflare Dashboard</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Solution 2: If deploying the full Web App via Cloudflare Pages */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 uppercase tracking-wide">
                    Cloudflare Pages Web App
                  </span>
                  <h4 className="text-xs font-bold text-white">Solution 2: Fix Build Settings in Cloudflare Pages</h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  If you connected your GitHub repository to Cloudflare Pages to host the entire web app, we have already fixed the codebase with:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Added <code>.nvmrc</code> (Node 20.18.0)</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Added <code>.npmrc</code> (legacy-peer-deps)</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Clean <code>package-lock.json</code></span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Fixed Vite peer dependencies</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2 text-xs">
                  <p className="font-bold text-white">Required Cloudflare Pages Build Settings:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">BUILD COMMAND</span>
                      <span className="text-orange-400">npm run build</span>
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">BUILD OUTPUT DIRECTORY</span>
                      <span className="text-orange-400">dist</span>
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800 sm:col-span-2">
                      <span className="text-slate-400 block text-[10px]">ENVIRONMENT VARIABLE (CRITICAL)</span>
                      <span className="text-emerald-400 font-bold">NODE_VERSION = 20</span>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 italic">
                  In Cloudflare Pages, go to <strong>Settings</strong> &gt; <strong>Environment variables</strong> &gt; Add <strong>NODE_VERSION</strong> with value <strong>20</strong>, then click <strong>Retry deployment</strong>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-orange-400" />
            <span>Cloudflare Edge · Zero Latency · 100% Free Forever</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
