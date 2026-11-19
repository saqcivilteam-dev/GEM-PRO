import React, { useState, useRef, useEffect } from 'react';
import { UserAccount } from '../types/tracker';
import {
  Table,
  LayoutDashboard,
  BarChart3,
  ShieldAlert,
  MapPin,
  HardDrive,
  Presentation,
  Sun,
  Moon,
  Search,
  LogOut,
  UserPlus,
  Check,
  RefreshCw,
  ChevronDown,
  Save,
  Sliders,
  Database,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

export type ActiveView = 'tracker' | 'dashboard' | 'all_metrics' | 'warning_center' | 'attendance' | 'deck';

interface NavbarProps {
  activeView: ActiveView;
  onChangeView: (view: ActiveView) => void;
  currentUser: UserAccount;
  onOpenAuthModal: () => void;
  onOpenBackupModal: () => void;
  onOpenServerModal: () => void;
  onOpenSupabaseModal?: () => void;
  isSupabaseConnected?: boolean;
  isSupabaseAutoSync?: boolean;
  onToggleSupabaseAutoSync?: (enabled: boolean) => void;
  onOpenCloudflareModal?: () => void;
  isCloudflareConnected?: boolean;
  isCloudflareAutoSync?: boolean;
  onToggleCloudflareAutoSync?: (enabled: boolean) => void;
  onSaveChanges?: () => void;
  hasUnsavedChanges?: boolean;
  unsavedCount?: number;
  isSaving?: boolean;
  lastSavedTime?: string | null;
  onOpenGlobalSearch: () => void;
  onOpenLockModal?: () => void;
  isTrackerLocked?: boolean;
  onToggleTrackerLock?: () => void;
  pendingApprovalsCount?: number;
  pendingRegistrationsCount?: number;
  onLogout?: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  criticalWarningCount: number;
  connectionStatus?: 'connected' | 'connecting' | 'disconnected' | 'error';
  isServerSyncEnabled?: boolean;
  onToggleServerSync?: (enabled: boolean) => void;
  onlineUsersCount?: number;
  onOpenShareModal?: () => void;
  onOpenFirebaseModal?: () => void;
  isFirebaseConnected?: boolean;
  isFirebaseAutoSync?: boolean;
  onToggleFirebaseAutoSync?: (enabled: boolean) => void;
  isGoogleDriveAutoSync?: boolean;
  onToggleGoogleDriveSync?: (enabled: boolean) => void;
  onSelectBestPreset?: () => void;
  isLocalMode?: boolean;
  onOpenLocalModal?: () => void;
  onOpenDevOpsModal?: (tab?: 'pipeline' | 'github' | 'vercel' | 'cloudflare') => void;
  isGitHubConnected?: boolean;
  isVercelConnected?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  onChangeView,
  currentUser,
  onOpenAuthModal,
  onOpenBackupModal,
  onOpenServerModal,
  onOpenSupabaseModal,
  isSupabaseConnected = false,
  isSupabaseAutoSync = false,
  onToggleSupabaseAutoSync,
  onOpenCloudflareModal,
  isCloudflareConnected = false,
  isCloudflareAutoSync = false,
  onToggleCloudflareAutoSync,
  onSaveChanges,
  hasUnsavedChanges = false,
  unsavedCount = 0,
  isSaving = false,
  lastSavedTime = null,
  onOpenGlobalSearch,
  onOpenLockModal,
  isTrackerLocked = false,
  onToggleTrackerLock,
  pendingApprovalsCount = 0,
  pendingRegistrationsCount = 0,
  onLogout,
  isDarkMode,
  onToggleTheme,
  criticalWarningCount,
  connectionStatus = 'connected',
  isServerSyncEnabled = true,
  onToggleServerSync,
  onlineUsersCount = 1,
  onOpenShareModal,
  onOpenFirebaseModal,
  isFirebaseConnected = false,
  isFirebaseAutoSync = true,
  onToggleFirebaseAutoSync,
  isGoogleDriveAutoSync = false,
  onToggleGoogleDriveSync,
  onSelectBestPreset,
  isLocalMode = false,
  onOpenLocalModal,
  onOpenDevOpsModal,
  isGitHubConnected = false,
  isVercelConnected = false,
}) => {
  const [isCloudMenuOpen, setIsCloudMenuOpen] = useState(false);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const cloudMenuRef = useRef<HTMLDivElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cloudMenuRef.current && !cloudMenuRef.current.contains(event.target as Node)) {
        setIsCloudMenuOpen(false);
      }
      if (viewMenuRef.current && !viewMenuRef.current.contains(event.target as Node)) {
        setIsViewMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems: { view: ActiveView; label: string; shortLabel: string; icon: React.ElementType; badge?: number }[] = [
    { view: 'tracker', label: 'Excel Tracker', shortLabel: 'Tracker', icon: Table },
    { view: 'dashboard', label: 'Dashboard', shortLabel: 'Dashboard', icon: LayoutDashboard },
    { view: 'all_metrics', label: 'All Metrics Hub', shortLabel: 'Metrics', icon: BarChart3 },
    { view: 'warning_center', label: 'SLA Warning Center', shortLabel: 'SLA Alert', icon: ShieldAlert, badge: criticalWarningCount },
    { view: 'attendance', label: 'Staff Site GPS', shortLabel: 'Site GPS', icon: MapPin },
    { view: 'deck', label: 'Presentation Deck', shortLabel: 'Deck', icon: Presentation },
  ];

  const currentNav = navItems.find((item) => item.view === activeView) || navItems[0];
  const CurrentNavIcon = currentNav.icon;

  return (
    <header className="no-print h-14 w-full bg-slate-950 border-b border-slate-800 px-3 md:px-5 flex items-center justify-between gap-2 shrink-0 z-40 relative">
      {/* Zone 1: Wordmark Logo */}
      <div className="flex items-center gap-2.5 shrink-0">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onChangeView('tracker');
          }}
          className="text-sm sm:text-base font-extrabold tracking-tight text-white hover:text-sky-300 transition-colors whitespace-nowrap flex items-center gap-1.5"
        >
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-black tracking-wider uppercase">
            GEM PRO
          </span>
          <span className="hidden sm:inline font-bold text-slate-100">Generic Tracker</span>
        </a>
      </div>

      {/* Zone 2: Navigation Controls */}
      {/* 2A: Desktop Nav (visible on xl and wider) */}
      <nav className="hidden xl:flex items-center gap-0.5 bg-slate-900/90 p-1 rounded-lg border border-slate-800 shrink-0">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.view;
          return (
            <button
              key={item.view}
              type="button"
              onClick={() => onChangeView(item.view)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title={item.label}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{item.shortLabel}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 2B: Compact View Selector (for screens below xl) */}
      <div className="flex xl:hidden items-center relative" ref={viewMenuRef}>
        <button
          type="button"
          onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
          className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 border border-slate-800 text-slate-200 flex items-center gap-1.5 hover:bg-slate-850 hover:border-slate-700 transition-colors"
        >
          <CurrentNavIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="font-semibold">{currentNav.shortLabel}</span>
          {currentNav.badge !== undefined && currentNav.badge > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-bold">
              {currentNav.badge}
            </span>
          )}
          <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isViewMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {isViewMenuOpen && (
          <div className="absolute top-full left-0 mt-1.5 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              Select Workspace View
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.view;
              return (
                <button
                  key={item.view}
                  type="button"
                  onClick={() => {
                    onChangeView(item.view);
                    setIsViewMenuOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center justify-between gap-2 hover:bg-slate-800 transition-colors ${
                    isActive ? 'text-indigo-400 bg-slate-800/60 font-bold' : 'text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Zone 3: Actions + Cloud & Sync Hub + User Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* 1. Global Save Changes Button (Compact & Highly Visible) */}
        {onSaveChanges && (
          <button
            type="button"
            onClick={onSaveChanges}
            disabled={isSaving}
            className={`px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
              hasUnsavedChanges
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 ring-2 ring-emerald-400/40 animate-pulse'
                : 'bg-slate-900 hover:bg-slate-850 text-slate-200 border-slate-800'
            }`}
            title={`Save changes (Ctrl+S / Cmd+S)${
              lastSavedTime ? ` · Last saved at ${lastSavedTime}` : ''
            }`}
          >
            {isSaving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-300 shrink-0" />
            ) : hasUnsavedChanges ? (
              <Save className="w-3.5 h-3.5 text-white shrink-0" />
            ) : (
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            )}
            <span>{isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save' : 'Saved'}</span>
            {hasUnsavedChanges && unsavedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-white text-[10px] font-mono font-bold">
                {unsavedCount}
              </span>
            )}
          </button>
        )}

        {/* Consolidated Backup Dropdown Trigger */}
        <div className="relative" ref={cloudMenuRef}>
          <button
            type="button"
            onClick={() => setIsCloudMenuOpen(!isCloudMenuOpen)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
              isCloudMenuOpen
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-950'
                : isLocalMode
                  ? 'bg-amber-500 hover:bg-amber-400 border-amber-400 text-black'
                  : 'bg-slate-900 hover:bg-slate-850 border-slate-700 text-slate-200 hover:text-white'
            }`}
            title="Backup & Restore (Google Drive & Local File Backup)"
          >
            <HardDrive className={`w-3.5 h-3.5 shrink-0 ${isCloudMenuOpen ? 'text-white' : isLocalMode ? 'text-black' : 'text-sky-400'}`} />
            <span className="font-extrabold tracking-tight">
              {isLocalMode ? 'Local Backup Mode' : 'Backup'}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${
              isCloudMenuOpen ? 'rotate-180 text-white' : isLocalMode ? 'text-black' : 'text-slate-400'
            }`} />
          </button>

          {/* Clean Backup-Only Dropdown Panel */}
          {isCloudMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-80 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-3.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-slate-100">
              {/* Header */}
              <div className="px-1 py-1 text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
                <div className="flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-sky-400" />
                  <span>Backup &amp; Restore</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  Supabase · Drive · Local
                </span>
              </div>

              <div className="space-y-2">
                {/* 1. Supabase Backup & Auto JPEG/JPG/PDF File Storage */}
                {onOpenSupabaseModal && (
                  <div
                    onClick={() => {
                      setIsCloudMenuOpen(false);
                      onOpenSupabaseModal();
                    }}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                      isSupabaseConnected
                        ? 'bg-emerald-950/30 border-emerald-600/60'
                        : 'bg-slate-950/60 border-slate-800 hover:border-emerald-700/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 flex-1">
                        <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 shrink-0 mt-0.5">
                          <Database className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-white">Supabase Backup &amp; Files</span>
                            {isSupabaseConnected && (
                              <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                CONNECTED
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                            Push/Pull backup files &amp; auto-save uploaded JPEG, JPG &amp; PDFs
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsCloudMenuOpen(false);
                          onOpenSupabaseModal();
                        }}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shrink-0"
                      >
                        {isSupabaseConnected ? 'Open' : 'Connect'}
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. Google Drive Backup */}
                <div className={`p-2.5 rounded-xl border transition-all ${
                  isGoogleDriveAutoSync
                    ? 'bg-sky-950/30 border-sky-600/60'
                    : 'bg-slate-950/60 border-slate-800 hover:border-sky-700/60'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div
                      onClick={() => {
                        setIsCloudMenuOpen(false);
                        onOpenBackupModal();
                      }}
                      className="flex items-start gap-2.5 flex-1 cursor-pointer select-none"
                    >
                      <div className="p-2 rounded-lg bg-sky-500/15 text-sky-400 shrink-0 mt-0.5">
                        <HardDrive className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white">Google Drive Backup</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                          Save snapshots &amp; restore backups from Google Drive
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onToggleGoogleDriveSync && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleGoogleDriveSync(!isGoogleDriveAutoSync);
                          }}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95 ${
                            isGoogleDriveAutoSync
                              ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 ring-2 ring-sky-400/40'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                          }`}
                          title={isGoogleDriveAutoSync ? 'Turn Auto Backup OFF' : 'Turn Auto Backup ON'}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isGoogleDriveAutoSync ? 'bg-slate-950 animate-pulse' : 'bg-slate-500'}`} />
                          <span>{isGoogleDriveAutoSync ? 'ON' : 'OFF'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setIsCloudMenuOpen(false);
                          onOpenBackupModal();
                        }}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                        title="Open Google Drive Backup & Restore"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Local File Backup & Restore */}
                {onOpenLocalModal && (
                  <div
                    onClick={() => {
                      setIsCloudMenuOpen(false);
                      onOpenLocalModal();
                    }}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                      isLocalMode
                        ? 'bg-amber-950/30 border-amber-500/70'
                        : 'bg-slate-950/60 border-slate-800 hover:border-indigo-600/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 flex-1">
                        <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                          isLocalMode ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-500/15 text-indigo-400'
                        }`}>
                          <Save className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-white">Local File Backup</span>
                            {isLocalMode && (
                              <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500 text-black">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                            Export JSON backup, load backup file, or save offline HTML
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsCloudMenuOpen(false);
                          onOpenLocalModal();
                        }}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer shrink-0"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* PWA Local App Install Button */}
        <PWAInstallButton />

        {/* 3. Global Search */}
        <button
          type="button"
          onClick={onOpenGlobalSearch}
          className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title="Search in current or all trackers (Ctrl+F)"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* 4. Appearance Theme Switcher */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title={isDarkMode ? 'Switch to Light Theme' : 'Switch to Midnight Theme'}
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
        </button>

        {/* 5. Admin Approvals Alert (if any pending registrations) */}
        {(currentUser.role === 'admin' || currentUser.role === 'creator') && pendingRegistrationsCount > 0 && (
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="px-2 py-1 rounded-lg bg-amber-950/80 border border-amber-800 text-amber-300 text-xs font-semibold flex items-center gap-1 hover:bg-amber-900 transition-colors animate-pulse"
            title={`${pendingRegistrationsCount} accounts awaiting Admin approval`}
          >
            <UserPlus className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="hidden md:inline">Approvals</span>
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-black">
              {pendingRegistrationsCount}
            </span>
          </button>
        )}

        {/* 6. User Account Card */}
        <button
          type="button"
          onClick={onOpenAuthModal}
          className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs transition-colors shrink-0"
          title="Manage Account, Switch Persona, or View Approvals"
        >
          <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-[11px] text-white shrink-0">
            {currentUser.name.charAt(0)}
          </div>
          <div className="text-left hidden lg:block max-w-[85px] truncate leading-tight">
            <div className="font-semibold text-white leading-none truncate text-[11px]">
              {currentUser.name}
            </div>
            <div className="text-[9px] text-sky-400 font-mono uppercase mt-0.5 leading-none">
              {currentUser.role}
            </div>
          </div>
        </button>

        {/* 7. Sign Out */}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
            title="Sign Out / Return to Landing Page"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
