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
  Server,
  Database,
  Check,
  RefreshCw,
  Cloud,
  ChevronDown,
  Users,
  Share2,
  Star,
  Sparkles,
  Sliders,
  Power,
  Save,
  Laptop,
  Github,
  Rocket,
  GitBranch,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { getGitHubConfig } from '../utils/githubClient';

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
            title={`Save changes to Local Storage, Real-Time Server, and Supabase (Ctrl+S / Cmd+S)${
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

        {/* Consolidated Sync & Cloud Hub Dropdown Trigger */}
        <div className="relative" ref={cloudMenuRef}>
          <button
            type="button"
            onClick={() => setIsCloudMenuOpen(!isCloudMenuOpen)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
              isCloudMenuOpen
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-950'
                : 'bg-slate-900 hover:bg-slate-850 border-slate-700 text-slate-200 hover:text-white'
            }`}
            title="Sync, Share & Cloud Hub: Share Link, Google Drive, Git ➔ Vercel, Firebase & Cloudflare"
          >
            <div className="flex items-center gap-1.5">
              <Cloud className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="font-extrabold tracking-tight">Sync &amp; Cloud Hub</span>
            </div>

            {/* Live Status Indicators */}
            <div className="flex items-center gap-1.5 pl-1.5 border-l border-slate-700/60">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" title="Live Sync Active" />
              {onlineUsersCount && onlineUsersCount > 1 ? (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {onlineUsersCount} Live
                </span>
              ) : (
                <span className="text-[10px] text-emerald-400 font-semibold font-mono hidden sm:inline">
                  Free
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${isCloudMenuOpen ? 'rotate-180 text-white' : ''}`} />
            </div>
          </button>

          {/* Cloud & Sync Dropdown Panel with 1-Click Launchers & All Integrations */}
          {isCloudMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-80 sm:w-96 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-3.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-slate-100 max-h-[85vh] overflow-y-auto">
              {/* Header */}
              <div className="px-1 py-1 text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
                <div className="flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-indigo-400" />
                  <span>Sync, Share &amp; Cloud Hub</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {([isFirebaseAutoSync, isServerSyncEnabled, isCloudflareAutoSync, isSupabaseAutoSync, isGoogleDriveAutoSync].filter(Boolean).length)} ON / {([!isFirebaseAutoSync, !isServerSyncEnabled, !isCloudflareAutoSync, !isSupabaseAutoSync, !isGoogleDriveAutoSync].filter(Boolean).length)} OFF
                </span>
              </div>

              {/* 1-Click Quick Action Launchers (Share Link, Google Drive, Git ➔ Vercel) */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCloudMenuOpen(false);
                    if (onOpenShareModal) onOpenShareModal();
                    else if (onOpenServerModal) onOpenServerModal();
                  }}
                  className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-950 to-indigo-900 hover:from-indigo-900 hover:to-indigo-800 border border-indigo-600/70 text-left transition-all group cursor-pointer shadow-xs flex flex-col justify-between"
                  title="Share with Co-workers: Free live collaboration link"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Share2 className="w-4 h-4 text-indigo-300 group-hover:scale-110 transition-transform" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <span className="text-[11px] font-bold text-white leading-tight block">
                    Share Link
                  </span>
                  <span className="text-[9px] text-indigo-300 font-mono mt-0.5">
                    {onlineUsersCount && onlineUsersCount > 1 ? `${onlineUsersCount} Online` : 'Free Live'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsCloudMenuOpen(false);
                    onOpenBackupModal();
                  }}
                  className="p-2.5 rounded-xl bg-gradient-to-br from-sky-950 to-sky-900 hover:from-sky-900 hover:to-sky-800 border border-sky-600/70 text-left transition-all group cursor-pointer shadow-xs flex flex-col justify-between"
                  title="Google Drive: Cloud archive & restore"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <HardDrive className="w-4 h-4 text-sky-300 group-hover:scale-110 transition-transform" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </div>
                  <span className="text-[11px] font-bold text-white leading-tight block">
                    Google Drive
                  </span>
                  <span className="text-[9px] text-sky-300 font-mono mt-0.5">
                    1 Month Active
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsCloudMenuOpen(false);
                    onOpenDevOpsModal?.('pipeline');
                  }}
                  className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-950 to-teal-900 hover:from-emerald-900 hover:to-teal-800 border border-emerald-600/70 text-left transition-all group cursor-pointer shadow-xs flex flex-col justify-between"
                  title="Git ➔ Vercel: Auto-update CI/CD deployment pipeline"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Rocket className="w-4 h-4 text-emerald-300 group-hover:scale-110 transition-transform" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </div>
                  <span className="text-[11px] font-bold text-white leading-tight block">
                    Git ➔ Vercel
                  </span>
                  <span className="text-[9px] text-emerald-300 font-mono mt-0.5">
                    Auto CI/CD
                  </span>
                </button>
              </div>

              {/* Best Recommendation & Conflict Resolver Banner */}
              <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-950/90 via-slate-900 to-amber-950/40 border border-amber-500/40 mb-3 space-y-2 shadow-inner">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 font-black text-amber-300 text-xs">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                    <span>WHAT IS THE BEST CHOICE?</span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Recommended
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  <strong className="text-white font-bold">Firebase Firestore</strong> is the best real-time cloud database (100% free with 50,000 reads/day) for multi-account collaboration. Turn <strong className="text-rose-300">OFF</strong> unused backends to eliminate clashing or rumbling.
                </p>
                {onSelectBestPreset && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectBestPreset();
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 hover:from-amber-400 hover:to-emerald-300 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer active:scale-98"
                    title="Automatically turns Firebase Firestore ON and disables clashing secondary databases"
                  >
                    <Sparkles className="w-4 h-4 text-slate-950 shrink-0" />
                    <span>Use Best Setup (Firebase ON · Others OFF)</span>
                  </button>
                )}
              </div>

              {/* List of Integrations with ON/OFF Switches */}
              <div className="space-y-2">
                {/* 1. Firebase Firestore - Highlighted as Best */}
                <div className={`p-2.5 rounded-xl border transition-all ${
                  isFirebaseAutoSync
                    ? 'bg-amber-950/30 border-amber-500/70 shadow-xs'
                    : 'bg-slate-950/50 border-slate-800 opacity-70'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div
                      onClick={onOpenFirebaseModal}
                      className="flex items-start gap-2.5 flex-1 cursor-pointer select-none"
                    >
                      <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                        <Database className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white">Firebase Firestore</span>
                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-amber-400" />
                            BEST / RECOMMENDED
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                          NoSQL Cloud DB · 50k free reads/day · Real-time team sync
                        </p>
                      </div>
                    </div>

                    {/* Dedicated ON/OFF Switch */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFirebaseAutoSync?.(!isFirebaseAutoSync);
                        }}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95 ${
                          isFirebaseAutoSync
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 ring-2 ring-emerald-400/40'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                        }`}
                        title={isFirebaseAutoSync ? 'Turn Firebase OFF' : 'Turn Firebase ON'}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isFirebaseAutoSync ? 'bg-slate-950 animate-pulse' : 'bg-slate-500'}`} />
                        <span>{isFirebaseAutoSync ? 'ON' : 'OFF'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={onOpenFirebaseModal}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                        title="Configure Firebase Settings"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Live Team Database (Server WebSockets) */}
                <div className={`p-2.5 rounded-xl border transition-all ${
                  isServerSyncEnabled
                    ? 'bg-emerald-950/25 border-emerald-700/60'
                    : 'bg-slate-950/50 border-slate-800 opacity-70'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div
                      onClick={onOpenServerModal}
                      className="flex items-start gap-2.5 flex-1 cursor-pointer select-none"
                    >
                      <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                        <Server className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white">Live Team Database</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Built-in Free
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                          Node.js WebSocket relay · Instant team presence &amp; sharing
                        </p>
                      </div>
                    </div>

                    {/* Dedicated ON/OFF Switch */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleServerSync?.(!isServerSyncEnabled);
                        }}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95 ${
                          isServerSyncEnabled
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 ring-2 ring-emerald-400/40'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                        }`}
                        title={isServerSyncEnabled ? 'Turn Live Team Server OFF' : 'Turn Live Team Server ON'}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isServerSyncEnabled ? 'bg-slate-950 animate-pulse' : 'bg-slate-500'}`} />
                        <span>{isServerSyncEnabled ? 'ON' : 'OFF'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={onOpenServerModal}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                        title="Configure Live Server Settings"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Cloudflare Edge DB (Optional) */}
                <div className={`p-2.5 rounded-xl border transition-all ${
                  isCloudflareAutoSync
                    ? 'bg-orange-950/25 border-orange-700/60'
                    : 'bg-slate-950/50 border-slate-800 opacity-70'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div
                      onClick={onOpenCloudflareModal}
                      className="flex items-start gap-2.5 flex-1 cursor-pointer select-none"
                    >
                      <div className="p-2 rounded-lg bg-orange-500/15 text-orange-400 shrink-0 mt-0.5">
                        <Cloud className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white">Cloudflare Edge DB</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                            Optional Backup
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                          Edge worker persistence · (Keep OFF if using Firebase)
                        </p>
                      </div>
                    </div>

                    {/* Dedicated ON/OFF Switch */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleCloudflareAutoSync?.(!isCloudflareAutoSync);
                        }}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95 ${
                          isCloudflareAutoSync
                            ? 'bg-orange-500 hover:bg-orange-400 text-slate-950 ring-2 ring-orange-400/40'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                        }`}
                        title={isCloudflareAutoSync ? 'Turn Cloudflare OFF' : 'Turn Cloudflare ON'}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isCloudflareAutoSync ? 'bg-slate-950 animate-pulse' : 'bg-slate-500'}`} />
                        <span>{isCloudflareAutoSync ? 'ON' : 'OFF'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={onOpenCloudflareModal}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                        title="Configure Cloudflare Settings"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 4. Supabase PostgreSQL (Optional) */}
                <div className={`p-2.5 rounded-xl border transition-all ${
                  isSupabaseAutoSync
                    ? 'bg-emerald-950/25 border-emerald-600/60'
                    : 'bg-slate-950/50 border-slate-800 opacity-70'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div
                      onClick={onOpenSupabaseModal}
                      className="flex items-start gap-2.5 flex-1 cursor-pointer select-none"
                    >
                      <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 shrink-0 mt-0.5">
                        <Database className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white">Supabase PostgreSQL</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Optional SQL
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                          External Postgres database · (Keep OFF if using Firebase)
                        </p>
                      </div>
                    </div>

                    {/* Dedicated ON/OFF Switch */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSupabaseAutoSync?.(!isSupabaseAutoSync);
                        }}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95 ${
                          isSupabaseAutoSync
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 ring-2 ring-emerald-400/40'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                        }`}
                        title={isSupabaseAutoSync ? 'Turn Supabase OFF' : 'Turn Supabase ON'}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isSupabaseAutoSync ? 'bg-slate-950 animate-pulse' : 'bg-slate-500'}`} />
                        <span>{isSupabaseAutoSync ? 'ON' : 'OFF'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={onOpenSupabaseModal}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                        title="Configure Supabase Settings"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 5. Google Drive Backup */}
                <div className={`p-2.5 rounded-xl border transition-all ${
                  isGoogleDriveAutoSync
                    ? 'bg-sky-950/30 border-sky-600/60'
                    : 'bg-slate-950/50 border-slate-800 opacity-70'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div
                      onClick={onOpenBackupModal}
                      className="flex items-start gap-2.5 flex-1 cursor-pointer select-none"
                    >
                      <div className="p-2 rounded-lg bg-sky-500/15 text-sky-400 shrink-0 mt-0.5">
                        <HardDrive className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white">Google Drive Backup</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                            Cloud Archive
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                          Save snapshots &amp; restore backups to Google Drive
                        </p>
                      </div>
                    </div>

                    {/* Dedicated ON/OFF Switch */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleGoogleDriveSync?.(!isGoogleDriveAutoSync);
                        }}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95 ${
                          isGoogleDriveAutoSync
                            ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 ring-2 ring-sky-400/40'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                        }`}
                        title={isGoogleDriveAutoSync ? 'Turn Google Drive Auto Backup OFF' : 'Turn Google Drive Auto Backup ON'}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isGoogleDriveAutoSync ? 'bg-slate-950 animate-pulse' : 'bg-slate-500'}`} />
                        <span>{isGoogleDriveAutoSync ? 'ON' : 'OFF'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={onOpenBackupModal}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                        title="Open Google Drive Modal"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 6. Git ➔ Vercel Auto CI/CD Pipeline */}
                <div className="p-2.5 rounded-xl border border-emerald-700/60 bg-emerald-950/25 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      onClick={() => {
                        setIsCloudMenuOpen(false);
                        onOpenDevOpsModal?.('pipeline');
                      }}
                      className="flex items-start gap-2.5 flex-1 cursor-pointer select-none"
                    >
                      <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                        <Rocket className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white">Git ➔ Vercel Pipeline</span>
                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            AUTO CI/CD
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                          Push commits to GitHub and auto-trigger live Vercel deployments
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsCloudMenuOpen(false);
                        onOpenDevOpsModal?.('pipeline');
                      }}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors cursor-pointer"
                    >
                      Pipeline
                    </button>
                  </div>
                </div>

                {/* 7. GitHub Connected & Versioned Commits */}
                {(() => {
                  const gh = getGitHubConfig();
                  const isConnected = Boolean(gh.token && gh.connectedUser);
                  return (
                    <div className={`p-2.5 rounded-xl border transition-all ${
                      isConnected
                        ? 'border-emerald-700/60 bg-emerald-950/20'
                        : 'border-indigo-700/60 bg-indigo-950/25'
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div
                          onClick={() => {
                            setIsCloudMenuOpen(false);
                            onOpenDevOpsModal?.('github');
                          }}
                          className="flex items-start gap-2.5 flex-1 cursor-pointer select-none"
                        >
                          <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                            isConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'
                          }`}>
                            <Github className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-white">GitHub Connected</span>
                              {isConnected ? (
                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  @{gh.connectedUser}
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                                  Ready to Connect
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                              {isConnected
                                ? `Active: commits to ${gh.repoOwner || gh.connectedUser}/${gh.repoName || 'tracker'}@${gh.branch || 'main'}`
                                : '1-click connect to GitHub with OAuth or Personal Access Token'}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setIsCloudMenuOpen(false);
                            onOpenDevOpsModal?.('github');
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                            isConnected
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                          }`}
                        >
                          {isConnected ? 'Manage' : 'Connect'}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* 7. Vercel Cloud Deployment */}
                <div className="p-2.5 rounded-xl border border-sky-700/60 bg-sky-950/25 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      onClick={() => {
                        setIsCloudMenuOpen(false);
                        onOpenDevOpsModal?.('vercel');
                      }}
                      className="flex items-start gap-2.5 flex-1 cursor-pointer select-none"
                    >
                      <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 shrink-0 mt-0.5">
                        <Rocket className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white">Vercel Deploy</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40">
                            1-Click Deploy
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                          Global edge SPA hosting with zero-config vercel.json routing
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsCloudMenuOpen(false);
                        onOpenDevOpsModal?.('vercel');
                      }}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white hover:bg-slate-200 text-slate-950 transition-colors cursor-pointer"
                    >
                      Deploy
                    </button>
                  </div>
                </div>

                {/* 8. Cloudflare Free Sharing for Data */}
                <div className="p-2.5 rounded-xl border border-orange-500/60 bg-orange-950/30 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      onClick={() => {
                        setIsCloudMenuOpen(false);
                        onOpenDevOpsModal?.('cloudflare');
                      }}
                      className="flex items-start gap-2.5 flex-1 cursor-pointer select-none"
                    >
                      <div className="p-2 rounded-lg bg-orange-500/20 text-orange-400 shrink-0 mt-0.5">
                        <Cloud className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white">Cloudflare Free Sharing</span>
                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/40">
                            100% FREE
                          </span>
                        </div>
                        <p className="text-[11px] text-orange-200/90 mt-0.5 leading-snug">
                          Free team data sharing &amp; Worker Edge KV (100k requests/day free)
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsCloudMenuOpen(false);
                        onOpenDevOpsModal?.('cloudflare');
                      }}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-orange-500 hover:bg-orange-400 text-slate-950 transition-colors cursor-pointer"
                    >
                      Share
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PWA Local App Install Button */}
        <PWAInstallButton />

        {/* Local Offline Version / Backup Viewer Button */}
        {onOpenLocalModal && (
          <button
            type="button"
            onClick={onOpenLocalModal}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs ${
              isLocalMode
                ? 'bg-amber-500 hover:bg-amber-400 text-black ring-2 ring-amber-400/50'
                : 'bg-slate-900 hover:bg-slate-850 border border-slate-800 text-sky-300 hover:text-white'
            }`}
            title="Open Local Version & Offline Backup Viewer"
          >
            <HardDrive className={`w-3.5 h-3.5 ${isLocalMode ? 'text-black' : 'text-sky-400'}`} />
            <span className="hidden sm:inline">{isLocalMode ? 'Local Mode' : 'Local / Backup'}</span>
            {isLocalMode && (
              <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
            )}
          </button>
        )}

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
