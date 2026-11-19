import React, { useState, useEffect } from 'react';
import {
  Tracker,
  TrackerFolder,
  UserAccount,
  SiteVisitRecord,
  ExecutiveDeckSlide,
  ExecutiveDeck,
  ChangeRequest,
  TrackerRow,
  ColumnDefinition,
  TrackerAppearance,
} from './types/tracker';
import {
  INITIAL_TRACKERS,
  INITIAL_FOLDERS,
  INITIAL_USERS,
  INITIAL_SITE_VISITS,
  INITIAL_EXECUTIVE_SLIDES,
  INITIAL_DECKS,
  INITIAL_CHANGE_REQUESTS,
} from './data/initialTrackers';
import { Navbar, ActiveView } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ExcelGrid } from './components/ExcelGrid';
import { normalizeToStandardDate, looksLikeDateString, getEffectiveTrackerSlaConfig, isTrackerSlaEnabled } from './utils/excelUtils';
import { DashboardView } from './components/DashboardView';
import { AllMetricsSummaryView } from './components/AllMetricsSummaryView';
import { ExecutivePresentationDeck } from './components/ExecutivePresentationDeck';
import { DayByDaySlaModal } from './components/DayByDaySlaModal';
import { LegalFeesChecklistModal } from './components/LegalFeesChecklistModal';
import { CustomizeColumnsModal } from './components/CustomizeColumnsModal';
import { ProjectSlaCustomizerModal } from './components/ProjectSlaCustomizerModal';
import { CreateTrackerModal } from './components/CreateTrackerModal';
import { SiteDataDrawer } from './components/SiteDataDrawer';
import { StaffAttendanceModal } from './components/StaffAttendanceModal';
import { AuthManagementModal } from './components/AuthManagementModal';
import { GoogleDriveBackupModal } from './components/GoogleDriveBackupModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { SlaWarningCenterView } from './components/SlaWarningCenterView';
import { DataLockApprovalModal } from './components/DataLockApprovalModal';
import { LandingLoginPage } from './components/LandingLoginPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TeamServerModal } from './components/TeamServerModal';
import { ShareCollaborateModal } from './components/ShareCollaborateModal';
import { CoworkerJoinModal } from './components/CoworkerJoinModal';
import { SupabaseSyncModal } from './components/SupabaseSyncModal';
import { CloudflareSyncModal } from './components/CloudflareSyncModal';
import { FirebaseSyncModal } from './components/FirebaseSyncModal';
import { LocalVersionModal } from './components/LocalVersionModal';
import { DevOpsSyncModal } from './components/DevOpsSyncModal';
import { downloadStandaloneViewerHtml } from './utils/standaloneViewerGenerator';
import {
  isFirebaseConfigured,
  subscribeToTrackers,
  subscribeToFolders,
  subscribeToUsers,
  saveTrackerToFirestore,
  saveRowToFirestore,
  deleteTrackerFromFirestore,
  syncAllTrackersToFirestore,
  loadTrackersFromFirestore,
  syncUsersToFirestore,
  syncFoldersToFirestore,
} from './utils/firebaseClient';
import { getSupabaseConfig, saveSupabaseConfig, saveTrackersToSupabase, SupabaseConfig } from './utils/supabaseClient';
import {
  getCloudflareConfig,
  saveCloudflareConfig,
  pushTrackersToCloudflare,
  loadTrackersFromCloudflare,
  CloudflareConfig,
} from './utils/cloudflareClient';
import { getGitHubConfig, pushTrackersToGitHub, pushTrackersWithVercelDeploy } from './utils/githubClient';
import { realtimeClient, OnlineUser, ConnectionStatus } from './utils/realtimeClient';
import { Edit2, Check, X, Folder, FolderOpen, Table, FileSpreadsheet, Lock, ShieldCheck, Crown, UserCheck, Radio, Save, Database, Cloud, Target, Laptop, FileCode, Upload, Download } from 'lucide-react';

export default function App() {
  const [trackers, setTrackers] = useState<Tracker[]>(() => {
    try {
      const saved = localStorage.getItem('gt_trackers_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((t: Tracker) => {
            let cols = [...(t.columns || [])];
            const hasData2 = cols.some((c) => c.type === 'data_drawer_2' || c.id === 'data_2_button');
            if (!hasData2 && t.id === 'tracker_tower_rollout') {
              const dataIdx = cols.findIndex((c) => c.type === 'data_drawer' || c.id === 'data_button');
              const data2Col: ColumnDefinition = {
                id: 'data_2_button',
                label: 'DATA 2 (Different Encode)',
                type: 'data_drawer_2',
                width: 140,
                visible: true,
                colorTheme: 'Amber',
              };
              if (dataIdx !== -1) {
                cols.splice(dataIdx + 1, 0, data2Col);
              } else {
                cols.push(data2Col);
              }
            }
            return {
              ...t,
              columns: cols,
              isLocked: false,
              requireAdminApprovalForEdits: false,
              rows: (Array.isArray(t.rows) ? t.rows : []).map((r: TrackerRow) => {
                const cleanVals = { ...(r.values || {}) };
                Object.keys(cleanVals).forEach((k) => {
                  if (k.includes('date') || k === 'sla_trigger_date' || looksLikeDateString(cleanVals[k])) {
                    cleanVals[k] = normalizeToStandardDate(cleanVals[k]);
                  }
                });

                let rowSla = r.slaData;
                if (rowSla) {
                  const cleanTrig = normalizeToStandardDate(cleanVals.sla_trigger_date || rowSla.triggerDate);
                  const msCopy = (rowSla.milestones || []).map((ms) => ({
                    ...ms,
                    targetDate: normalizeToStandardDate(ms.targetDate),
                  }));
                  if (msCopy.length > 0 && cleanVals.target_on_air_date) {
                    msCopy[msCopy.length - 1] = {
                      ...msCopy[msCopy.length - 1],
                      targetDate: cleanVals.target_on_air_date,
                    };
                  }
                  rowSla = {
                    ...rowSla,
                    triggerDate: cleanTrig,
                    lastMovementDate: normalizeToStandardDate(rowSla.lastMovementDate) || cleanTrig,
                    milestones: msCopy,
                  };
                }

                return {
                  ...r,
                  values: cleanVals,
                  slaData: rowSla,
                };
              }),
            };
          });
        }
      }
    } catch (e) {}
    return INITIAL_TRACKERS.map((t) => ({
      ...t,
      isLocked: false,
      requireAdminApprovalForEdits: false,
    }));
  });

  const [folders, setFolders] = useState<TrackerFolder[]>(() => {
    try {
      const saved = localStorage.getItem('gt_folders_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_FOLDERS;
  });

  const [users, setUsers] = useState<UserAccount[]>(() => {
    try {
      const saved = localStorage.getItem('gt_users_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_USERS;
  });

  const [siteVisits, setSiteVisits] = useState<SiteVisitRecord[]>(() => {
    try {
      const saved = localStorage.getItem('gt_visits_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_SITE_VISITS;
  });

  const [decks, setDecks] = useState<ExecutiveDeck[]>(() => {
    try {
      const saved = localStorage.getItem('gt_decks_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_DECKS;
  });

  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>(() => {
    try {
      const saved = localStorage.getItem('gt_change_requests_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_CHANGE_REQUESTS;
  });

  // User Authentication & Session state - Landing page is login when sharing link
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        // If shared link explicitly specifies landing=login or login=true, always show Login page
        if (
          params.get('landing') === 'login' ||
          params.get('login') === 'true' ||
          params.get('login') === '1' ||
          params.get('auth') === 'login'
        ) {
          return false;
        }
      }
      const saved = localStorage.getItem('gt_auth_logged_in_v2');
      // Only keep logged in if session was explicitly verified as true
      return saved === 'true';
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('gt_auth_logged_in_v2', String(isLoggedIn));
    } catch (e) {}
  }, [isLoggedIn]);

  // Current session & active UI - Default to Creator Gaela Malonzo as requested
  const [currentUser, setCurrentUser] = useState<UserAccount>(() => {
    try {
      const saved = localStorage.getItem('gt_current_user_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name) return parsed;
      }
    } catch (e) {}
    // Default to Creator: Gaela Malonzo
    return INITIAL_USERS[0];
  });

  useEffect(() => {
    try {
      localStorage.setItem('gt_current_user_v2', JSON.stringify(currentUser));
    } catch (e) {}
  }, [currentUser]);

  const [activeTrackerId, setActiveTrackerId] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const trackerParam = params.get('tracker');
        if (trackerParam) return trackerParam;
      }
    } catch (e) {}
    return trackers[0]?.id || 'tracker_tower_rollout';
  });

  const [activeView, setActiveView] = useState<ActiveView>('tracker');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Modals & Editors
  const [slaModalRow, setSlaModalRow] = useState<TrackerRow | null>(null);
  const [checklistModalRow, setChecklistModalRow] = useState<TrackerRow | null>(null);
  const [dataDrawerRow, setDataDrawerRow] = useState<TrackerRow | null>(null);
  const [dataDrawerMode, setDataDrawerMode] = useState<'data1' | 'data2'>('data1');
  const [isCustomizeColumnsOpen, setIsCustomizeColumnsOpen] = useState(false);
  const [isProjectSlaModalOpen, setIsProjectSlaModalOpen] = useState(false);
  const [isCreateTrackerOpen, setIsCreateTrackerOpen] = useState(false);
  const [createTrackerFolderId, setCreateTrackerFolderId] = useState<string | undefined>(undefined);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [isLockApprovalModalOpen, setIsLockApprovalModalOpen] = useState(false);
  const [isTeamServerModalOpen, setIsTeamServerModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [coworkerInvite, setCoworkerInvite] = useState<{
    isOpen: boolean;
    role: string;
    suggestedName: string;
    trackerId: string;
  } | null>(null);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>(() => getSupabaseConfig());
  const [isCloudflareModalOpen, setIsCloudflareModalOpen] = useState(false);
  const [cloudflareConfig, setCloudflareConfig] = useState<CloudflareConfig>(() => getCloudflareConfig());
  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState(false);
  const [isFirebaseAutoSync, setIsFirebaseAutoSync] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('gt_firebase_auto_sync');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });
  const [isServerSyncEnabled, setIsServerSyncEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('gt_server_sync_enabled');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });
  const [isGoogleDriveAutoSync, setIsGoogleDriveAutoSync] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gt_gdrive_auto_sync') === 'true';
    } catch {
      return false;
    }
  });
  const [firebaseLastSyncedAt, setFirebaseLastSyncedAt] = useState<string | null>(null);

  // Local Offline Version & Backup Viewer State
  const [isLocalMode, setIsLocalMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gt_local_mode_active') === 'true';
    } catch {
      return false;
    }
  });
  const [localBackupName, setLocalBackupName] = useState<string>(() => {
    try {
      return localStorage.getItem('gt_local_backup_name') || 'Local Backup File';
    } catch {
      return 'Local Backup File';
    }
  });
  const [isLocalVersionModalOpen, setIsLocalVersionModalOpen] = useState(false);
  const [isDevOpsModalOpen, setIsDevOpsModalOpen] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        return params.get('connect') === 'github' || params.get('tab') === 'github';
      }
    } catch {}
    return false;
  });
  const [devOpsModalTab, setDevOpsModalTab] = useState<'pipeline' | 'github' | 'vercel' | 'cloudflare'>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('connect') === 'github' || params.get('tab') === 'github') return 'github';
        if (params.get('tab') === 'vercel') return 'vercel';
        if (params.get('tab') === 'cloudflare') return 'cloudflare';
      }
    } catch {}
    return 'pipeline';
  });

  const handleActivateLocalMode = (data: {
    trackers: Tracker[];
    folders: TrackerFolder[];
    users: UserAccount[];
    visits: SiteVisitRecord[];
    backupName: string;
  }) => {
    setIsLocalMode(true);
    setLocalBackupName(data.backupName);
    setTrackers(data.trackers);
    if (data.folders) setFolders(data.folders);
    if (data.users) setUsers(data.users);
    if (data.visits) setSiteVisits(data.visits);
    if (data.trackers.length > 0) {
      setActiveTrackerId(data.trackers[0].id);
    }
    setIsLoggedIn(true);
    try {
      localStorage.setItem('gt_local_mode_active', 'true');
      localStorage.setItem('gt_local_backup_name', data.backupName);
      localStorage.setItem('gt_trackers_v1', JSON.stringify(data.trackers));
      if (data.folders) localStorage.setItem('gt_folders_v1', JSON.stringify(data.folders));
      if (data.users) localStorage.setItem('gt_users_v1', JSON.stringify(data.users));
      if (data.visits) localStorage.setItem('gt_visits_v1', JSON.stringify(data.visits));
    } catch (e) {}
    showRemoteToast(`⚡ Local Offline Mode active: Viewing "${data.backupName}" (${data.trackers.length} sheets)`);
  };

  const handleExitLocalMode = () => {
    setIsLocalMode(false);
    try {
      localStorage.removeItem('gt_local_mode_active');
    } catch (e) {}
    showRemoteToast('☁️ Returned to Cloud Sync Mode.');
  };
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [remoteToast, setRemoteToast] = useState<string | null>(null);
  const [showRoleBanner, setShowRoleBanner] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gt_hide_role_banner') !== 'true';
    } catch {
      return true;
    }
  });

  const showRemoteToast = (msg: string) => {
    setRemoteToast(msg);
    setTimeout(() => setRemoteToast(null), 3800);
  };

  // Notify user whenever an uploaded JPEG / JPG / PNG / PDF file auto-saves to Supabase
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleSupabaseFileUploaded = (e: Event) => {
      const detail = (e as CustomEvent<{ file_name?: string }>).detail;
      const fname = detail?.file_name || 'file';
      showRemoteToast(`☁️ Auto-saved "${fname}" to your Supabase account`);
    };
    window.addEventListener('supabase-file-uploaded', handleSupabaseFileUploaded);
    return () => window.removeEventListener('supabase-file-uploaded', handleSupabaseFileUploaded);
  }, []);

  // Detect invited co-workers arriving via shared collaboration link
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const roleParam = params.get('role') || params.get('collab');
      const inviteParam = params.get('invite');
      const nameParam = params.get('name') || params.get('user');
      const trackerParam = params.get('tracker');

      if (trackerParam) {
        setActiveTrackerId(trackerParam);
      }

      const landingParam = params.get('landing') || params.get('login');
      if (landingParam === 'login' || landingParam === 'true') {
        setIsLoggedIn(false);
        return;
      }

      if (roleParam || inviteParam === 'coworker') {
        const storedUser = localStorage.getItem('gt_current_user_v2');
        if (nameParam && nameParam.trim()) {
          const coworkerUser: UserAccount = {
            id: 'user_collab_' + Date.now(),
            name: nameParam.trim(),
            username: nameParam.trim().toLowerCase().replace(/\s+/g, '_'),
            email: `${nameParam.trim().toLowerCase().replace(/[^a-z0-9]/g, '.')}@saqcivil.team`,
            role: roleParam === 'admin' ? 'admin' : roleParam === 'viewer' ? 'guest' : 'staff',
            status: 'approved',
            assignedProjects: trackerParam ? [trackerParam] : trackers.map((t) => t.id),
            joinedAt: new Date().toISOString(),
            isCollaborator: true,
          };
          setCurrentUser(coworkerUser);
          setIsLoggedIn(true);
          showRemoteToast(`👋 Welcome ${nameParam.trim()}! Joined live session with Co-worker Edit access.`);
        } else if (!storedUser || storedUser.includes('Gaela Malonzo')) {
          setCoworkerInvite({
            isOpen: true,
            role: roleParam || 'editor',
            suggestedName: '',
            trackerId: trackerParam || activeTrackerId,
          });
        }
      }
    } catch (e) {}
  }, []);

  // Set current user on Realtime Client
  useEffect(() => {
    realtimeClient.setUser(currentUser, activeTrackerId);
  }, [currentUser, activeTrackerId]);

  // Real-time synchronization listeners
  useEffect(() => {
    const unsubStatus = realtimeClient.on('status', (s: ConnectionStatus) => {
      setConnectionStatus(s);
    });

    const unsubPresence = realtimeClient.on('presence', (uList: OnlineUser[]) => {
      setOnlineUsers(uList);
    });

    const applyIncomingState = (state: any) => {
      if (!state) return;
      // If local offline mode is active, do not overwrite user's local backup dataset
      if (localStorage.getItem('gt_local_mode_active') === 'true') {
        return;
      }
      if (Array.isArray(state.trackers) && state.trackers.length > 0) {
        setTrackers(state.trackers);
        try {
          localStorage.setItem('gt_trackers_v1', JSON.stringify(state.trackers));
        } catch (e) {}

        // If URL has ?tracker=..., preserve or select it
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const requestedTracker = urlParams.get('tracker');
          if (requestedTracker && state.trackers.some((t: any) => t.id === requestedTracker)) {
            setActiveTrackerId(requestedTracker);
          }
        } catch (e) {}
      }
      if (Array.isArray(state.folders) && state.folders.length > 0) {
        setFolders(state.folders);
        try {
          localStorage.setItem('gt_folders_v1', JSON.stringify(state.folders));
        } catch (e) {}
      }
      if (Array.isArray(state.users) && state.users.length > 0) {
        setUsers(state.users);
        try {
          localStorage.setItem('gt_users_v1', JSON.stringify(state.users));
        } catch (e) {}
        // Refresh active user to match server's authoritative record and assigned projects
        setCurrentUser((prev) => {
          const matched = state.users.find(
            (u: any) => u.id === prev.id || u.email.toLowerCase() === prev.email.toLowerCase()
          );
          return matched ? { ...prev, ...matched } : prev;
        });
      }
      if (Array.isArray(state.siteVisits)) {
        setSiteVisits(state.siteVisits);
        try {
          localStorage.setItem('gt_visits_v1', JSON.stringify(state.siteVisits));
        } catch (e) {}
      }
      if (Array.isArray(state.decks)) {
        setDecks(state.decks);
        try {
          localStorage.setItem('gt_decks_v2', JSON.stringify(state.decks));
        } catch (e) {}
      }
      if (Array.isArray(state.changeRequests)) {
        setChangeRequests(state.changeRequests);
        try {
          localStorage.setItem('gt_change_requests_v1', JSON.stringify(state.changeRequests));
        } catch (e) {}
      }
    };

    const unsubInit = realtimeClient.on('init', (payload: any) => {
      if (payload?.state?.trackers && Array.isArray(payload.state.trackers) && payload.state.trackers.length > 0) {
        applyIncomingState(payload.state);
      } else {
        // Initial server seed: push existing local state
        realtimeClient.updateFullState({
          trackers,
          folders,
          users,
          siteVisits,
          decks,
          changeRequests,
        });
      }
      if (payload?.onlineUsers) {
        setOnlineUsers(payload.onlineUsers);
      }
    });

    // Immediate REST fetch to ensure all accounts, devices, and browsers receive authoritative synced state
    fetch('/api/state')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          applyIncomingState(data);
        }
      })
      .catch((e) => console.warn('Startup REST state sync error:', e));

    const unsubTrackerUpdated = realtimeClient.on('tracker_updated', (payload: any) => {
      if (payload?.senderId && payload.senderId === realtimeClient.getClientId()) return;
      if (payload?.tracker) {
        setTrackers((prev) => prev.map((t) => (t.id === payload.tracker.id ? payload.tracker : t)));
        try {
          localStorage.setItem('gt_trackers_v1', JSON.stringify(trackers.map((t) => (t.id === payload.tracker.id ? payload.tracker : t))));
        } catch (e) {}

        if (Array.isArray(payload.tracker.rows)) {
          setSlaModalRow((curr) => {
            if (!curr) return curr;
            const m = payload.tracker.rows.find((r: any) => r.id === curr.id);
            return m && JSON.stringify(m) !== JSON.stringify(curr) ? m : curr;
          });
          setChecklistModalRow((curr) => {
            if (!curr) return curr;
            const m = payload.tracker.rows.find((r: any) => r.id === curr.id);
            return m && JSON.stringify(m) !== JSON.stringify(curr) ? m : curr;
          });
          setDataDrawerRow((curr) => {
            if (!curr) return curr;
            const m = payload.tracker.rows.find((r: any) => r.id === curr.id);
            return m && JSON.stringify(m) !== JSON.stringify(curr) ? m : curr;
          });
        }
        showRemoteToast(`⚡ ${payload.userName || 'Teammate'} updated project ${payload.tracker.name}`);
      }
    });

    const unsubRowUpdated = realtimeClient.on('row_updated', (payload: any) => {
      if (payload?.senderId && payload.senderId === realtimeClient.getClientId()) return;
      const { trackerId, row, userName } = payload || {};
      if (trackerId && row) {
        setTrackers((prev) =>
          prev.map((t) => {
            if (t.id !== trackerId) return t;
            const updatedRows = t.rows.map((r) => (r.id === row.id ? row : r));
            return { ...t, rows: updatedRows, updatedAt: new Date().toISOString() };
          })
        );
        setSlaModalRow((prev) => (prev?.id === row.id ? row : prev));
        setChecklistModalRow((prev) => (prev?.id === row.id ? row : prev));
        setDataDrawerRow((prev) => (prev?.id === row.id ? row : prev));
        showRemoteToast(`⚡ ${userName || 'Teammate'} updated site ${row.siteId || row.id}`);
      }
    });

    const unsubRowDeleted = realtimeClient.on('row_deleted', (payload: any) => {
      if (payload?.senderId && payload.senderId === realtimeClient.getClientId()) return;
      const { trackerId, rowId, userName } = payload || {};
      if (trackerId && rowId) {
        setTrackers((prev) =>
          prev.map((t) => {
            if (t.id !== trackerId) return t;
            return { ...t, rows: t.rows.filter((r) => r.id !== rowId) };
          })
        );
        setSlaModalRow((prev) => (prev?.id === rowId ? null : prev));
        setChecklistModalRow((prev) => (prev?.id === rowId ? null : prev));
        setDataDrawerRow((prev) => (prev?.id === rowId ? null : prev));
        showRemoteToast(`⚡ ${userName || 'Teammate'} deleted a site row`);
      }
    });

    const unsubStateUpdated = realtimeClient.on('state_updated', (payload: any) => {
      if (payload?.senderId && payload.senderId === realtimeClient.getClientId()) return;
      if (payload?.state?.trackers && Array.isArray(payload.state.trackers)) {
        setTrackers(payload.state.trackers);
        try {
          localStorage.setItem('gt_trackers_v1', JSON.stringify(payload.state.trackers));
        } catch (e) {}

        for (const trk of payload.state.trackers) {
          if (Array.isArray(trk.rows)) {
            setSlaModalRow((curr) => {
              if (!curr) return curr;
              const m = trk.rows.find((r: any) => r.id === curr.id);
              return m && JSON.stringify(m) !== JSON.stringify(curr) ? m : curr;
            });
            setChecklistModalRow((curr) => {
              if (!curr) return curr;
              const m = trk.rows.find((r: any) => r.id === curr.id);
              return m && JSON.stringify(m) !== JSON.stringify(curr) ? m : curr;
            });
            setDataDrawerRow((curr) => {
              if (!curr) return curr;
              const m = trk.rows.find((r: any) => r.id === curr.id);
              return m && JSON.stringify(m) !== JSON.stringify(curr) ? m : curr;
            });
          }
        }
      }
      if (payload?.state?.folders) setFolders(payload.state.folders);
      if (payload?.state?.users) setUsers(payload.state.users);
      if (payload?.state?.siteVisits) setSiteVisits(payload.state.siteVisits);
      if (payload?.state?.decks) setDecks(payload.state.decks);
      if (payload?.state?.changeRequests) setChangeRequests(payload.state.changeRequests);
      showRemoteToast(`⚡ Synchronized live state with ${payload.userName || 'team'}`);
    });

    const unsubFolders = realtimeClient.on('folders_updated', (newFolders) => setFolders(newFolders));
    const unsubUsers = realtimeClient.on('users_updated', (newUsers) => setUsers(newUsers));
    const unsubVisits = realtimeClient.on('visits_updated', (newVisits) => setSiteVisits(newVisits));
    const unsubDecks = realtimeClient.on('decks_updated', (newDecks) => setDecks(newDecks));
    const unsubReqs = realtimeClient.on('requests_updated', (newReqs) => setChangeRequests(newReqs));

    // Cross-tab instantaneous synchronizer (reflects any changes made in another tab or account in the same browser)
    const handleStorageChange = (e: StorageEvent) => {
      if (!e.key || !e.newValue) return;
      try {
        if (e.key === 'gt_trackers_v1') {
          const parsedTrackers = JSON.parse(e.newValue);
          if (Array.isArray(parsedTrackers) && parsedTrackers.length > 0) {
            setTrackers(parsedTrackers);
          }
        } else if (e.key === 'gt_users_v1') {
          const parsedUsers = JSON.parse(e.newValue);
          if (Array.isArray(parsedUsers) && parsedUsers.length > 0) {
            setUsers(parsedUsers);
          }
        } else if (e.key === 'gt_folders_v1') {
          const parsedFolders = JSON.parse(e.newValue);
          if (Array.isArray(parsedFolders)) setFolders(parsedFolders);
        }
      } catch (err) {}
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      unsubStatus();
      unsubPresence();
      unsubInit();
      unsubTrackerUpdated();
      unsubRowUpdated();
      unsubRowDeleted();
      unsubStateUpdated();
      unsubFolders();
      unsubUsers();
      unsubVisits();
      unsubDecks();
      unsubReqs();
    };
  }, []);

  // Quick Rename states for Folder and Tracker
  const [isRenamingActiveTracker, setIsRenamingActiveTracker] = useState(false);
  const [tempTrackerName, setTempTrackerName] = useState('');
  const [isRenamingActiveFolder, setIsRenamingActiveFolder] = useState(false);
  const [tempFolderName, setTempFolderName] = useState('');

  // Auto-save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('gt_trackers_v1', JSON.stringify(trackers));
    } catch (e) {}
  }, [trackers]);

  useEffect(() => {
    try {
      localStorage.setItem('gt_folders_v1', JSON.stringify(folders));
    } catch (e) {}
  }, [folders]);

  useEffect(() => {
    try {
      localStorage.setItem('gt_users_v1', JSON.stringify(users));
    } catch (e) {}
  }, [users]);

  useEffect(() => {
    try {
      localStorage.setItem('gt_visits_v1', JSON.stringify(siteVisits));
    } catch (e) {}
  }, [siteVisits]);

  useEffect(() => {
    try {
      localStorage.setItem('gt_decks_v2', JSON.stringify(decks));
    } catch (e) {}
  }, [decks]);

  useEffect(() => {
    try {
      localStorage.setItem('gt_change_requests_v1', JSON.stringify(changeRequests));
    } catch (e) {}
  }, [changeRequests]);

  // Active tracker
  const activeTracker = trackers.find((t) => t.id === activeTrackerId) || trackers[0];

  // User permissions
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'creator';
  const isGuest = currentUser.role === 'guest';
  const isStaff = currentUser.role === 'staff';

  // User permissions based on requirement:
  // "admin has a complete access deletion editing , only they project and assign by admin ca nabe edit"
  const isProjectAssigned =
    isAdmin ||
    Boolean(currentUser.isCollaborator) ||
    !currentUser.assignedProjects ||
    currentUser.assignedProjects.length === 0 ||
    Boolean(currentUser.assignedProjects && currentUser.assignedProjects.includes(activeTracker?.id));

  // Admin has complete access. In Local Mode, full editing is always unlocked.
  const canAccessActiveTracker = isLocalMode || isAdmin || isProjectAssigned;
  const canEdit = isLocalMode || (!isGuest && (isAdmin || currentUser.isCollaborator || (isStaff && isProjectAssigned)));

  // Warning calculations
  const totalWarningCount = trackers.reduce((count, trk) => {
    return (
      count +
      (Array.isArray(trk.rows)
        ? trk.rows.filter((r) => r.slaData?.isNoMovement14Days || r.slaData?.slaHealth === 'critical').length
        : 0)
    );
  }, 0);

  // Save all changes locally, to team server, and to Supabase
  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      // 1. Save to localStorage
      try {
        localStorage.setItem('gt_trackers_v1', JSON.stringify(trackers));
        localStorage.setItem('gt_folders_v1', JSON.stringify(folders));
        localStorage.setItem('gt_users_v1', JSON.stringify(users));
        localStorage.setItem('gt_visits_v1', JSON.stringify(siteVisits));
        localStorage.setItem('gt_decks_v2', JSON.stringify(decks));
        localStorage.setItem('gt_change_requests_v1', JSON.stringify(changeRequests));
      } catch (e) {}

      // 2. Broadcast & push full state to Real-Time Server
      realtimeClient.updateFullState({
        trackers,
        folders,
        users,
        siteVisits,
        decks,
        changeRequests,
      });

      try {
        await fetch('/api/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            state: {
              trackers,
              folders,
              users,
              siteVisits,
              decks,
              changeRequests,
            },
          }),
        });
      } catch (e) {}

      // 3. Push to Supabase if configured and autoSync is enabled
      let supabaseMsg = '';
      if (supabaseConfig.url && supabaseConfig.anonKey && supabaseConfig.autoSync) {
        const res = await saveTrackersToSupabase(trackers, supabaseConfig);
        if (res.success) {
          supabaseMsg = ` & Supabase (${res.count} trackers)`;
          setSupabaseConfig((prev) => ({
            ...prev,
            lastSyncedAt: new Date().toISOString(),
            isConnected: true,
          }));
        } else {
          console.warn('Supabase sync warning:', res.error);
        }
      }

      // 4. Push to Cloudflare Worker Edge DB (100% Free) if configured and autoSync is enabled
      let cloudflareMsg = '';
      if (cloudflareConfig.workerUrl && cloudflareConfig.workerUrl.trim() && cloudflareConfig.autoSync) {
        const cfRes = await pushTrackersToCloudflare(cloudflareConfig, trackers, {
          userEmail: currentUser?.email,
          userName: currentUser?.name,
        });
        if (cfRes.success) {
          cloudflareMsg = ' & Cloudflare Edge';
          setCloudflareConfig(getCloudflareConfig());
        } else {
          console.warn('Cloudflare sync warning:', cfRes.message);
        }
      }

      // 5. Push to Google Cloud Firestore (100% Free)
      let firebaseMsg = '';
      if (isFirebaseConfigured() && isFirebaseAutoSync) {
        try {
          const fbRes = await syncAllTrackersToFirestore(trackers);
          if (fbRes.success) {
            firebaseMsg = ` & Firestore (${fbRes.count} trackers)`;
            const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            setFirebaseLastSyncedAt(nowTime);
          }
        } catch (e) {
          console.warn('Firestore sync error:', e);
        }
      }

      // 6. Push to GitHub (Version-controlled snapshot) & Trigger Vercel if configured
      let githubMsg = '';
      const ghCfg = getGitHubConfig();
      if (ghCfg.token && (ghCfg.autoCommitOnSave || ghCfg.autoUpdateRealtime)) {
        try {
          const ghRes = await pushTrackersWithVercelDeploy(
            ghCfg,
            trackers,
            `Auto-save commit: updated ${trackers.length} tracker datasets`
          );
          if (ghRes.success) {
            githubMsg = ghRes.vercelTriggered
              ? ' & GitHub ➔ Vercel'
              : ' & GitHub';
          }
        } catch (e) {
          console.warn('GitHub/Vercel auto-commit warning:', e);
        }
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSavedTime(timeStr);
      setHasUnsavedChanges(false);
      setUnsavedCount(0);
      showRemoteToast(`💾 Saved changes to Local Disk, Team Server${supabaseMsg}${cloudflareMsg}${firebaseMsg}${githubMsg}!`);
    } catch (err: any) {
      console.error('Save failed:', err);
      showRemoteToast(`⚠️ Save warning: ${err.message || 'Check connection'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Automated GitHub & Vercel Real-Time Pipeline on Data Changes (15-second debounce)
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const ghCfg = getGitHubConfig();
    if (!ghCfg.token || !ghCfg.autoUpdateRealtime) return;

    const timer = setTimeout(async () => {
      try {
        const res = await pushTrackersWithVercelDeploy(
          ghCfg,
          trackers,
          `⚡ Auto-update: debounced site changes (${trackers.length} sheets)`
        );
        if (res.success) {
          setHasUnsavedChanges(false);
          setUnsavedCount(0);
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setLastSavedTime(timeStr);
          showRemoteToast(
            `⚡ Auto-updated GitHub (${res.commitSha?.slice(0, 7)}) ${res.vercelTriggered ? '➔ ▲ Vercel deploying' : ''}`
          );
        }
      } catch (err: any) {
        console.warn('Auto-update pipeline error:', err);
      }
    }, 15000);

    return () => clearTimeout(timer);
  }, [hasUnsavedChanges, trackers]);

  // Periodic Interval Auto-Update Schedule (e.g., every 5, 10, 15, 30, 60 minutes)
  useEffect(() => {
    const ghCfg = getGitHubConfig();
    if (!ghCfg.token || !ghCfg.autoUpdateInterval || ghCfg.autoUpdateInterval <= 0) return;

    const intervalMs = ghCfg.autoUpdateInterval * 60 * 1000;
    const interval = setInterval(async () => {
      try {
        const res = await pushTrackersWithVercelDeploy(
          ghCfg,
          trackers,
          `⏱️ Scheduled auto-update (${ghCfg.autoUpdateInterval}m interval)`
        );
        if (res.success) {
          setHasUnsavedChanges(false);
          setUnsavedCount(0);
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setLastSavedTime(timeStr);
          showRemoteToast(
            `⏱️ Scheduled auto-update to GitHub (${res.commitSha?.slice(0, 7)}) ➔ Vercel deployed`
          );
        }
      } catch (e) {}
    }, intervalMs);

    return () => clearInterval(interval);
  }, [trackers]);

  // Cloudflare Periodic Background Pull for Team Updates
  useEffect(() => {
    if (!cloudflareConfig.workerUrl || !cloudflareConfig.workerUrl.trim() || !cloudflareConfig.autoSync) return;

    const interval = setInterval(async () => {
      try {
        const res = await loadTrackersFromCloudflare(cloudflareConfig);
        if (res.success && res.trackers && res.trackers.length > 0) {
          // If no unsaved local changes exist, keep in sync with team
          if (!hasUnsavedChanges) {
            setTrackers(res.trackers);
          }
        }
      } catch (e) {}
    }, Math.max(10, cloudflareConfig.syncIntervalSeconds || 15) * 1000);

    return () => clearInterval(interval);
  }, [cloudflareConfig, hasUnsavedChanges]);

  // Google Cloud Firestore (Firebase) Real-Time Synchronization & Initial Auto-Seed
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    let unsubTrackers: (() => void) | null = null;
    let unsubFolders: (() => void) | null = null;
    let unsubUsers: (() => void) | null = null;

    loadTrackersFromFirestore()
      .then(async (cloudTrackers) => {
        if (cloudTrackers && cloudTrackers.length > 0) {
          // Reconcile cloud trackers with local state without destroying order
          setTrackers((prev) => {
            const updated = prev.map((localT) => {
              const remote = cloudTrackers.find((rt) => rt.id === localT.id);
              return remote || localT;
            });
            for (const rt of cloudTrackers) {
              if (!updated.some((u) => u.id === rt.id)) {
                updated.push(rt);
              }
            }
            return updated;
          });
          const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setFirebaseLastSyncedAt(nowStr);
        } else {
          // One-time initial seed to Firestore so the free cloud database is populated immediately
          await syncAllTrackersToFirestore(trackers);
          const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setFirebaseLastSyncedAt(nowStr);
          console.log('[Firebase Firestore] Auto-seeded initial portfolio to cloud.');
        }

        // Live real-time snapshot listener from Firestore
        unsubTrackers = subscribeToTrackers((remoteTrackers, changes) => {
          if (!remoteTrackers || remoteTrackers.length === 0 || !isFirebaseAutoSync) return;

          setTrackers((prev) => {
            let hasAnyChange = false;
            let updatedTrackerName = '';

            const merged = prev.map((localT) => {
              const remote = remoteTrackers.find((rt) => rt.id === localT.id);
              if (!remote) return localT;

              // Comprehensive difference detection (rows, columns, name, folderId, updatedAt, etc.)
              const rowsChanged =
                (remote.updatedAt && remote.updatedAt !== localT.updatedAt) ||
                ((remote.rows?.length ?? 0) !== (localT.rows?.length ?? 0)) ||
                remote.name !== localT.name ||
                remote.folderId !== localT.folderId ||
                JSON.stringify(remote.rows) !== JSON.stringify(localT.rows) ||
                JSON.stringify(remote.columns) !== JSON.stringify(localT.columns) ||
                JSON.stringify(remote) !== JSON.stringify(localT);

              if (rowsChanged) {
                hasAnyChange = true;
                updatedTrackerName = remote.name;
                return remote;
              }
              return localT;
            });

            // Append any remote trackers not present locally
            for (const rt of remoteTrackers) {
              if (!merged.some((m) => m.id === rt.id)) {
                merged.push(rt);
                hasAnyChange = true;
                updatedTrackerName = rt.name;
              }
            }

            if (hasAnyChange) {
              try {
                localStorage.setItem('gt_trackers_v1', JSON.stringify(merged));
              } catch (e) {}

              // Synchronize open modals if their row was changed remotely
              for (const remote of remoteTrackers) {
                if (Array.isArray(remote.rows)) {
                  setSlaModalRow((curr) => {
                    if (!curr) return curr;
                    const match = remote.rows.find((r) => r.id === curr.id);
                    return match && JSON.stringify(match) !== JSON.stringify(curr) ? match : curr;
                  });
                  setChecklistModalRow((curr) => {
                    if (!curr) return curr;
                    const match = remote.rows.find((r) => r.id === curr.id);
                    return match && JSON.stringify(match) !== JSON.stringify(curr) ? match : curr;
                  });
                  setDataDrawerRow((curr) => {
                    if (!curr) return curr;
                    const match = remote.rows.find((r) => r.id === curr.id);
                    return match && JSON.stringify(match) !== JSON.stringify(curr) ? match : curr;
                  });
                }
              }

              showRemoteToast(`⚡ Live update synced in "${updatedTrackerName}"!`);
              return merged;
            }

            return prev;
          });

          const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setFirebaseLastSyncedAt(nowStr);
        });

        // Also subscribe to folders and users from Firestore
        unsubFolders = subscribeToFolders((remoteFolders) => {
          if (remoteFolders && remoteFolders.length > 0) {
            setFolders(remoteFolders);
            try {
              localStorage.setItem('gt_folders_v1', JSON.stringify(remoteFolders));
            } catch (e) {}
          }
        });

        unsubUsers = subscribeToUsers((remoteUsers) => {
          if (remoteUsers && remoteUsers.length > 0) {
            setUsers(remoteUsers);
            try {
              localStorage.setItem('gt_users_v1', JSON.stringify(remoteUsers));
            } catch (e) {}
            // Keep currentUser in sync if active record was updated remotely
            setCurrentUser((prev) => {
              const matched = remoteUsers.find(
                (u) => u.id === prev.id || (u.email && prev.email && u.email.toLowerCase() === prev.email.toLowerCase())
              );
              return matched ? { ...prev, ...matched } : prev;
            });
          }
        });
      })
      .catch((e) => console.warn('[Firebase] Firestore init warning:', e));

    return () => {
      if (unsubTrackers) unsubTrackers();
      if (unsubFolders) unsubFolders();
      if (unsubUsers) unsubUsers();
    };
  }, [isFirebaseAutoSync]);

  // Keyboard shortcut Ctrl+S / Cmd+S for Save Changes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveChanges();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [trackers, folders, users, siteVisits, decks, changeRequests, supabaseConfig, cloudflareConfig]);

  // Handlers
  const handleUpdateTracker = (updated: Tracker) => {
    setTrackers((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    realtimeClient.updateTracker(updated);

    // Save directly to Google Cloud Firestore with deep sanitization
    if (isFirebaseConfigured() && isFirebaseAutoSync) {
      saveTrackerToFirestore(updated).catch((e) => console.warn('Firestore tracker save warning:', e));
    }

    // Background persistent save to server
    fetch('/api/trackers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tracker: updated }),
    }).catch((e) => console.warn('Server auto-save tracker warning:', e));

    setHasUnsavedChanges(true);
    setUnsavedCount((c) => c + 1);
  };

  const handleUpdateRowInTracker = (trackerId: string, updatedRow: TrackerRow) => {
    let currentTrkSnapshot: Tracker | undefined;
    setTrackers((prevTrackers) => {
      const updated = prevTrackers.map((trk) => {
        if (trk.id !== trackerId) return trk;
        const updatedRows = trk.rows.map((r) => (r.id === updatedRow.id ? updatedRow : r));
        const updatedTracker = {
          ...trk,
          rows: updatedRows,
          updatedAt: new Date().toISOString(),
        };
        currentTrkSnapshot = updatedTracker;
        return updatedTracker;
      });
      return updated;
    });

    realtimeClient.updateRow(trackerId, updatedRow);

    // Save row to Google Cloud Firestore immediately
    if (isFirebaseConfigured() && isFirebaseAutoSync) {
      const targetTrk = currentTrkSnapshot || trackers.find((t) => t.id === trackerId);
      if (targetTrk) {
        saveRowToFirestore(trackerId, updatedRow, targetTrk).catch((e) =>
          console.warn('Firestore row save warning:', e)
        );
      }
    }

    // Sync modal instances if currently open
    if (slaModalRow?.id === updatedRow.id) setSlaModalRow(updatedRow);
    if (checklistModalRow?.id === updatedRow.id) setChecklistModalRow(updatedRow);
    if (dataDrawerRow?.id === updatedRow.id) setDataDrawerRow(updatedRow);

    setHasUnsavedChanges(true);
    setUnsavedCount((c) => c + 1);
  };

  const handleUpdateRowInActiveTracker = (updatedRow: TrackerRow) => {
    if (!activeTracker) return;
    handleUpdateRowInTracker(activeTracker.id, updatedRow);
  };

  const handleCreateTracker = (folderId?: string) => {
    setCreateTrackerFolderId(folderId);
    setIsCreateTrackerOpen(true);
  };

  const handleCreateTrackerConfirmed = (newTracker: Tracker) => {
    const updatedList = [...trackers, newTracker];
    setTrackers(updatedList);
    setActiveTrackerId(newTracker.id);
    realtimeClient.updateTracker(newTracker);
    if (isFirebaseConfigured() && isFirebaseAutoSync) {
      saveTrackerToFirestore(newTracker).catch((e) => console.warn('Firestore tracker save warning:', e));
    }
    setHasUnsavedChanges(true);
    setUnsavedCount((c) => c + 1);
    showRemoteToast(`✨ Created "${newTracker.name}" ${newTracker.enableSla ? '(with SLA)' : '(Standard Sheet)'}!`);
  };

  const handleDuplicateTracker = (trackerId: string) => {
    const source = trackers.find((t) => t.id === trackerId);
    if (!source) return;

    const dupId = 'tracker_' + Date.now().toString();
    const duplicated: Tracker = {
      ...JSON.parse(JSON.stringify(source)),
      id: dupId,
      name: `${source.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedList = [...trackers, duplicated];
    setTrackers(updatedList);
    setActiveTrackerId(dupId);
    realtimeClient.updateTracker(duplicated);
  };

  const handleRenameTracker = (trackerId: string, newName: string) => {
    const updated = trackers.map((t) => (t.id === trackerId ? { ...t, name: newName } : t));
    setTrackers(updated);
    const target = updated.find((t) => t.id === trackerId);
    if (target) realtimeClient.updateTracker(target);
  };

  const handleDeleteTracker = (trackerId: string) => {
    if (trackers.length <= 1) {
      return;
    }
    const remaining = trackers.filter((t) => t.id !== trackerId);
    setTrackers(remaining);
    if (activeTrackerId === trackerId) {
      setActiveTrackerId(remaining[0].id);
    }
    realtimeClient.updateFullState({ trackers: remaining });
  };

  // Lock and Approval handlers
  const handleUpdateTrackerLock = (isLocked: boolean, requireApproval: boolean) => {
    if (!activeTracker) return;
    handleUpdateTracker({
      ...activeTracker,
      isLocked,
      requireAdminApprovalForEdits: requireApproval,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleToggleTrackerLock = () => {
    if (!activeTracker) return;
    const newLocked = !activeTracker.isLocked;
    handleUpdateTrackerLock(newLocked, activeTracker.requireAdminApprovalForEdits ?? false);
    showRemoteToast(newLocked ? '🔒 Tracker is Protected (Direct Edit OFF)' : '🔓 Tracker Unlocked (Direct Edit ON)');
  };

  const handleToggleGoogleDriveSync = (enabled: boolean) => {
    setIsGoogleDriveAutoSync(enabled);
    try {
      localStorage.setItem('gt_gdrive_auto_sync', String(enabled));
    } catch {}
    showRemoteToast(enabled ? 'Google Drive auto-backup turned ON' : 'Google Drive backup turned OFF');
  };

  const handleSelectBestPreset = () => {
    // 1. Activate Google Cloud Firebase Firestore (best real-time NoSQL cloud DB, 100% free with 50k reads/day)
    setIsFirebaseAutoSync(true);
    try {
      localStorage.setItem('gt_firebase_auto_sync', 'true');
    } catch {}

    // 2. Keep the Live Team Server WebSocket relay active
    setIsServerSyncEnabled(true);
    realtimeClient.setEnabled(true);

    // 3. Turn OFF clashing secondary background synchronizers (Cloudflare Edge & Supabase)
    const updatedCf = { ...cloudflareConfig, autoSync: false };
    setCloudflareConfig(updatedCf);
    saveCloudflareConfig(updatedCf);

    const updatedSupa = { ...supabaseConfig, autoSync: false };
    setSupabaseConfig(updatedSupa);
    saveSupabaseConfig(updatedSupa);

    // 4. Turn OFF Google Drive background sync to avoid redundant export triggers
    setIsGoogleDriveAutoSync(false);
    try {
      localStorage.setItem('gt_gdrive_auto_sync', 'false');
    } catch {}

    // 5. Ensure tracker is unlocked for direct editing
    if (activeTracker?.isLocked) {
      handleUpdateTrackerLock(false, false);
    }

    showRemoteToast('⭐ Best Setup Activated: Firebase Firestore ON. Clashing secondary sync engines turned OFF!');
  };

  const handleApproveChangeRequest = (request: ChangeRequest) => {
    const targetTracker = trackers.find((t) => t.id === request.trackerId) || activeTracker;
    if (!targetTracker) return;

    const updatedRows = targetTracker.rows.map((row) => {
      if (row.id === request.rowId || row.siteId === request.siteId) {
        if (request.columnId === 'site_id') {
          return {
            ...row,
            siteId: String(request.newValue).trim(),
            updatedAt: new Date().toISOString(),
          };
        }
        return {
          ...row,
          values: {
            ...row.values,
            [request.columnId]: request.newValue,
          },
          updatedAt: new Date().toISOString(),
        };
      }
      return row;
    });

    handleUpdateTracker({
      ...targetTracker,
      rows: updatedRows,
      updatedAt: new Date().toISOString(),
    });

    setChangeRequests((prev) =>
      prev.map((cr) =>
        cr.id === request.id
          ? {
              ...cr,
              status: 'approved',
              reviewedBy: currentUser.name,
              reviewedAt: new Date().toISOString(),
            }
          : cr
      )
    );
  };

  const handleRejectChangeRequest = (requestId: string) => {
    setChangeRequests((prev) =>
      prev.map((cr) =>
        cr.id === requestId
          ? {
              ...cr,
              status: 'rejected',
              reviewedBy: currentUser.name,
              reviewedAt: new Date().toISOString(),
            }
          : cr
      )
    );
  };

  const handleSubmitChangeRequest = (
    request: Omit<ChangeRequest, 'id' | 'status' | 'requestedAt'>
  ) => {
    const newReq: ChangeRequest = {
      ...request,
      id: 'cr_' + Date.now().toString(),
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };
    setChangeRequests((prev) => [newReq, ...prev]);
  };

  const handleCreateFolder = (name: string) => {
    const newFolder: TrackerFolder = {
      id: 'folder_' + Date.now().toString(),
      name,
    };
    const updated = [...folders, newFolder];
    setFolders(updated);
    realtimeClient.updateFolders(updated);
  };

  const handleRenameFolder = (folderId: string, newName: string) => {
    const updated = folders.map((f) => (f.id === folderId ? { ...f, name: newName } : f));
    setFolders(updated);
    realtimeClient.updateFolders(updated);
  };

  const handleDeleteFolder = (folderId: string) => {
    if (folders.length <= 1) {
      return;
    }
    const remaining = folders.filter((f) => f.id !== folderId);
    setFolders(remaining);
    const fallbackFolderId = remaining[0].id;
    const updatedTrackers = trackers.map((t) =>
      t.folderId === folderId ? { ...t, folderId: fallbackFolderId } : t
    );
    setTrackers(updatedTrackers);
    realtimeClient.updateFolders(remaining);
    realtimeClient.updateFullState({ trackers: updatedTrackers, folders: remaining });
  };

  const handleMoveTrackerToFolder = (trackerId: string, targetFolderId: string) => {
    const updated = trackers.map((t) =>
      t.id === trackerId ? { ...t, folderId: targetFolderId, updatedAt: new Date().toISOString() } : t
    );
    setTrackers(updated);
    const moved = updated.find((t) => t.id === trackerId);
    if (moved) {
      realtimeClient.updateTracker(moved);
      if (isFirebaseConfigured() && isFirebaseAutoSync) {
        saveTrackerToFirestore(moved).catch((e) => console.warn('Firestore move error:', e));
      }
    }
    realtimeClient.updateFullState({ trackers: updated });
    const targetFolder = folders.find((f) => f.id === targetFolderId);
    showRemoteToast(`📁 Moved "${moved?.name || 'Tracker'}" to folder "${targetFolder?.name || 'Folder'}"`);
  };

  const handleReorderTrackers = (reordered: Tracker[]) => {
    setTrackers(reordered);
    realtimeClient.updateFullState({ trackers: reordered });
    try {
      localStorage.setItem('gt_trackers_v1', JSON.stringify(reordered));
    } catch (e) {}
  };

  const handleReorderFolders = (reordered: TrackerFolder[]) => {
    setFolders(reordered);
    realtimeClient.updateFolders(reordered);
    try {
      localStorage.setItem('gt_folders_v1', JSON.stringify(reordered));
    } catch (e) {}
  };

  const handleSaveColumns = (
    newCols: ColumnDefinition[],
    newAppearance?: TrackerAppearance,
    newFrozenColumns?: number,
    newFrozenRows?: number,
    newEnableSla?: boolean
  ) => {
    if (!activeTracker) return;
    handleUpdateTracker({
      ...activeTracker,
      columns: newCols,
      appearance: newAppearance !== undefined ? newAppearance : activeTracker.appearance,
      frozenColumns: newFrozenColumns !== undefined ? newFrozenColumns : activeTracker.frozenColumns,
      frozenRows: newFrozenRows !== undefined ? newFrozenRows : (activeTracker.frozenRows ?? 0),
      enableSla: newEnableSla !== undefined ? newEnableSla : activeTracker.enableSla,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAddSiteVisit = (record: SiteVisitRecord) => {
    const updated = [record, ...siteVisits];
    setSiteVisits(updated);
    realtimeClient.updateVisits(updated);
  };

  const handleRestoreFullState = (restored: {
    trackers: Tracker[];
    folders: TrackerFolder[];
    users: UserAccount[];
    visits: SiteVisitRecord[];
  }) => {
    if (restored.trackers?.length) {
      const cleanTrackers = [...restored.trackers];
      setTrackers(cleanTrackers);
      try {
        localStorage.setItem('gt_trackers_v1', JSON.stringify(cleanTrackers));
      } catch (e) {}
      setActiveTrackerId((currentActive) => {
        if (cleanTrackers.some((t) => t.id === currentActive)) {
          return currentActive;
        }
        return cleanTrackers[0]?.id || currentActive;
      });
      setActiveView('tracker');
    }
    if (restored.folders?.length) {
      const cleanFolders = [...restored.folders];
      setFolders(cleanFolders);
      try {
        localStorage.setItem('gt_folders_v1', JSON.stringify(cleanFolders));
      } catch (e) {}
    }
    if (restored.users?.length) {
      const cleanUsers = [...restored.users];
      setUsers(cleanUsers);
      try {
        localStorage.setItem('gt_users_v1', JSON.stringify(cleanUsers));
      } catch (e) {}
    }
    if (restored.visits?.length) {
      const cleanVisits = [...restored.visits];
      setSiteVisits(cleanVisits);
      try {
        localStorage.setItem('gt_visits_v1', JSON.stringify(cleanVisits));
      } catch (e) {}
    }

    realtimeClient.updateFullState({
      trackers: restored.trackers,
      folders: restored.folders,
      users: restored.users,
      siteVisits: restored.visits,
    });

    if (isFirebaseConfigured() && isFirebaseAutoSync) {
      if (restored.trackers?.length) syncAllTrackersToFirestore(restored.trackers).catch((e) => console.warn('Restore firestore sync warning:', e));
      if (restored.folders?.length) syncFoldersToFirestore(restored.folders).catch((e) => console.warn('Restore folders sync warning:', e));
      if (restored.users?.length) syncUsersToFirestore(restored.users).catch((e) => console.warn('Restore users sync warning:', e));
    }

    showRemoteToast(`📥 Restored backup: ${restored.trackers?.length || 0} trackers & ${restored.visits?.length || 0} visits!`);
  };

  const handleForceSyncPush = async () => {
    const fullState = { trackers, folders, users, siteVisits, decks, changeRequests };
    realtimeClient.updateFullState(fullState);
    try {
      await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: fullState }),
      });
      showRemoteToast('✓ Pushed all trackers & data to Cloud Server successfully!');
    } catch (e) {
      console.warn('Sync push error:', e);
    }
  };

  const handleForceSyncPull = async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.trackers) && data.trackers.length > 0) setTrackers(data.trackers);
        if (Array.isArray(data.folders) && data.folders.length > 0) setFolders(data.folders);
        if (Array.isArray(data.users) && data.users.length > 0) setUsers(data.users);
        if (Array.isArray(data.siteVisits)) setSiteVisits(data.siteVisits);
        if (Array.isArray(data.decks)) setDecks(data.decks);
        if (Array.isArray(data.changeRequests)) setChangeRequests(data.changeRequests);
        showRemoteToast('✓ Pulled latest state from Cloud Server!');
      }
    } catch (e) {
      console.warn('Sync pull error:', e);
    }
  };

  // If user is not logged in, render the dedicated Landing / Login Page
  if (!isLoggedIn) {
    const activeTrackerObj = trackers.find((t) => t.id === activeTrackerId);
    let urlRole: string | undefined;
    let urlName: string | undefined;
    try {
      if (typeof window !== 'undefined') {
        const p = new URLSearchParams(window.location.search);
        urlRole = p.get('role') || p.get('collab') || undefined;
        urlName = p.get('name') || p.get('user') || undefined;
      }
    } catch {}

    return (
      <>
        <LandingLoginPage
          allUsers={users}
          sharedTrackerName={activeTrackerObj?.name}
          targetTrackerId={activeTrackerId}
          inviteRole={urlRole}
          inviteName={urlName}
          onOpenLocalViewer={() => setIsLocalVersionModalOpen(true)}
          onLogin={(user) => {
            setCurrentUser(user);
            setIsLoggedIn(true);
            try {
              const urlParams = new URLSearchParams(window.location.search);
              const urlTracker = urlParams.get('tracker');
              if (urlTracker && trackers.some((t) => t.id === urlTracker)) {
                setActiveTrackerId(urlTracker);
                return;
              }
            } catch (e) {}

            // If staff handler has assigned projects, navigate to their first assigned project
            if (user.role === 'staff' && user.assignedProjects && user.assignedProjects.length > 0) {
              if (!user.assignedProjects.includes(activeTrackerId)) {
                setActiveTrackerId(user.assignedProjects[0]);
              }
            }
          }}
          onRegister={(newUser) => {
            setUsers((prev) => [...prev, newUser]);
          }}
        />
        <LocalVersionModal
          isOpen={isLocalVersionModalOpen}
          onClose={() => setIsLocalVersionModalOpen(false)}
          trackers={trackers}
          folders={folders}
          users={users}
          visits={siteVisits}
          isLocalMode={isLocalMode}
          onActivateLocalMode={handleActivateLocalMode}
          onExitLocalMode={handleExitLocalMode}
        />
      </>
    );
  }

  return (
    <div
      className={`min-h-screen w-full flex flex-col ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      } antialiased selection:bg-indigo-500/30 selection:text-white`}
    >
      {/* Top Bar adhering to Top Bar Contract */}
      <Navbar
        activeView={activeView}
        onChangeView={(view) => {
          if (view === 'attendance') {
            setIsAttendanceModalOpen(true);
          } else {
            setActiveView(view);
          }
        }}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onOpenServerModal={() => setIsTeamServerModalOpen(true)}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onOpenFirebaseModal={() => setIsFirebaseModalOpen(true)}
        isFirebaseConnected={isFirebaseConfigured()}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        isSupabaseConnected={Boolean(supabaseConfig.isConnected && supabaseConfig.url)}
        onOpenCloudflareModal={() => setIsCloudflareModalOpen(true)}
        isCloudflareConnected={Boolean(cloudflareConfig.workerUrl && cloudflareConfig.workerUrl.trim())}
        onSaveChanges={handleSaveChanges}
        hasUnsavedChanges={hasUnsavedChanges}
        unsavedCount={unsavedCount}
        isSaving={isSaving}
        lastSavedTime={lastSavedTime}
        onOpenGlobalSearch={() => setIsGlobalSearchOpen(true)}
        onOpenLockModal={() => setIsLockApprovalModalOpen(true)}
        isTrackerLocked={activeTracker?.isLocked}
        onToggleTrackerLock={handleToggleTrackerLock}
        isFirebaseAutoSync={isFirebaseAutoSync}
        onToggleFirebaseAutoSync={(enabled) => {
          setIsFirebaseAutoSync(enabled);
          try {
            localStorage.setItem('gt_firebase_auto_sync', String(enabled));
          } catch (e) {}
          showRemoteToast(enabled ? 'Google Cloud Firestore auto-sync turned ON' : 'Google Cloud Firestore sync turned OFF');
        }}
        isServerSyncEnabled={isServerSyncEnabled}
        onToggleServerSync={(enabled) => {
          setIsServerSyncEnabled(enabled);
          realtimeClient.setEnabled(enabled);
          showRemoteToast(enabled ? 'Live Team Database turned ON' : 'Live Team Database turned OFF');
        }}
        isCloudflareAutoSync={Boolean(cloudflareConfig.autoSync)}
        onToggleCloudflareAutoSync={(enabled) => {
          const updated = { ...cloudflareConfig, autoSync: enabled };
          setCloudflareConfig(updated);
          saveCloudflareConfig(updated);
          showRemoteToast(enabled ? 'Cloudflare Edge DB auto-sync turned ON' : 'Cloudflare Edge DB sync turned OFF');
        }}
        isSupabaseAutoSync={Boolean(supabaseConfig.autoSync)}
        onToggleSupabaseAutoSync={(enabled) => {
          const updated = { ...supabaseConfig, autoSync: enabled };
          setSupabaseConfig(updated);
          saveSupabaseConfig(updated);
          showRemoteToast(enabled ? 'Supabase PostgreSQL auto-sync turned ON' : 'Supabase PostgreSQL sync turned OFF');
        }}
        isGoogleDriveAutoSync={isGoogleDriveAutoSync}
        onToggleGoogleDriveSync={handleToggleGoogleDriveSync}
        onSelectBestPreset={handleSelectBestPreset}
        isLocalMode={isLocalMode}
        onOpenLocalModal={() => setIsLocalVersionModalOpen(true)}
        onOpenDevOpsModal={(tab) => {
          setDevOpsModalTab(tab || 'pipeline');
          setIsDevOpsModalOpen(true);
        }}
        pendingApprovalsCount={changeRequests.filter((cr) => cr.status === 'pending').length}
        pendingRegistrationsCount={users.filter((u) => u.status === 'pending').length}
        onLogout={() => {
          setIsLoggedIn(false);
          try {
            localStorage.setItem('gt_auth_logged_in_v2', 'false');
          } catch (e) {}
        }}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        criticalWarningCount={totalWarningCount}
        connectionStatus={isServerSyncEnabled ? connectionStatus : 'disconnected'}
        onlineUsersCount={isServerSyncEnabled ? Math.max(1, onlineUsers.length) : 1}
      />

      {/* Prominent Local Offline Version Mode Active Banner */}
      {isLocalMode && (
        <div className="bg-gradient-to-r from-amber-950/95 via-slate-950 to-sky-950/95 border-b border-amber-500/60 px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 text-xs text-amber-200 shrink-0 z-30 shadow-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <div className="min-w-0">
              <span className="font-black text-amber-300 mr-2 uppercase tracking-wide">⚡ Local Offline Version Active</span>
              <span className="text-slate-300 font-mono text-[11px] truncate inline-block max-w-[280px] sm:max-w-md">
                Viewing: <strong className="text-sky-300">{localBackupName}</strong> ({trackers.length} sheets · {trackers.reduce((acc, t) => acc + (t.rows ? t.rows.length : 0), 0)} rows)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setIsLocalVersionModalOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sky-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Upload className="w-3 h-3" />
              <span>Load Another File</span>
            </button>
            <button
              type="button"
              onClick={() => downloadStandaloneViewerHtml({ trackers, folders, users, visits: siteVisits, sourceName: localBackupName })}
              className="px-2.5 py-1 rounded-lg bg-indigo-900/80 hover:bg-indigo-800 border border-indigo-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title="Download 100% self-contained offline HTML file"
            >
              <FileCode className="w-3 h-3 text-indigo-300" />
              <span>Export HTML Viewer</span>
            </button>
            <button
              type="button"
              onClick={handleExitLocalMode}
              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              Exit to Cloud Mode
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden">
        {/* Collapsible Sidebar (Multi-Tracker Manager) */}
        <Sidebar
          trackers={trackers}
          folders={folders}
          activeTrackerId={activeTrackerId}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onSelectTracker={(id) => setActiveTrackerId(id)}
          onCreateTracker={handleCreateTracker}
          onDuplicateTracker={handleDuplicateTracker}
          onRenameTracker={handleRenameTracker}
          onDeleteTracker={handleDeleteTracker}
          onCreateFolder={handleCreateFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
          onMoveTrackerToFolder={handleMoveTrackerToFolder}
          onReorderTrackers={handleReorderTrackers}
          onReorderFolders={handleReorderFolders}
          onOpenGlobalSearch={() => setIsGlobalSearchOpen(true)}
          canEdit={canEdit}
          isAdmin={isAdmin}
          currentUserRole={currentUser.role}
          assignedProjects={currentUser.assignedProjects}
          onOpenDevOpsModal={(tab) => {
            setDevOpsModalTab(tab || 'pipeline');
            setIsDevOpsModalOpen(true);
          }}
        />

        {/* Viewport Content */}
        <main className="flex-1 flex flex-col overflow-hidden p-3 md:p-5">
          {/* Active Tracker & Folder Breadcrumb Bar with Full Rename & Data Lock Controls */}
          {activeTracker && (
            <div className="mb-3 px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Folder Section: Switch or Rename Folder */}
                <div className="flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-slate-400 font-semibold">Folder:</span>

                  {isRenamingActiveFolder ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        autoFocus
                        value={tempFolderName}
                        onChange={(e) => setTempFolderName(e.target.value)}
                        className="px-2 py-0.5 bg-slate-950 border border-amber-400 rounded text-white font-bold text-xs"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (tempFolderName.trim()) {
                              handleRenameFolder(activeTracker.folderId, tempFolderName.trim());
                            }
                            setIsRenamingActiveFolder(false);
                          }
                          if (e.key === 'Escape') setIsRenamingActiveFolder(false);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (tempFolderName.trim()) {
                            handleRenameFolder(activeTracker.folderId, tempFolderName.trim());
                          }
                          setIsRenamingActiveFolder(false);
                        }}
                        className="p-1 text-emerald-400 hover:text-emerald-300"
                        title="Save folder name"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsRenamingActiveFolder(false)}
                        className="p-1 text-slate-400 hover:text-white"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <select
                        value={activeTracker.folderId}
                        onChange={(e) => handleUpdateTracker({ ...activeTracker, folderId: e.target.value })}
                        disabled={!canEdit}
                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-semibold focus:outline-hidden"
                        title="Move tracker to another folder"
                      >
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            const curFolder = folders.find((f) => f.id === activeTracker.folderId);
                            setTempFolderName(curFolder?.name || '');
                            setIsRenamingActiveFolder(true);
                          }}
                          className="p-1 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded transition-colors"
                          title="Rename active folder"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <span className="text-slate-600 font-mono">/</span>

                {/* Tracker Section: Rename Tracker */}
                {isRenamingActiveTracker ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      autoFocus
                      value={tempTrackerName}
                      onChange={(e) => setTempTrackerName(e.target.value)}
                      className="px-2 py-0.5 bg-slate-950 border border-indigo-400 rounded text-white font-bold text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (tempTrackerName.trim()) {
                            handleRenameTracker(activeTracker.id, tempTrackerName.trim());
                          }
                          setIsRenamingActiveTracker(false);
                        }
                        if (e.key === 'Escape') setIsRenamingActiveTracker(false);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (tempTrackerName.trim()) {
                          handleRenameTracker(activeTracker.id, tempTrackerName.trim());
                        }
                        setIsRenamingActiveTracker(false);
                      }}
                      className="p-1 text-emerald-400 hover:text-emerald-300"
                      title="Save tracker name"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsRenamingActiveTracker(false)}
                      className="p-1 text-slate-400 hover:text-white"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Table className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="font-bold text-white text-sm tracking-wide">{activeTracker.name}</span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setTempTrackerName(activeTracker.name);
                          setIsRenamingActiveTracker(true);
                        }}
                        className="p-1 text-slate-400 hover:text-sky-300 hover:bg-slate-800 rounded transition-colors"
                        title="Click to rename this tracker"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Right Side: Data Lock & Protection Badge + Currency Info */}
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Project SLA Target Badge & Customizer Trigger */}
                {isTrackerSlaEnabled(activeTracker) ? (
                  <button
                    type="button"
                    onClick={() => setIsProjectSlaModalOpen(true)}
                    className="px-2.5 py-1 rounded-md text-xs font-bold border flex items-center gap-1.5 transition-all bg-indigo-950/80 border-indigo-700/80 text-indigo-200 hover:text-white hover:bg-indigo-900 shadow-xs cursor-pointer"
                    title={`Project SLA Target: ${getEffectiveTrackerSlaConfig(activeTracker).targetDays}d (${getEffectiveTrackerSlaConfig(activeTracker).scopeName}). Click to customize or choose SLA options.`}
                  >
                    <Target className="w-3.5 h-3.5 text-amber-400" />
                    <span>SLA: {getEffectiveTrackerSlaConfig(activeTracker).targetDays}d</span>
                    <span className="hidden md:inline text-[11px] text-indigo-300 font-normal">
                      ({getEffectiveTrackerSlaConfig(activeTracker).scopeName.replace(/\(.*?\)/g, '').trim()})
                    </span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded border border-amber-500/40">
                      Customize
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsProjectSlaModalOpen(true)}
                    className="px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-all bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-850 shadow-xs cursor-pointer"
                    title="SLA Tracking is disabled for this tracker. Click to choose SLA options or enable it."
                  >
                    <Target className="w-3.5 h-3.5 text-slate-500" />
                    <span>SLA: Disabled</span>
                    <span className="text-[10px] bg-slate-800 text-sky-400 px-1 py-0.2 rounded border border-slate-700 font-bold">
                      + Setup
                    </span>
                  </button>
                )}

                {/* Data Protection Lock Status Button */}
                <button
                  type="button"
                  onClick={() => setIsLockApprovalModalOpen(true)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold border flex items-center gap-1.5 transition-colors ${
                    activeTracker.isLocked
                      ? 'bg-amber-950/80 border-amber-700 text-amber-300 ring-1 ring-amber-500/40 shadow-xs'
                      : 'bg-emerald-950/50 border-emerald-700 text-emerald-300 hover:text-white'
                  }`}
                  title="Direct Editing Active - Admin approval and deletion locks removed"
                >
                  {activeTracker.isLocked ? (
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>{activeTracker.isLocked ? 'Protected' : 'Direct Edit (Approval Removed)'}</span>
                  {changeRequests.filter((cr) => cr.trackerId === activeTracker.id && cr.status === 'pending').length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-extrabold animate-pulse">
                      {changeRequests.filter((cr) => cr.trackerId === activeTracker.id && cr.status === 'pending').length}
                    </span>
                  )}
                </button>

                <div className="hidden sm:flex items-center gap-2 text-slate-400 text-[11px] font-mono border-l border-slate-800 pl-3">
                  <span>{activeTracker.rows.length} Total Sites</span>
                  <span>·</span>
                  <span className="text-emerald-400 font-semibold">PHP (₱) Currency</span>
                </div>
              </div>
            </div>
          )}

          {/* Role-Based Active Permission Notification Banner - Compact single-line to lessen occupied area */}
          {showRoleBanner && (
            <div
              className={`mb-1.5 px-3 py-1 rounded-lg border text-xs flex items-center justify-between gap-2 shadow-xs ${
                isAdmin
                  ? 'bg-rose-950/20 border-rose-800/40 text-rose-200'
                  : isStaff && isProjectAssigned
                  ? 'bg-sky-950/20 border-sky-800/40 text-sky-200'
                  : 'bg-slate-900 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isAdmin
                      ? 'bg-rose-400 animate-pulse'
                      : isStaff && isProjectAssigned
                      ? 'bg-sky-400 animate-pulse'
                      : 'bg-emerald-400'
                  }`}
                />
                <span className="truncate text-[11px]">
                  {isAdmin ? (
                    <>
                      <strong className="text-rose-300">Admin Mode:</strong> Full edit, delete, add row, and approval permissions.
                    </>
                  ) : isStaff && isProjectAssigned ? (
                    <>
                      <strong className="text-sky-300">Handler Mode ({activeTracker.name}):</strong> Assigned project editor with edit and delete permissions.
                    </>
                  ) : isStaff && !isProjectAssigned ? (
                    <>
                      <strong className="text-amber-300">Handler Mode (View Only):</strong> Read-only presentation. Assigned to another handler.
                    </>
                  ) : (
                    <>
                      <strong className="text-emerald-300">Guest Auditor Mode:</strong> Read-only presentation mode.
                    </>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isAdmin && users.filter((u) => u.status === 'pending').length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(true)}
                    className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] transition-colors flex items-center gap-1 shadow-xs"
                  >
                    <Crown className="w-3 h-3" />
                    <span>{users.filter((u) => u.status === 'pending').length} Approvals</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowRoleBanner(false);
                    try {
                      localStorage.setItem('gt_hide_role_banner', 'true');
                    } catch {}
                  }}
                  className="p-0.5 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                  title="Hide notice to lessen occupied space"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* View Routing */}
          {activeView === 'tracker' && activeTracker && (
            <div className="flex-1 flex flex-col overflow-hidden space-y-2">
              {/* Optional inline dashboard above grid */}
              <DashboardView
                key={activeTracker.id}
                tracker={activeTracker}
                allTrackers={trackers}
                onUpdateCards={(cards) => handleUpdateTracker({ ...activeTracker, dashboardCards: cards })}
                onOpenDeck={() => setActiveView('deck')}
                onNavigateToAllMetrics={() => setActiveView('all_metrics')}
                canEdit={canEdit}
                onForceSyncPull={handleForceSyncPull}
              />

              {/* Main Excel-Style Grid */}
              <ExcelGrid
                tracker={activeTracker}
                onUpdateTracker={handleUpdateTracker}
                onUpdateRow={handleUpdateRowInActiveTracker}
                onOpenSlaModal={(row) => setSlaModalRow(row)}
                onOpenChecklistModal={(row) => setChecklistModalRow(row)}
                onOpenSiteDataDrawer={(row, mode = 'data1') => {
                  setDataDrawerRow(row);
                  setDataDrawerMode(mode);
                }}
                onOpenCustomizeColumns={() => setIsCustomizeColumnsOpen(true)}
                onOpenLockApprovalModal={() => setIsLockApprovalModalOpen(true)}
                pendingApprovalsCount={
                  changeRequests.filter((cr) => cr.trackerId === activeTracker.id && cr.status === 'pending').length
                }
                canEdit={canEdit}
                onSaveChanges={handleSaveChanges}
                hasUnsavedChanges={hasUnsavedChanges}
                unsavedCount={unsavedCount}
                isSaving={isSaving}
                lastSavedTime={lastSavedTime}
                onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
                isSupabaseConnected={Boolean(supabaseConfig.isConnected && supabaseConfig.url)}
                onOpenCloudflareModal={() => setIsCloudflareModalOpen(true)}
                isCloudflareConnected={Boolean(cloudflareConfig.workerUrl && cloudflareConfig.workerUrl.trim())}
                onOpenServerModal={() => setIsTeamServerModalOpen(true)}
                isServerConnected={connectionStatus === 'connected'}
                onOpenProjectSlaModal={() => setIsProjectSlaModalOpen(true)}
              />
            </div>
          )}

          {activeView === 'dashboard' && activeTracker && (
            <div className="flex-1 flex flex-col overflow-y-auto space-y-6">
              <DashboardView
                key={`full_dash_${activeTracker.id}`}
                tracker={activeTracker}
                allTrackers={trackers}
                onUpdateCards={(cards) => handleUpdateTracker({ ...activeTracker, dashboardCards: cards })}
                onOpenDeck={() => setActiveView('deck')}
                onNavigateToAllMetrics={() => setActiveView('all_metrics')}
                canEdit={canEdit}
                onForceSyncPull={handleForceSyncPull}
              />

              <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Tracker Data Columns Connected to Dashboard
                </h3>
                <p className="text-xs text-slate-400">
                  Every card in this executive dashboard updates instantaneously when cell values change in the Excel grid.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {activeTracker.columns.map((c) => (
                    <div key={c.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                      <div className="font-semibold text-white">{c.label}</div>
                      <div className="text-[11px] text-sky-400 mt-0.5">Type: {c.type}</div>
                      <div className="text-[10px] text-slate-500">Summary: {c.summaryType || 'None'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeView === 'all_metrics' && (
            <AllMetricsSummaryView
              trackers={trackers}
              activeTrackerId={activeTrackerId}
              onSelectTracker={(id) => setActiveTrackerId(id)}
              onOpenTrackerView={(id) => {
                if (id) setActiveTrackerId(id);
                setActiveView('tracker');
              }}
              onOpenSlaModal={(row) => setSlaModalRow(row)}
              onOpenChecklistModal={(row) => setChecklistModalRow(row)}
              onOpenSiteDataDrawer={(row) => {
                setDataDrawerRow(row);
                setDataDrawerMode('data1');
              }}
              canEdit={canEdit}
              onUpdateTrackerCards={(tId, cards) => {
                const target = trackers.find((t) => t.id === tId);
                if (target) handleUpdateTracker({ ...target, dashboardCards: cards });
              }}
            />
          )}

          {activeView === 'warning_center' && activeTracker && (
            <SlaWarningCenterView
              tracker={activeTracker}
              onOpenSlaModal={(row) => setSlaModalRow(row)}
              onOpenChecklistModal={(row) => setChecklistModalRow(row)}
              onOpenSiteDataDrawer={(row) => setDataDrawerRow(row)}
              onOpenProjectSlaModal={() => setIsProjectSlaModalOpen(true)}
            />
          )}

          {activeView === 'deck' && activeTracker && (
            <ExecutivePresentationDeck
              activeTracker={activeTracker}
              allTrackers={trackers}
              decks={decks}
              onUpdateDecks={setDecks}
              onUpdateTracker={handleUpdateTracker}
              onClose={() => setActiveView('tracker')}
            />
          )}
        </main>
      </div>

      {/* MODALS */}

      {/* 1. Day-by-Day SLA Progress Modal (Screenshot 3) */}
      {slaModalRow && (
        <DayByDaySlaModal
          row={slaModalRow}
          isOpen={true}
          onClose={() => setSlaModalRow(null)}
          onUpdateRowSla={handleUpdateRowInActiveTracker}
          onOpenCustomizeColumns={() => setIsCustomizeColumnsOpen(true)}
        />
      )}

      {/* 2. Legal Fees & Compliance Checklist Modal (Screenshot 1 & 2) */}
      {checklistModalRow && (
        <LegalFeesChecklistModal
          row={checklistModalRow}
          isOpen={true}
          onClose={() => setChecklistModalRow(null)}
          onUpdateRowChecklist={handleUpdateRowInActiveTracker}
        />
      )}

      {/* 3. Site Data Detailed Drawer (DATA 1 & DATA 2 - Different Encode) */}
      {dataDrawerRow && (
        <SiteDataDrawer
          row={dataDrawerRow}
          initialMode={dataDrawerMode}
          isOpen={true}
          onClose={() => setDataDrawerRow(null)}
          onSaveRow={handleUpdateRowInActiveTracker}
          onOpenSla={() => {
            const row = dataDrawerRow;
            setDataDrawerRow(null);
            setSlaModalRow(row);
          }}
          onOpenChecklist={() => {
            const row = dataDrawerRow;
            setDataDrawerRow(null);
            setChecklistModalRow(row);
          }}
        />
      )}

      {/* 4. Customize Columns & Appearance Modal */}
      {isCustomizeColumnsOpen && activeTracker && (
        <CustomizeColumnsModal
          columns={activeTracker.columns}
          appearance={activeTracker.appearance}
          frozenColumns={activeTracker.frozenColumns}
          frozenRows={activeTracker.frozenRows}
          enableSla={isTrackerSlaEnabled(activeTracker)}
          onOpenProjectSlaModal={() => {
            setIsCustomizeColumnsOpen(false);
            setIsProjectSlaModalOpen(true);
          }}
          isOpen={true}
          onClose={() => setIsCustomizeColumnsOpen(false)}
          onSaveColumns={handleSaveColumns}
        />
      )}

      {/* Customized Project SLA Target & Where to Put SLA Modal */}
      {isProjectSlaModalOpen && activeTracker && (
        <ProjectSlaCustomizerModal
          isOpen={true}
          onClose={() => setIsProjectSlaModalOpen(false)}
          tracker={activeTracker}
          allTrackers={trackers}
          onSelectTracker={(id) => setActiveTrackerId(id)}
          onUpdateTrackersList={(updatedList) => {
            setTrackers(updatedList);
            setHasUnsavedChanges(true);
            setUnsavedCount((c) => c + 1);
            try {
              localStorage.setItem('gt_trackers_v1', JSON.stringify(updatedList));
            } catch (e) {}
          }}
          onSaveProjectSla={(updated) => {
            handleUpdateTracker(updated);
          }}
          canEdit={canEdit}
        />
      )}

      {/* New Tracker Creation with Template & SLA Toggle Modal */}
      {isCreateTrackerOpen && (
        <CreateTrackerModal
          isOpen={true}
          onClose={() => setIsCreateTrackerOpen(false)}
          folders={folders}
          defaultFolderId={createTrackerFolderId}
          onCreateTracker={handleCreateTrackerConfirmed}
          existingTrackersCount={trackers.length}
        />
      )}

      {/* 5. User Login & Access Control Modal */}
      {isAuthModalOpen && (
        <AuthManagementModal
          isOpen={true}
          onClose={() => setIsAuthModalOpen(false)}
          currentUser={currentUser}
          allUsers={users}
          trackers={trackers}
          onSwitchUser={(user) => setCurrentUser(user)}
          onUpdateUsers={(updated) => setUsers(updated)}
          onLogout={() => {
            setCurrentUser(users.find((u) => u.role === 'guest') || users[0]);
            setIsAuthModalOpen(false);
          }}
        />
      )}

      {/* 6. Google Drive Backup & Cloud Sharing Modal */}
      {isBackupModalOpen && (
        <GoogleDriveBackupModal
          isOpen={true}
          onClose={() => setIsBackupModalOpen(false)}
          trackers={trackers}
          folders={folders}
          users={users}
          visits={siteVisits}
          onRestoreFullState={handleRestoreFullState}
        />
      )}

      {/* 7. Global Search Modal */}
      {isGlobalSearchOpen && (
        <GlobalSearchModal
          isOpen={true}
          onClose={() => setIsGlobalSearchOpen(false)}
          trackers={trackers}
          currentTrackerId={activeTrackerId}
          onSelectResult={(trackerId, rowId, openDataDrawer) => {
            setActiveTrackerId(trackerId);
            setActiveView('tracker');
            const targetTracker = trackers.find((t) => t.id === trackerId);
            const targetRow = targetTracker?.rows.find((r) => r.id === rowId);
            if (targetRow && openDataDrawer) {
              setDataDrawerRow(targetRow);
            }
          }}
          onOpenSlaModal={(row) => setSlaModalRow(row)}
          onOpenChecklistModal={(row) => setChecklistModalRow(row)}
          onOpenDataDrawer={(row, mode = 'data1') => {
            setDataDrawerRow(row);
            setDataDrawerMode(mode);
          }}
          onUpdateRow={handleUpdateRowInTracker}
        />
      )}

      {/* 8. Staff Attendance & GPS Clock In/Out Modal */}
      {isAttendanceModalOpen && activeTracker && (
        <StaffAttendanceModal
          isOpen={true}
          onClose={() => setIsAttendanceModalOpen(false)}
          currentUser={currentUser}
          availableSites={activeTracker.rows}
          visits={siteVisits}
          onAddVisit={handleAddSiteVisit}
        />
      )}

      {/* 9. Data Protection Lock & Admin Change Approval Modal */}
      {isLockApprovalModalOpen && activeTracker && (
        <DataLockApprovalModal
          isOpen={true}
          onClose={() => setIsLockApprovalModalOpen(false)}
          tracker={activeTracker}
          currentUser={currentUser}
          changeRequests={changeRequests}
          onUpdateTrackerLock={handleUpdateTrackerLock}
          onApproveChangeRequest={handleApproveChangeRequest}
          onRejectChangeRequest={handleRejectChangeRequest}
          onSubmitChangeRequest={handleSubmitChangeRequest}
        />
      )}

      {/* 10. Free Share & Live Co-Worker Collaboration Modal */}
      <ShareCollaborateModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        currentUser={currentUser}
        onlineUsers={onlineUsers}
        connectionStatus={connectionStatus}
        activeTrackerId={activeTracker?.id || activeTrackerId}
        activeTrackerName={activeTracker?.name || 'Project Tracker'}
      />

      {/* Invited Co-worker Quick Onboarding Modal */}
      {coworkerInvite && (
        <CoworkerJoinModal
          isOpen={coworkerInvite.isOpen}
          onClose={() => setCoworkerInvite(null)}
          trackerName={activeTracker?.name || 'Project Tracker'}
          trackerId={coworkerInvite.trackerId}
          roleRequested={coworkerInvite.role}
          prefilledName={coworkerInvite.suggestedName}
          onJoinSuccess={(collabUser) => {
            setCurrentUser(collabUser);
            setIsLoggedIn(true);
            showRemoteToast(`🚀 Welcome ${collabUser.name}! Real-time co-worker editing is active.`);
          }}
        />
      )}

      {/* 11. Free Collaborative Server & Live Real-Time Sync Modal */}
      <TeamServerModal
        isOpen={isTeamServerModalOpen}
        onClose={() => setIsTeamServerModalOpen(false)}
        currentUser={currentUser}
        onlineUsers={onlineUsers}
        connectionStatus={connectionStatus}
        onForceSyncPush={handleForceSyncPush}
        onForceSyncPull={handleForceSyncPull}
        trackersCount={trackers.length}
        rowsCount={trackers.reduce((acc, t) => acc + (Array.isArray(t.rows) ? t.rows.length : 0), 0)}
        activeTrackerId={activeTrackerId}
      />

      {/* 11. Connect Supabase Account & Backup / Auto File Storage Modal */}
      <SupabaseSyncModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        trackers={trackers}
        folders={folders}
        users={users}
        visits={siteVisits}
        onRestoreFullState={handleRestoreFullState}
        onTrackersLoaded={(loadedTrackers) => {
          if (Array.isArray(loadedTrackers) && loadedTrackers.length > 0) {
            setTrackers(loadedTrackers);
            setHasUnsavedChanges(true);
            setUnsavedCount((c) => c + loadedTrackers.length);
            showRemoteToast(`📥 Restored ${loadedTrackers.length} tracker sheets from Supabase`);
          }
        }}
        onConfigChanged={(cfg) => {
          setSupabaseConfig(cfg);
        }}
      />

      {/* 12. Connect Cloudflare Worker & Free Realtime Edge Database Modal */}
      <CloudflareSyncModal
        isOpen={isCloudflareModalOpen}
        onClose={() => setIsCloudflareModalOpen(false)}
        trackers={trackers}
        onTrackersLoaded={(loadedTrackers) => {
          if (Array.isArray(loadedTrackers) && loadedTrackers.length > 0) {
            setTrackers(loadedTrackers);
            setHasUnsavedChanges(true);
            setUnsavedCount((c) => c + loadedTrackers.length);
            showRemoteToast(`📥 Restored ${loadedTrackers.length} tracker sheets from Cloudflare Edge!`);
          }
        }}
        onConfigChanged={(cfg) => {
          setCloudflareConfig(cfg);
        }}
        userEmail={currentUser.email}
        userName={currentUser.name}
      />

      {/* 13. Free Google Cloud Firestore Database Modal */}
      <FirebaseSyncModal
        isOpen={isFirebaseModalOpen}
        onClose={() => setIsFirebaseModalOpen(false)}
        trackers={trackers}
        onTrackersLoaded={(loadedTrackers) => {
          if (Array.isArray(loadedTrackers) && loadedTrackers.length > 0) {
            setTrackers(loadedTrackers);
            setHasUnsavedChanges(true);
            setUnsavedCount((c) => c + loadedTrackers.length);
            showRemoteToast(`📥 Restored ${loadedTrackers.length} tracker sheets from Firestore!`);
          }
        }}
        isFirebaseActive={isFirebaseAutoSync}
        onToggleFirebaseAutoSync={(enabled) => setIsFirebaseAutoSync(enabled)}
        lastSyncedAt={firebaseLastSyncedAt}
      />

      {/* 14. Local Version & Offline Backup Viewer Modal */}
      <LocalVersionModal
        isOpen={isLocalVersionModalOpen}
        onClose={() => setIsLocalVersionModalOpen(false)}
        trackers={trackers}
        folders={folders}
        users={users}
        visits={siteVisits}
        isLocalMode={isLocalMode}
        onActivateLocalMode={handleActivateLocalMode}
        onExitLocalMode={handleExitLocalMode}
      />

      {/* 15. GitHub Connected, Vercel Deploy & Cloudflare Free Data Sharing Modal */}
      <DevOpsSyncModal
        isOpen={isDevOpsModalOpen}
        onClose={() => setIsDevOpsModalOpen(false)}
        trackers={trackers}
        onTrackersLoaded={(loaded) => {
          if (Array.isArray(loaded) && loaded.length > 0) {
            setTrackers(loaded);
            setHasUnsavedChanges(true);
            setUnsavedCount((c) => c + loaded.length);
            showRemoteToast(`📥 Restored ${loaded.length} tracker sheets from Git / Cloudflare!`);
          }
        }}
        defaultTab={devOpsModalTab}
      />

      {/* Floating Real-Time Remote Notification Toast */}
      {remoteToast && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="px-4 py-2.5 rounded-xl bg-slate-900/95 border border-emerald-500/60 text-white text-xs font-semibold shadow-2xl flex items-center gap-2.5 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-emerald-300 font-mono text-[11px] font-bold">LIVE SYNC:</span>
            <span>{remoteToast}</span>
          </div>
        </div>
      )}
    </div>
  );
}
