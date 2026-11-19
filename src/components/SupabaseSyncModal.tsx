import React, { useState, useEffect, useRef } from 'react';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  testSupabaseConnection,
  saveTrackersToSupabase,
  loadTrackersFromSupabase,
  pushBackupToSupabase,
  listSupabaseBackups,
  pullBackupFromSupabase,
  deleteSupabaseBackup,
  listSupabaseUploadedFiles,
  deleteSupabaseUploadedFile,
  pushAllExistingFilesToSupabase,
  getSupabaseSqlSchema,
  SupabaseConfig,
  ConnectionTestResult,
  SupabaseBackupRecord,
  SupabaseFileRecord,
} from '../utils/supabaseClient';
import { Tracker, TrackerFolder, UserAccount, SiteVisitRecord } from '../types/tracker';
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
  HardDrive,
  FileText,
  Image as ImageIcon,
  Upload,
  Download,
  Search,
  FolderArchive,
  Sparkles,
} from 'lucide-react';

interface SupabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackers: Tracker[];
  folders?: TrackerFolder[];
  users?: UserAccount[];
  visits?: SiteVisitRecord[];
  onTrackersLoaded?: (trackers: Tracker[]) => void;
  onRestoreFullState?: (restored: {
    trackers: Tracker[];
    folders: TrackerFolder[];
    users: UserAccount[];
    visits: SiteVisitRecord[];
  }) => void;
  onConfigChanged?: (config: SupabaseConfig) => void;
  defaultTab?: 'connect' | 'backups' | 'files' | 'sql';
}

export const SupabaseSyncModal: React.FC<SupabaseSyncModalProps> = ({
  isOpen,
  onClose,
  trackers,
  folders = [],
  users = [],
  visits = [],
  onTrackersLoaded,
  onRestoreFullState,
  onConfigChanged,
  defaultTab = 'connect',
}) => {
  const [config, setConfig] = useState<SupabaseConfig>(getSupabaseConfig());
  const [activeTab, setActiveTab] = useState<'connect' | 'backups' | 'files' | 'sql'>(defaultTab);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [isCopied, setIsCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // Backups Push/Pull state
  const [backupNote, setBackupNote] = useState('');
  const [backups, setBackups] = useState<SupabaseBackupRecord[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isPushingBackup, setIsPushingBackup] = useState(false);
  const [pullingBackupId, setPullingBackupId] = useState<string | null>(null);
  const [deletingBackupId, setDeletingBackupId] = useState<string | null>(null);
  const jsonBackupInputRef = useRef<HTMLInputElement>(null);

  // Uploaded Files (JPEG / JPG / PDF) state
  const [savedFiles, setSavedFiles] = useState<SupabaseFileRecord[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [fileFilter, setFileFilter] = useState<'all' | 'image' | 'pdf'>('all');
  const [fileSearch, setFileSearch] = useState('');
  const [isPushingAllFiles, setIsPushingAllFiles] = useState(false);
  const [pushFilesProgress, setPushFilesProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);
  const [previewFile, setPreviewFile] = useState<SupabaseFileRecord | null>(null);

  useEffect(() => {
    if (isOpen) {
      const cfg = getSupabaseConfig();
      setConfig(cfg);
      setTestResult(null);
      setActiveTab(cfg.url && cfg.anonKey ? (defaultTab === 'connect' ? 'backups' : defaultTab) : 'connect');
      if (cfg.url && cfg.anonKey) {
        refreshBackupsList(cfg);
        refreshFilesList(cfg);
      }
    }
  }, [isOpen, defaultTab]);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const refreshBackupsList = async (cfgToUse?: SupabaseConfig) => {
    const cfg = cfgToUse || config;
    if (!cfg.url || !cfg.anonKey) return;
    setIsLoadingBackups(true);
    try {
      const res = await listSupabaseBackups(cfg);
      if (res.success) {
        setBackups(res.backups);
      }
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const refreshFilesList = async (cfgToUse?: SupabaseConfig) => {
    const cfg = cfgToUse || config;
    if (!cfg.url || !cfg.anonKey) return;
    setIsLoadingFiles(true);
    try {
      const res = await listSupabaseUploadedFiles(cfg);
      if (res.success) {
        setSavedFiles(res.files);
      }
    } finally {
      setIsLoadingFiles(false);
    }
  };

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testSupabaseConnection(config.url, config.anonKey, config.tableName);
      setTestResult(result);
      if (result.success && result.tableExists && result.backupsTableExists && result.filesTableExists) {
        showToast('Supabase connection verified! Backups & File Storage are ready.', 'success');
      } else if (result.success) {
        showToast('Connected! Run the SQL script in "SQL & Bucket Setup" to enable all backup & file tables.', 'info');
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
    const updated: SupabaseConfig = {
      ...config,
      url: config.url.trim(),
      anonKey: config.anonKey.trim(),
      tableName: (config.tableName.trim() || 'trackers').toLowerCase(),
      isConnected: testResult ? testResult.success : true,
    };
    saveSupabaseConfig(updated);
    setConfig(updated);
    onConfigChanged?.(updated);
    showToast('Supabase account saved & connected! All uploaded JPEG/JPG/PDF files will now auto-save.', 'success');
    refreshBackupsList(updated);
    refreshFilesList(updated);
  };

  const handleDisconnect = () => {
    clearSupabaseConfig();
    const reset: SupabaseConfig = {
      url: '',
      anonKey: '',
      tableName: 'trackers',
      autoSync: true,
      autoUploadFiles: true,
      storageBucket: 'tracker-files',
      backupBucket: 'tracker-backups',
      isConnected: false,
    };
    setConfig(reset);
    setBackups([]);
    setSavedFiles([]);
    setTestResult(null);
    onConfigChanged?.(reset);
    showToast('Supabase account disconnected.', 'info');
  };

  // Push/Pull Current Trackers Table
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
        showToast(`Pushed ${res.count} trackers to Supabase!`, 'success');
      } else {
        showToast(`Failed to push to Supabase: ${res.error}`, 'error');
      }
    } catch (e: any) {
      showToast(`Error pushing to Supabase: ${e.message}`, 'error');
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
          showToast(`Pulled ${res.trackers.length} trackers from Supabase!`, 'success');
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

  // Push Backup Snapshot to Supabase
  const handlePushBackupSnapshot = async () => {
    if (!config.url || !config.anonKey) {
      showToast('Connect your Supabase account first.', 'error');
      setActiveTab('connect');
      return;
    }
    setIsPushingBackup(true);
    try {
      const res = await pushBackupToSupabase(
        { trackers, folders, users, visits },
        { note: backupNote.trim() || undefined },
        config
      );
      if (res.success && res.backup) {
        setBackupNote('');
        setBackups((prev) => [res.backup!, ...prev]);
        showToast(`Backup "${res.backup.name}" pushed to Supabase!`, 'success');
      } else {
        showToast(res.error || 'Failed to push backup', 'error');
      }
    } finally {
      setIsPushingBackup(false);
    }
  };

  // Upload a local .json Backup File straight to Supabase
  const handleUploadJsonBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!config.url || !config.anonKey) {
      showToast('Connect your Supabase account first.', 'error');
      return;
    }

    setIsPushingBackup(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      let extractedTrackers: Tracker[] = [];
      let extractedFolders: TrackerFolder[] = [];
      let extractedUsers: UserAccount[] = [];
      let extractedVisits: SiteVisitRecord[] = [];

      if (parsed?.data && Array.isArray(parsed.data.trackers)) {
        extractedTrackers = parsed.data.trackers;
        extractedFolders = parsed.data.folders || [];
        extractedUsers = parsed.data.users || [];
        extractedVisits = parsed.data.visits || [];
      } else if (Array.isArray(parsed?.trackers)) {
        extractedTrackers = parsed.trackers;
      } else if (Array.isArray(parsed)) {
        extractedTrackers = parsed;
      }

      if (extractedTrackers.length === 0) {
        showToast('Invalid backup .json file: no trackers found.', 'error');
        return;
      }

      const res = await pushBackupToSupabase(
        {
          trackers: extractedTrackers,
          folders: extractedFolders,
          users: extractedUsers,
          visits: extractedVisits,
        },
        {
          fileName: file.name,
          note: `Uploaded from local file (${file.name})`,
          rawPayload: parsed,
        },
        config
      );

      if (res.success && res.backup) {
        setBackups((prev) => [res.backup!, ...prev]);
        showToast(`Uploaded backup file "${file.name}" to Supabase!`, 'success');
      } else {
        showToast(res.error || 'Failed to upload backup file', 'error');
      }
    } catch (err: any) {
      showToast('Failed to parse JSON backup file: ' + (err.message || 'Invalid JSON'), 'error');
    } finally {
      setIsPushingBackup(false);
      if (e.target) e.target.value = '';
    }
  };

  // Pull & Restore a Backup Snapshot from Supabase
  const handlePullAndRestoreBackup = async (backup: SupabaseBackupRecord) => {
    setPullingBackupId(backup.id);
    try {
      const res = await pullBackupFromSupabase(backup.id, config);
      if (res.success && res.data) {
        if (onRestoreFullState) {
          onRestoreFullState({
            trackers: res.data.trackers,
            folders: res.data.folders.length > 0 ? res.data.folders : folders,
            users: res.data.users.length > 0 ? res.data.users : users,
            visits: res.data.visits.length > 0 ? res.data.visits : visits,
          });
        } else {
          onTrackersLoaded?.(res.data.trackers);
        }
        showToast(`Pulled & restored "${backup.name}" (${res.data.trackers.length} sheets)!`, 'success');
      } else {
        showToast(res.error || 'Failed to pull backup', 'error');
      }
    } finally {
      setPullingBackupId(null);
    }
  };

  // Download a Backup Snapshot from Supabase to Disk
  const handleDownloadSupabaseBackup = async (backup: SupabaseBackupRecord) => {
    setPullingBackupId(backup.id);
    try {
      const res = await pullBackupFromSupabase(backup.id, config);
      if (res.success && res.rawPayload) {
        const blob = new Blob([JSON.stringify(res.rawPayload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = backup.name.endsWith('.json') ? backup.name : `${backup.name}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`Downloaded "${backup.name}"!`, 'success');
      } else {
        showToast(res.error || 'Could not download backup', 'error');
      }
    } finally {
      setPullingBackupId(null);
    }
  };

  const handleDeleteBackup = async (backup: SupabaseBackupRecord) => {
    setDeletingBackupId(backup.id);
    try {
      const res = await deleteSupabaseBackup(backup.id, backup.storage_path, config);
      if (res.success) {
        setBackups((prev) => prev.filter((b) => b.id !== backup.id));
        showToast('Backup removed from Supabase.', 'info');
      } else {
        showToast(res.error || 'Failed to delete backup', 'error');
      }
    } finally {
      setDeletingBackupId(null);
    }
  };

  // Push ALL existing uploaded JPEG/JPG/PDF files across all trackers to Supabase
  const handlePushAllExistingFiles = async () => {
    if (!config.url || !config.anonKey) {
      showToast('Connect your Supabase account first.', 'error');
      setActiveTab('connect');
      return;
    }
    setIsPushingAllFiles(true);
    setPushFilesProgress(null);
    try {
      const res = await pushAllExistingFilesToSupabase(
        trackers,
        (current, total, fileName) => {
          setPushFilesProgress({ current, total, fileName });
        },
        config
      );
      if (res.totalFound === 0) {
        showToast('No uploaded JPEG, JPG, or PDF attachments found in your current trackers yet.', 'info');
      } else if (res.uploadedCount > 0) {
        showToast(`Pushed ${res.uploadedCount} of ${res.totalFound} uploaded files (JPEG/JPG/PDF) to Supabase!`, 'success');
        await refreshFilesList(config);
      } else {
        showToast('Failed to push files. Check that you ran the SQL script in SQL & Bucket Setup.', 'error');
      }
    } finally {
      setIsPushingAllFiles(false);
      setPushFilesProgress(null);
    }
  };

  const handleDeleteSavedFile = async (file: SupabaseFileRecord) => {
    const res = await deleteSupabaseUploadedFile(file.id, file.storage_path, config);
    if (res.success) {
      setSavedFiles((prev) => prev.filter((f) => f.id !== file.id));
      if (previewFile?.id === file.id) setPreviewFile(null);
      showToast('Removed file from Supabase.', 'info');
    } else {
      showToast(res.error || 'Failed to delete file', 'error');
    }
  };

  const handleCopySql = () => {
    const sql = getSupabaseSqlSchema(config.tableName);
    navigator.clipboard.writeText(sql);
    setIsCopied(true);
    showToast('SQL & Storage Bucket script copied to clipboard!', 'success');
    setTimeout(() => setIsCopied(false), 2500);
  };

  const filteredFiles = savedFiles.filter((f) => {
    if (fileFilter === 'image' && f.file_type !== 'image') return false;
    if (fileFilter === 'pdf' && f.file_type !== 'pdf') return false;
    if (fileSearch.trim()) {
      const q = fileSearch.toLowerCase();
      return (
        f.file_name.toLowerCase().includes(q) ||
        (f.site_name || '').toLowerCase().includes(q) ||
        (f.tracker_name || '').toLowerCase().includes(q) ||
        (f.source || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Supabase Backup &amp; Auto File Storage
                </h2>
                {config.url && config.anonKey ? (
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
                Push &amp; pull backup files (.json) and auto-save all uploaded JPEG, JPG &amp; PDF files to your Supabase account.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 bg-slate-950/60 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('backups')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'backups'
                ? 'text-emerald-400 border-emerald-500 bg-slate-900/60'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5" />
            Backup Files (Push &amp; Pull)
            {backups.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">
                {backups.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('files')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'files'
                ? 'text-emerald-400 border-emerald-500 bg-slate-900/60'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Uploaded Files (JPEG / JPG / PDF)
            {savedFiles.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-500/20 text-sky-300 font-mono">
                {savedFiles.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('connect')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 border-b-2 whitespace-nowrap cursor-pointer ${
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
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'sql'
                ? 'text-emerald-400 border-emerald-500 bg-slate-900/60'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            SQL &amp; Bucket Setup
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
          {/* TAB 1: BACKUP FILES PUSH & PULL */}
          {activeTab === 'backups' && (
            <div className="space-y-4">
              {(!config.url || !config.anonKey) && (
                <div className="p-3.5 rounded-xl bg-amber-950/50 border border-amber-700/70 text-xs text-amber-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Connect your Supabase URL and Anon Key first to push and pull backup files.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('connect')}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 cursor-pointer"
                  >
                    Connect Account
                  </button>
                </div>
              )}

              {/* Push Current Backup Snapshot OR Upload Local JSON Backup */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <UploadCloud className="w-4 h-4 text-emerald-400" />
                      <span>Push Backup File to Supabase</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Save a complete snapshot ({trackers.length} sheets,{' '}
                      {trackers.reduce((sum, t) => sum + (t.rows?.length || 0), 0)} rows) or upload a <code>.json</code> backup file from disk.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Optional backup note (e.g., End of Week Tower Rollout Backup)"
                    value={backupNote}
                    onChange={(e) => setBackupNote(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handlePushBackupSnapshot}
                    disabled={isPushingBackup || !config.url || !config.anonKey}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0"
                  >
                    {isPushingBackup ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UploadCloud className="w-3.5 h-3.5" />
                    )}
                    <span>{isPushingBackup ? 'Pushing...' : 'Push Backup Snapshot'}</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                  <input
                    ref={jsonBackupInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleUploadJsonBackupFile}
                  />
                  <button
                    type="button"
                    onClick={() => jsonBackupInputRef.current?.click()}
                    disabled={isPushingBackup || !config.url || !config.anonKey}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-sky-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Local .json Backup File to Supabase</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePushToSupabase}
                      disabled={isPushing || !config.url}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-emerald-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      title="Upsert live tracker rows to trackers table"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>{isPushing ? 'Syncing...' : 'Push Live Table'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePullFromSupabase}
                      disabled={isPulling || !config.url}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-sky-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      title="Pull latest tracker rows from trackers table"
                    >
                      <DownloadCloud className="w-3.5 h-3.5" />
                      <span>{isPulling ? 'Pulling...' : 'Pull Live Table'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Saved Backups History List */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <HardDrive className="w-4 h-4 text-sky-400" />
                    <span>Saved Backup Files in Supabase ({backups.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => refreshBackupsList()}
                    disabled={isLoadingBackups || !config.url}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingBackups ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                {backups.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    {isLoadingBackups
                      ? 'Loading backup files from Supabase...'
                      : 'No backup files stored in Supabase yet. Click "Push Backup Snapshot" above to create one.'}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {backups.map((b) => (
                      <div
                        key={b.id}
                        className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-2 hover:border-slate-700 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white truncate">{b.name}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>{new Date(b.created_at).toLocaleString()}</span>
                            <span>·</span>
                            <span className="text-sky-400 font-mono">{b.total_trackers} sheets / {b.total_rows} rows</span>
                            {b.file_size && (
                              <>
                                <span>·</span>
                                <span className="font-mono text-slate-300">{b.file_size}</span>
                              </>
                            )}
                          </div>
                          {b.note && (
                            <div className="text-[10px] text-emerald-300/90 mt-0.5 truncate">{b.note}</div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handlePullAndRestoreBackup(b)}
                            disabled={pullingBackupId === b.id}
                            className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            title="Pull and restore this backup into the workspace"
                          >
                            {pullingBackupId === b.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <DownloadCloud className="w-3 h-3" />
                            )}
                            <span>Pull &amp; Restore</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadSupabaseBackup(b)}
                            disabled={pullingBackupId === b.id}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                            title="Download .json backup file"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteBackup(b)}
                            disabled={deletingBackupId === b.id}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 cursor-pointer"
                            title="Delete backup from Supabase"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: AUTOMATIC UPLOADED FILES (JPEG / JPG / PDF) */}
          {activeTab === 'files' && (
            <div className="space-y-4">
              {/* Auto-Save Toggle & Batch Push Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/30 border border-emerald-700/50 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span>Auto-Save Uploaded JPEG, JPG &amp; PDF Files</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Every image (.jpg, .jpeg, .png) or document (.pdf) uploaded in grid cells, Site Data, or Checklists is automatically pushed to your Supabase account.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const next = !config.autoUploadFiles;
                      const updated = { ...config, autoUploadFiles: next };
                      setConfig(updated);
                      saveSupabaseConfig(updated);
                      onConfigChanged?.(updated);
                      showToast(
                        next
                          ? 'Auto-Save uploaded JPEG/JPG/PDF files to Supabase turned ON!'
                          : 'Auto-Save uploaded files turned OFF.',
                        'info'
                      );
                    }}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-black transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                      config.autoUploadFiles
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 ring-2 ring-emerald-400/40'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${config.autoUploadFiles ? 'bg-slate-950 animate-pulse' : 'bg-slate-500'}`} />
                    <span>{config.autoUploadFiles ? 'AUTO-SAVE ON' : 'AUTO-SAVE OFF'}</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400">
                    Need to push files uploaded earlier? Push all existing attachments right now:
                  </span>
                  <button
                    type="button"
                    onClick={handlePushAllExistingFiles}
                    disabled={isPushingAllFiles || !config.url || !config.anonKey}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {isPushingAllFiles ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UploadCloud className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isPushingAllFiles && pushFilesProgress
                        ? `Pushing ${pushFilesProgress.current}/${pushFilesProgress.total}...`
                        : 'Push All Existing JPEG / JPG / PDF Files'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Saved Files List & Filter */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {(['all', 'image', 'pdf'] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFileFilter(f)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          fileFilter === f
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {f === 'all' ? `All (${savedFiles.length})` : f === 'image' ? 'JPEG / JPG / Images' : 'PDF Docs'}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search file or site..."
                        value={fileSearch}
                        onChange={(e) => setFileSearch(e.target.value)}
                        className="pl-8 pr-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 w-44 focus:outline-hidden focus:border-emerald-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => refreshFilesList()}
                      disabled={isLoadingFiles || !config.url}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer disabled:opacity-40"
                      title="Refresh files from Supabase"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {filteredFiles.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    {isLoadingFiles
                      ? 'Loading uploaded files from Supabase...'
                      : 'No uploaded JPEG, JPG, or PDF files recorded in Supabase yet.'}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {filteredFiles.map((file) => {
                      const fileHref = file.public_url || file.data_url || '';
                      return (
                        <div
                          key={file.id}
                          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div
                              className={`p-2 rounded-lg shrink-0 ${
                                file.file_type === 'pdf'
                                  ? 'bg-rose-500/15 text-rose-400'
                                  : 'bg-sky-500/15 text-sky-400'
                              }`}
                            >
                              {file.file_type === 'pdf' ? (
                                <FileText className="w-4 h-4" />
                              ) : (
                                <ImageIcon className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate">{file.file_name}</div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                                {file.site_name && <span className="text-sky-300 font-semibold">{file.site_name}</span>}
                                {file.source && <span>· {file.source}</span>}
                                {file.file_size && <span>· {file.file_size}</span>}
                                <span>· {new Date(file.uploaded_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {fileHref && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setPreviewFile(file)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 text-[11px] font-semibold cursor-pointer"
                                >
                                  View
                                </button>
                                <a
                                  href={fileHref}
                                  download={file.file_name}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                                  title="Download file"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteSavedFile(file)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 cursor-pointer"
                              title="Delete file from Supabase"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Inline Preview Modal */}
                {previewFile && (previewFile.public_url || previewFile.data_url) && (
                  <div className="p-3 rounded-xl bg-slate-900 border border-sky-700/60 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white truncate">{previewFile.file_name}</span>
                      <button
                        type="button"
                        onClick={() => setPreviewFile(null)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {previewFile.file_type === 'pdf' ? (
                      <iframe
                        src={previewFile.public_url || previewFile.data_url}
                        title={previewFile.file_name}
                        className="w-full h-64 rounded-lg bg-white"
                      />
                    ) : (
                      <img
                        src={previewFile.public_url || previewFile.data_url}
                        alt={previewFile.file_name}
                        className="max-h-64 mx-auto rounded-lg object-contain"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ACCOUNT CREDENTIALS */}
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
                    Found in: Supabase Dashboard &rarr; Project Settings &rarr; API &rarr; Project URL
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>Anon / Public API Key</span>
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
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

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Storage Bucket Name (JPEG/JPG/PDF)
                    </label>
                    <input
                      type="text"
                      value={config.storageBucket}
                      onChange={(e) => setConfig({ ...config, storageBucket: e.target.value })}
                      placeholder="tracker-files"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={config.autoUploadFiles}
                      onChange={(e) => setConfig({ ...config, autoUploadFiles: e.target.checked })}
                      className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>
                      <strong>Automatically save all uploaded JPEG, JPG &amp; PDF files</strong> to Supabase
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={config.autoSync}
                      onChange={(e) => setConfig({ ...config, autoSync: e.target.checked })}
                      className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>Auto-Save tracker changes when clicking <strong>Save</strong></span>
                  </label>
                </div>
              </div>

              {/* Test Connection Results Badge */}
              {testResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs ${
                    testResult.success
                      ? testResult.tableExists && testResult.backupsTableExists && testResult.filesTableExists
                        ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200'
                        : 'bg-amber-950/60 border-amber-700 text-amber-200'
                      : 'bg-rose-950/60 border-rose-700 text-rose-200'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {testResult.success ? (
                      testResult.tableExists && testResult.backupsTableExists && testResult.filesTableExists ? (
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
                          ? testResult.tableExists && testResult.backupsTableExists && testResult.filesTableExists
                            ? 'Connection Verified — All Tables & Storage Ready'
                            : 'Connected — Run SQL Script for Backups & File Storage'
                          : 'Connection Error'}
                      </div>
                      <div className="mt-0.5 text-slate-300">{testResult.message}</div>
                      {testResult.success && (!testResult.tableExists || !testResult.backupsTableExists || !testResult.filesTableExists) && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('sql')}
                          className="mt-2 text-xs font-bold text-amber-300 underline hover:text-white cursor-pointer"
                        >
                          Open 1-Click SQL &amp; Bucket Setup Script &rarr;
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
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    {isTesting ? 'Testing...' : 'Test Connection'}
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Save &amp; Connect
                  </button>
                </div>

                {config.url && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="px-3 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Disconnect Account
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SQL & BUCKET SETUP */}
          {activeTab === 'sql' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Supabase SQL Editor &amp; Storage Bucket Setup
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Creates <code>trackers</code>, <code>tracker_backups</code> (Push/Pull), <code>tracker_files</code> (JPEG/JPG/PDF), and public Storage buckets automatically.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer shrink-0"
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
                  Quick Setup Instructions:
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px]">
                  <li>Open your <strong>Supabase Dashboard</strong> &rarr; <strong>SQL Editor</strong> &rarr; <strong>+ New Query</strong>.</li>
                  <li>Paste the copied SQL above and click <strong>Run</strong>.</li>
                  <li>This creates both database tables and the <code>tracker-files</code> &amp; <code>tracker-backups</code> Storage buckets.</li>
                  <li>Return to <strong>Account Credentials</strong> and click <strong>Test Connection</strong>!</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${config.url && config.anonKey ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span>
              {config.url && config.anonKey
                ? config.autoUploadFiles
                  ? 'Auto-Save JPEG/JPG/PDF Uploads Active'
                  : 'Supabase Backup Connected'
                : 'Enter Supabase credentials to enable cloud backups & file storage'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
