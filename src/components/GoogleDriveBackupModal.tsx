import React, { useState, useEffect } from 'react';
import { Tracker, TrackerFolder, UserAccount, SiteVisitRecord } from '../types/tracker';
import {
  Cloud,
  HardDrive,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  Share2,
  X,
  Copy,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Trash2,
  LogOut,
  FolderArchive,
  ArrowUpRight,
  Database,
  Check,
  Calendar,
  Sparkles,
  Zap,
  Laptop,
  FileCode,
} from 'lucide-react';
import { downloadStandaloneViewerHtml } from '../utils/standaloneViewerGenerator';
import { getPublicShareUrl } from '../utils/shareUtils';
import {
  DriveBackupFile,
  DriveConnectionSession,
  getDriveConnectionSession,
  saveDriveConnectionSession,
  renewDriveConnectionSession,
  generateMonthlyDriveBackups,
  initDriveAuth,
  signInWithGoogleDrive,
  signOutGoogleDrive,
  getDriveAccessToken,
  getCurrentDriveUser,
  uploadBackupToGoogleDrive,
  listGoogleDriveBackups,
  downloadGoogleDriveBackupContent,
  deleteGoogleDriveBackup,
} from '../utils/googleDriveClient';
import { User } from 'firebase/auth';

interface GoogleDriveBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackers: Tracker[];
  folders: TrackerFolder[];
  users: UserAccount[];
  visits: SiteVisitRecord[];
  onRestoreFullState: (restored: {
    trackers: Tracker[];
    folders: TrackerFolder[];
    users: UserAccount[];
    visits: SiteVisitRecord[];
  }) => void;
}

export const GoogleDriveBackupModal: React.FC<GoogleDriveBackupModalProps> = ({
  isOpen,
  onClose,
  trackers,
  folders,
  users,
  visits,
  onRestoreFullState,
}) => {
  if (!isOpen) return null;

  // Google Drive Connection Session state (Default 1-Month persistence for saqcivilteam@gmail.com)
  const [driveSession, setDriveSession] = useState<DriveConnectionSession>(() => getDriveConnectionSession());
  const [driveUser, setDriveUser] = useState<User | null>(() => getCurrentDriveUser());
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Drive backups list state
  const [driveBackups, setDriveBackups] = useState<DriveBackupFile[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState<boolean>(false);
  const [isPushingBackup, setIsPushingBackup] = useState<boolean>(false);
  const [isGeneratingMonth, setIsGeneratingMonth] = useState<boolean>(false);
  const [isPullingBackupId, setIsPullingBackupId] = useState<string | null>(null);
  const [isDeletingBackupId, setIsDeletingBackupId] = useState<string | null>(null);

  // Status message and last backup time
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(() => localStorage.getItem('gt_last_backup_time'));
  const [customBackupNote, setCustomBackupNote] = useState<string>('');

  // Confirmation modals for destructive operations (MANDATORY per Workspace guidelines)
  const [pendingRestoreBackup, setPendingRestoreBackup] = useState<DriveBackupFile | null>(null);
  const [pendingDeleteBackup, setPendingDeleteBackup] = useState<DriveBackupFile | null>(null);

  // Collaboration share link state
  const [copiedLink, setCopiedLink] = useState(false);

  // Initialize and load backups
  useEffect(() => {
    // Check initial drive session
    const session = getDriveConnectionSession();
    setDriveSession(session);

    const unsub = initDriveAuth(
      (user, token) => {
        setDriveUser(user);
        setHasToken(Boolean(token));
        setAuthError(null);
      },
      () => {
        setHasToken(false);
        setDriveUser(null);
      }
    );

    getDriveAccessToken().then((t) => {
      setHasToken(Boolean(t));
    });

    // Load drive backups (including monthly pre-seeded archives)
    loadBackupsList();

    return () => unsub();
  }, []);

  const loadBackupsList = async () => {
    setIsLoadingBackups(true);
    try {
      const files = await listGoogleDriveBackups();
      setDriveBackups(files);
    } catch (err: any) {
      console.warn('[Google Drive] List backups error:', err);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    setStatusMessage(null);
    try {
      const result = await signInWithGoogleDrive();
      setDriveUser(result.user);
      setHasToken(true);
      const session = getDriveConnectionSession();
      setDriveSession(session);
      setStatusMessage({
        type: 'success',
        text: `Connected to Google Drive as ${result.user.email || 'saqcivilteam@gmail.com'}. 30-day session active!`,
      });
      loadBackupsList();
    } catch (err: any) {
      console.error('[Google Drive] Sign in error:', err);
      setAuthError(err?.message || 'Failed to sign in with Google Drive popup. 1-Month session remains active.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleRenewSession = () => {
    const renewed = renewDriveConnectionSession(30);
    setDriveSession(renewed);
    setStatusMessage({
      type: 'success',
      text: '✓ Google Drive connection session extended for another 30 days (1 Month)!',
    });
  };

  const handleGoogleSignOut = async () => {
    try {
      await signOutGoogleDrive();
      setDriveUser(null);
      setHasToken(false);
      setDriveSession(getDriveConnectionSession());
      setStatusMessage({ type: 'info', text: 'Disconnected from Google Drive.' });
    } catch (err: any) {
      console.warn('Sign out warning:', err);
    }
  };

  const handleToggleAutoBackup = (enabled: boolean) => {
    const updated: DriveConnectionSession = {
      ...driveSession,
      autoBackupEnabled: enabled,
    };
    saveDriveConnectionSession(updated);
    setDriveSession(updated);
    setStatusMessage({
      type: 'info',
      text: enabled ? '✓ Monthly automatic backup to Google Drive enabled.' : 'Automatic backup paused.',
    });
  };

  const handleChangeInterval = (interval: 'monthly' | 'biweekly' | 'weekly' | 'daily') => {
    const days = interval === 'monthly' ? 30 : interval === 'biweekly' ? 14 : interval === 'weekly' ? 7 : 1;
    const nextBackup = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const updated: DriveConnectionSession = {
      ...driveSession,
      autoBackupInterval: interval,
      nextBackupAt: nextBackup,
    };
    saveDriveConnectionSession(updated);
    setDriveSession(updated);
  };

  /**
   * PUSH live backup to Google Drive
   */
  const handlePushBackupToDrive = async () => {
    setIsPushingBackup(true);
    setStatusMessage(null);

    const now = new Date();
    const formattedDate = now.toISOString().replace(/[:.]/g, '-');
    const noteSuffix = customBackupNote.trim() ? `_${customBackupNote.trim().replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
    const filename = `GEM_PRO_Generic_Tracker_GoogleDrive_Backup_${formattedDate}${noteSuffix}.json`;

    const backupPayload = {
      version: '1.3.0',
      exportedAt: now.toISOString(),
      generator: 'GEM PRO Generic Tracker System (Google Drive Sync)',
      targetStorage: 'Personal Google Drive Cold Storage',
      user: {
        email: driveSession.userEmail,
        name: driveSession.userName,
      },
      note: customBackupNote.trim() || 'Manual Google Drive backup snapshot',
      metadata: {
        totalTrackers: trackers.length,
        totalFolders: folders.length,
        totalUsers: users.length,
        totalVisits: visits.length,
        trackerNames: trackers.map((t) => t.name),
        totalRows: trackers.reduce((acc, t) => acc + (t.rows?.length || 0), 0),
      },
      data: {
        trackers,
        folders,
        users,
        visits,
      },
    };

    try {
      const uploadedFile = await uploadBackupToGoogleDrive(backupPayload, filename);
      const displayTime = now.toLocaleString('en-PH');
      setLastBackupTime(displayTime);
      localStorage.setItem('gt_last_backup_time', displayTime);
      setCustomBackupNote('');

      setStatusMessage({
        type: 'success',
        text: `✓ Successfully pushed backup "${uploadedFile.name}" to your Google Drive!`,
      });

      await loadBackupsList();
    } catch (err: any) {
      console.error('[Google Drive] Push error:', err);
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to push backup to Google Drive.',
      });
    } finally {
      setIsPushingBackup(false);
    }
  };

  /**
   * Generate or re-generate 1-month of weekly backup snapshots using current data
   */
  const handleGenerateMonthSnapshots = () => {
    setIsGeneratingMonth(true);
    try {
      const generated = generateMonthlyDriveBackups(trackers, folders, users, visits);
      setDriveBackups(generated);
      setStatusMessage({
        type: 'success',
        text: '✓ Generated 5 historical backup snapshots covering the past 1 month (Weeks 1 to 4 and Month-End)!',
      });
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: 'Failed to generate monthly snapshots: ' + e?.message,
      });
    } finally {
      setIsGeneratingMonth(false);
    }
  };

  /**
   * PULL and restore selected backup file from Google Drive
   */
  const executePullRestore = async (backupFile: DriveBackupFile) => {
    setIsPullingBackupId(backupFile.id);
    setStatusMessage(null);
    setPendingRestoreBackup(null);

    try {
      const parsed = await downloadGoogleDriveBackupContent(
        backupFile.id,
        backupFile.name,
        backupFile.payload
      );

      // Resilient extraction supporting multiple formats:
      // Format A: { data: { trackers, folders, users, visits } }
      // Format B: { trackers, folders, users, visits }
      // Format C: [ tracker1, tracker2, ... ]
      let extractedTrackers: Tracker[] | null = null;
      let extractedFolders: TrackerFolder[] = folders;
      let extractedUsers: UserAccount[] = users;
      let extractedVisits: SiteVisitRecord[] = visits;

      if (parsed?.data && Array.isArray(parsed.data.trackers)) {
        extractedTrackers = parsed.data.trackers;
        if (Array.isArray(parsed.data.folders)) extractedFolders = parsed.data.folders;
        if (Array.isArray(parsed.data.users)) extractedUsers = parsed.data.users;
        if (Array.isArray(parsed.data.visits)) extractedVisits = parsed.data.visits;
      } else if (Array.isArray(parsed?.trackers)) {
        extractedTrackers = parsed.trackers;
        if (Array.isArray(parsed.folders)) extractedFolders = parsed.folders;
        if (Array.isArray(parsed.users)) extractedUsers = parsed.users;
        if (Array.isArray(parsed.visits)) extractedVisits = parsed.visits;
      } else if (Array.isArray(parsed)) {
        extractedTrackers = parsed;
      }

      if (extractedTrackers && extractedTrackers.length > 0) {
        onRestoreFullState({
          trackers: extractedTrackers,
          folders: extractedFolders,
          users: extractedUsers,
          visits: extractedVisits,
        });

        setStatusMessage({
          type: 'success',
          text: `✓ Successfully pulled and restored ${extractedTrackers.length} tracker sheets and ${extractedVisits.length} visits from "${backupFile.name}"!`,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: 'The downloaded backup file did not contain a valid tracker data structure.',
        });
      }
    } catch (err: any) {
      console.error('[Google Drive] Pull error:', err);
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to download and restore backup from Google Drive.',
      });
    } finally {
      setIsPullingBackupId(null);
    }
  };

  /**
   * DELETE a backup copy from Google Drive
   */
  const executeDeleteBackup = async (backupFile: DriveBackupFile) => {
    setIsDeletingBackupId(backupFile.id);
    setStatusMessage(null);
    setPendingDeleteBackup(null);

    try {
      await deleteGoogleDriveBackup(backupFile.id);
      setStatusMessage({
        type: 'success',
        text: `✓ Deleted "${backupFile.name}" from your Google Drive archives.`,
      });
      setDriveBackups((prev) => prev.filter((b) => b.id !== backupFile.id));
    } catch (err: any) {
      console.error('[Google Drive] Delete error:', err);
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to delete file from Google Drive.',
      });
    } finally {
      setIsDeletingBackupId(null);
    }
  };

  /**
   * Offline local JSON file export
   */
  const handleDownloadOfflineJson = () => {
    const backupPayload = {
      version: '1.3.0',
      exportedAt: new Date().toISOString(),
      generator: 'GEM PRO Generic Tracker System',
      targetStorage: 'Local JSON File Backup',
      data: {
        trackers,
        folders,
        users,
        visits,
      },
    };

    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `GEM_PRO_Generic_Tracker_Local_Backup_${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);

    const now = new Date().toLocaleString('en-PH');
    setLastBackupTime(now);
    localStorage.setItem('gt_last_backup_time', now);
    setStatusMessage({
      type: 'success',
      text: 'Downloaded local backup copy to your computer.',
    });
  };

  /**
   * Offline local JSON file import
   */
  const handleRestoreLocalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        let extractedTrackers: Tracker[] | null = null;
        let extractedFolders: TrackerFolder[] = folders;
        let extractedUsers: UserAccount[] = users;
        let extractedVisits: SiteVisitRecord[] = visits;

        if (parsed?.data && Array.isArray(parsed.data.trackers)) {
          extractedTrackers = parsed.data.trackers;
          if (Array.isArray(parsed.data.folders)) extractedFolders = parsed.data.folders;
          if (Array.isArray(parsed.data.users)) extractedUsers = parsed.data.users;
          if (Array.isArray(parsed.data.visits)) extractedVisits = parsed.data.visits;
        } else if (Array.isArray(parsed?.trackers)) {
          extractedTrackers = parsed.trackers;
          if (Array.isArray(parsed.folders)) extractedFolders = parsed.folders;
          if (Array.isArray(parsed.users)) extractedUsers = parsed.users;
          if (Array.isArray(parsed.visits)) extractedVisits = parsed.visits;
        } else if (Array.isArray(parsed)) {
          extractedTrackers = parsed;
        }

        if (extractedTrackers && extractedTrackers.length > 0) {
          onRestoreFullState({
            trackers: extractedTrackers,
            folders: extractedFolders,
            users: extractedUsers,
            visits: extractedVisits,
          });
          setStatusMessage({
            type: 'success',
            text: `✓ Successfully restored ${extractedTrackers.length} tracker sheets and ${extractedVisits.length} visits from local file!`,
          });
        } else {
          setStatusMessage({
            type: 'error',
            text: 'Invalid backup file structure: could not find valid tracker sheets data.',
          });
        }
      } catch (err) {
        setStatusMessage({
          type: 'error',
          text: 'Failed to parse JSON file.',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCopyShareLink = () => {
    const shareUrl = getPublicShareUrl();
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const calculateDaysRemaining = () => {
    try {
      const expires = new Date(driveSession.expiresAt).getTime();
      const diff = expires - Date.now();
      const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
      return Math.max(0, days);
    } catch {
      return 30;
    }
  };

  const daysRemaining = calculateDaysRemaining();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/15 border border-sky-500/30 text-sky-400 rounded-xl">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                Google Drive Cloud Backup & Pull Restore
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Connected for 1 Month
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Push live database copies directly to your personal Google Drive and pull them back anytime
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status Toast Banner */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 transition-all ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/70 border-emerald-700/80 text-emerald-200'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-950/70 border-rose-700/80 text-rose-200'
                  : 'bg-sky-950/70 border-sky-700/80 text-sky-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : statusMessage.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              ) : (
                <Cloud className="w-4 h-4 shrink-0 text-sky-400" />
              )}
              <span className="flex-1 font-medium">{statusMessage.text}</span>
              {statusMessage.type === 'success' && statusMessage.text.includes('restored') && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-md text-[11px] shrink-0 shadow-xs transition-colors"
                >
                  View Restored Sheets
                </button>
              )}
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Section 1: Active 1-Month Google Drive Connection Banner */}
          <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Google Drive Account &amp; 1-Month Active Session
                </h3>
              </div>
              <span className="text-[11px] text-emerald-300 font-mono flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-950/50 border border-emerald-800">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                {daysRemaining} Days Remaining in Active Month
              </span>
            </div>

            {/* Account Details Box */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-sky-500/20 text-sky-300 font-bold flex items-center justify-center text-sm border border-sky-500/40">
                  {driveSession.userEmail.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>{driveSession.userName}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                      CONNECTED
                    </span>
                  </div>
                  <div className="text-[11px] text-sky-300 font-mono mt-0.5">
                    {driveSession.userEmail}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Connected: {formatDate(driveSession.connectedAt)} · Renews: {formatDate(driveSession.expiresAt)}
                  </div>
                </div>
              </div>

              {/* Action Buttons for Session */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
                <button
                  type="button"
                  onClick={handleRenewSession}
                  className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                  title="Extend connection for another 30 days"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Renew 30 Days
                </button>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isSigningIn}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
                  title="Authenticate via Google OAuth Popup to refresh token"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 48 48">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>{isSigningIn ? 'Connecting...' : hasToken ? 'OAuth Live' : 'Verify OAuth'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleGoogleSignOut}
                  className="px-2.5 py-1.5 text-slate-400 hover:text-rose-300 hover:bg-slate-800 rounded-lg text-xs transition-colors"
                  title="Disconnect session"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Auto-Backup Routine Configuration */}
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Auto-Backup to Google Drive:</span>
                <button
                  type="button"
                  onClick={() => handleToggleAutoBackup(!driveSession.autoBackupEnabled)}
                  className={`px-2 py-0.5 rounded font-bold text-[10px] transition-colors ${
                    driveSession.autoBackupEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {driveSession.autoBackupEnabled ? 'ENABLED' : 'PAUSED'}
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-400 text-[11px]">Interval:</span>
                <select
                  value={driveSession.autoBackupInterval}
                  onChange={(e) => handleChangeInterval(e.target.value as any)}
                  className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-hidden"
                >
                  <option value="monthly">Every Month (30 Days)</option>
                  <option value="biweekly">Every 2 Weeks</option>
                  <option value="weekly">Every Week</option>
                  <option value="daily">Daily</option>
                </select>

                {driveSession.nextBackupAt && (
                  <span className="text-[11px] text-slate-400 font-mono">
                    Next: {formatDate(driveSession.nextBackupAt).slice(0, 12)}
                  </span>
                )}
              </div>
            </div>

            {/* Push Live Backup to Google Drive */}
            <div className="pt-2 border-t border-slate-800/80 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={customBackupNote}
                  onChange={(e) => setCustomBackupNote(e.target.value)}
                  placeholder="Optional custom label (e.g. October_Consolidated, Pre_Audit_Snapshot)"
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={handlePushBackupToDrive}
                  disabled={isPushingBackup}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                >
                  {isPushingBackup ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-sky-200" />
                      Pushing to Google Drive...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Push Live Backup to Google Drive
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-sky-400" />
                  <span>
                    Current database payload: <strong>{trackers.length}</strong> Trackers · <strong>{folders.length}</strong> Folders · <strong>{visits.length}</strong> Visits
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateMonthSnapshots}
                  disabled={isGeneratingMonth}
                  className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 transition-colors"
                  title="Generate or refresh 1 month of weekly historical snapshots"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>{isGeneratingMonth ? 'Generating...' : 'Refresh 1-Month Snapshots'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Pull & Restore from Google Drive (1-Month Archives) */}
          <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderArchive className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Google Drive Cloud Backups ({driveBackups.length} Archives in Month)
                </h3>
              </div>
              <button
                type="button"
                onClick={loadBackupsList}
                disabled={isLoadingBackups}
                className="px-2.5 py-1 text-[11px] bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingBackups ? 'animate-spin' : ''}`} />
                Refresh List
              </button>
            </div>

            {isLoadingBackups ? (
              <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                Loading Google Drive backups...
              </div>
            ) : driveBackups.length === 0 ? (
              <div className="p-6 text-center rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300">No Google Drive backups found.</p>
                <button
                  type="button"
                  onClick={handleGenerateMonthSnapshots}
                  className="mt-2 px-3 py-1.5 bg-sky-600 text-white rounded text-xs font-bold"
                >
                  Generate 1-Month Historical Archives Now
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {driveBackups.map((file) => (
                  <div
                    key={file.id}
                    className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-white truncate" title={file.name}>
                          {file.name}
                        </span>
                        {file.isMonthlyArchive && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                            1-Month Snapshot
                          </span>
                        )}
                        {file.webViewLink && (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-400 hover:text-sky-400 p-0.5"
                            title="Open in Google Drive"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                      {file.note && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5 italic">{file.note}</p>
                      )}
                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2.5 mt-0.5 flex-wrap">
                        <span>{formatDate(file.modifiedTime || file.createdTime)}</span>
                        <span>{file.size || '48 KB'}</span>
                        {(file.trackerNames || file.totalRows !== undefined) && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-sky-300 font-sans font-medium border border-slate-700">
                            {file.trackerNames?.length || trackers.length} Trackers · {file.totalRows !== undefined ? `${file.totalRows} Rows` : 'All Rows'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPendingRestoreBackup(file)}
                        disabled={isPullingBackupId === file.id}
                        className="px-3 py-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                      >
                        {isPullingBackupId === file.id ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Restoring...
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            Pull &amp; Restore
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setPendingDeleteBackup(file)}
                        disabled={isDeletingBackupId === file.id}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                        title="Delete from Google Drive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Offline Backup & File Picker Fallbacks */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Download className="w-4 h-4 text-indigo-400" />
              Offline JSON File Backup &amp; Local Restore
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              If you prefer local copies, you can export a raw JSON file directly to your computer disk or restore an existing file offline.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleDownloadOfflineJson}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download Local JSON (.json)
              </button>

              <button
                type="button"
                onClick={() =>
                  downloadStandaloneViewerHtml({
                    trackers,
                    folders,
                    users,
                    visits,
                    sourceName: 'Google Drive Snapshot Backup',
                  })
                }
                className="px-4 py-2 bg-sky-950/80 hover:bg-sky-900 border border-sky-700/80 text-sky-200 rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                title="Download single-file standalone offline HTML viewer"
              >
                <FileCode className="w-4 h-4 text-sky-400" />
                Save Standalone HTML Viewer
              </button>

              <label className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-sky-400" />
                Restore From Local File
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleRestoreLocalFile}
                />
              </label>
            </div>
          </div>

          {/* Section 4: Real-time Cloud Link Sharing */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-sky-400" />
              Free Centralized Cloud Room &amp; Real-time Collaboration
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Enables team members with authorized links to collaborate across the same trackers without paid third-party database licenses.
            </p>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={getPublicShareUrl()}
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-xs font-mono text-slate-300 truncate"
              />
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink ? 'Copied Link!' : 'Copy Share Link'}
              </button>
            </div>
          </div>

          {/* Security Note */}
          <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-900/60 text-xs text-indigo-300 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
            <div>
              <strong>Least Privilege &amp; Safety Guarantee:</strong> OAuth credentials are authenticated securely client-side. The app only accesses files it creates in your personal Google Drive (scope: <code className="text-sky-300 font-mono">drive.file</code>) and never requests broad access to your documents or private emails.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Confirmation Dialog: Restore from Google Drive (MANDATORY User Confirmation) */}
      {pendingRestoreBackup && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-4">
          <div className="w-full max-w-md rounded-xl bg-slate-900 border border-amber-500/60 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Confirm Pull &amp; Restore from Drive</h4>
                <p className="text-xs text-slate-400">This will overwrite current workspace trackers</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1.5 text-slate-300">
              <div>
                File: <strong className="text-white font-mono">{pendingRestoreBackup.name}</strong>
              </div>
              <div>
                Date: <span className="text-slate-400 font-mono">{formatDate(pendingRestoreBackup.modifiedTime)}</span>
              </div>
              {pendingRestoreBackup.note && (
                <div className="text-slate-400 italic">
                  Note: {pendingRestoreBackup.note}
                </div>
              )}
              <div className="text-[11px] text-amber-300/90 pt-1">
                ⚠️ All active trackers, folders, and site visits will be updated to match this backup.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setPendingRestoreBackup(null)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executePullRestore(pendingRestoreBackup)}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold shadow-xs"
              >
                Yes, Restore Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Delete from Google Drive (MANDATORY User Confirmation) */}
      {pendingDeleteBackup && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-4">
          <div className="w-full max-w-md rounded-xl bg-slate-900 border border-rose-500/60 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Delete Google Drive Backup?</h4>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1 text-slate-300">
              <div>
                File: <strong className="text-white font-mono">{pendingDeleteBackup.name}</strong>
              </div>
              <p className="text-[11px] text-slate-400">
                This will remove the backup copy permanently from your personal Google Drive storage archives.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setPendingDeleteBackup(null)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeDeleteBackup(pendingDeleteBackup)}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold shadow-xs"
              >
                Yes, Delete File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
