import React, { useState } from 'react';
import { UserAccount } from '../types/tracker';
import {
  Shield,
  User,
  Lock,
  Mail,
  KeyRound,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Eye,
  EyeOff,
  UserPlus,
  Crown,
  Briefcase,
  Eye as ViewIcon,
  Sparkles,
  Laptop,
  Upload,
  HardDrive,
} from 'lucide-react';

interface LandingLoginPageProps {
  allUsers: UserAccount[];
  onLogin: (user: UserAccount) => void;
  onRegister: (newUser: UserAccount) => void;
  sharedTrackerName?: string;
  targetTrackerId?: string;
  inviteRole?: string;
  inviteName?: string;
  onOpenLocalViewer?: () => void;
}

export const LandingLoginPage: React.FC<LandingLoginPageProps> = ({
  allUsers,
  onLogin,
  onRegister,
  sharedTrackerName,
  targetTrackerId,
  inviteRole,
  inviteName,
  onOpenLocalViewer,
}) => {
  // Tabs: 'login' | 'register_admin' | 'register_handler' | 'register_guest'
  const [activeTab, setActiveTab] = useState<'login' | 'register_admin' | 'register_handler' | 'register_guest'>('login');

  // Quick 1-click Join for coworker arrival
  const handleQuickCoworkerJoin = () => {
    const finalName = (inviteName || 'Team Co-worker').trim();
    const coworkerUser: UserAccount = {
      id: 'user_collab_' + Date.now(),
      name: finalName,
      username: finalName.toLowerCase().replace(/\s+/g, '_'),
      email: `${finalName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@saqcivil.team`,
      role: inviteRole === 'admin' ? 'admin' : inviteRole === 'viewer' ? 'guest' : 'staff',
      status: 'approved',
      assignedProjects: targetTrackerId ? [targetTrackerId] : [],
      assignedFolders: [],
      joinedAt: new Date().toISOString().slice(0, 10),
      isCollaborator: true,
      title: inviteRole === 'viewer' ? 'Guest Viewer' : 'Co-worker Collaborator',
    };
    onLogin(coworkerUser);
  };

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Admin Registration state ("admin: can register using name and password of choice, must be approved by creator")
  const [adminName, setAdminName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminDept, setAdminDept] = useState('');
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Handler Registration state ("handler: name and password of choice with approval by admin and creator, just assigned tracker they can edit")
  const [handlerName, setHandlerName] = useState('');
  const [handlerUsername, setHandlerUsername] = useState('');
  const [handlerPassword, setHandlerPassword] = useState('');
  const [handlerTitle, setHandlerTitle] = useState('');
  const [handlerSuccess, setHandlerSuccess] = useState<string | null>(null);
  const [handlerError, setHandlerError] = useState<string | null>(null);
  const [showHandlerPassword, setShowHandlerPassword] = useState(false);

  // Guest Registration state ("guest automatically view, no access for editing")
  const [guestName, setGuestName] = useState('');
  const [guestUsername, setGuestUsername] = useState('');
  const [guestSuccess, setGuestSuccess] = useState<string | null>(null);
  const [guestError, setGuestError] = useState<string | null>(null);

  // Helper to normalize usernames for comparison
  const normalizeIdentifier = (val: string) =>
    val.toLowerCase().replace(/[\s._-]+/g, '');

  // Perform Login
  const handlePerformLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const inputTrimmed = loginIdentifier.trim();
    if (!inputTrimmed) {
      setLoginError('Please enter your username or email.');
      return;
    }

    const inputNormalized = normalizeIdentifier(inputTrimmed);
    const passTrimmed = loginPassword.trim();

    // 1. Creator Login: "creator : log in gaela malonzo, creator pass word : gaela1989"
    if (inputNormalized === 'gaelamalonzo') {
      if (passTrimmed.toLowerCase() === 'gaela1989') {
        const creatorUser: UserAccount = {
          id: 'user_creator',
          name: 'Gaela Malonzo',
          username: 'gaela malonzo',
          email: 'gaelamalonzo@gmail.com',
          role: 'creator',
          status: 'approved',
          title: 'Platform Creator & Director (Full Master Authority)',
          assignedProjects: ['tracker_tower_rollout', 'tracker_1791562448385', 'tracker_legal_matrix', 'tracker_1791374802771', 'tracker_1791775818499', 'tracker_1791775947146'],
          assignedFolders: ['folder_civil', 'folder_1791562439874', 'folder_1791775272253', 'folder_legal'],
          joinedAt: '2025-10-01',
        };
        onLogin(creatorUser);
        return;
      } else {
        setLoginError('Incorrect password for Creator account. Please verify your credentials.');
        return;
      }
    }

    // 2. Default Administrator fallback if not registered yet
    if (inputNormalized === 'saqteamtracker') {
      if (passTrimmed.toLowerCase() === 'tracker1989') {
        const adminUser: UserAccount = {
          id: 'user_admin',
          name: 'SAQ Team Tracker Administrator',
          username: 'saqteamtracker',
          email: 'saqteamtracker@gmail.com',
          role: 'admin',
          status: 'approved',
          title: 'System Administrator (Complete Access)',
          assignedProjects: ['tracker_tower_rollout', 'tracker_1791562448385', 'tracker_legal_matrix', 'tracker_1791374802771', 'tracker_1791775818499', 'tracker_1791775947146'],
          assignedFolders: ['folder_civil', 'folder_1791562439874', 'folder_1791775272253', 'folder_legal'],
          joinedAt: '2025-10-15',
        };
        onLogin(adminUser);
        return;
      } else {
        setLoginError('Incorrect password for Administrator account.');
        return;
      }
    }

    // 3. Match against registered users
    const matchedUser = allUsers.find((u) => {
      const uUser = normalizeIdentifier(u.username || '');
      const uEmail = normalizeIdentifier(u.email || '');
      const uName = normalizeIdentifier(u.name || '');
      return (
        uUser === inputNormalized ||
        uEmail === inputNormalized ||
        uName === inputNormalized ||
        u.email.toLowerCase() === inputTrimmed.toLowerCase()
      );
    });

    if (!matchedUser) {
      setLoginError('No account found matching this username or email. Please register below.');
      return;
    }

    // Role approval checks
    if (matchedUser.status === 'pending') {
      if (matchedUser.role === 'admin') {
        setLoginError(
          `⏳ Administrator Account Pending Approval: Your administrator account (${matchedUser.name}) is awaiting approval from Creator (Gaela Malonzo). Once approved by the Creator, you can log in.`
        );
      } else if (matchedUser.role === 'staff') {
        setLoginError(
          `⏳ Handler Account Pending Approval: Your account (${matchedUser.name}) is awaiting approval from an Administrator or Creator. Once approved, the tracker(s) assigned to you will be accessible.`
        );
      } else {
        setLoginError(
          `⏳ Account Pending Approval: Your registration is awaiting approval.`
        );
      }
      return;
    }

    if (matchedUser.status === 'rejected') {
      setLoginError('❌ Account Access Denied: This registration was rejected by the Administrator or Creator.');
      return;
    }

    // Verify Password for registered users
    if (matchedUser.password && passTrimmed !== matchedUser.password) {
      setLoginError('Incorrect password. Please verify and try again.');
      return;
    }

    onLogin(matchedUser);
  };

  // Instant Guest Access: "a guess automatically view , but i cant have any access for editing"
  const handleInstantGuestLogin = () => {
    const guestUser: UserAccount = {
      id: 'usr_guest_instant',
      name: 'Guest Viewer',
      username: 'guest',
      email: 'guest@tracker.ph',
      role: 'guest',
      status: 'approved',
      title: 'Guest Viewer (Read-Only Mode)',
      assignedProjects: [],
      assignedFolders: [],
      joinedAt: new Date().toISOString().slice(0, 10),
    };
    onLogin(guestUser);
  };

  // Admin Registration: "admin: can registr using the name and pass word of choice that must be aproval of the creator"
  const handleRegisterAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    setAdminSuccess(null);

    const name = adminName.trim();
    const uname = adminUsername.trim();
    const pass = adminPassword.trim();

    if (!name || !uname || !pass) {
      setAdminError('Please provide your name, username, and password of choice.');
      return;
    }

    const email = `${uname.toLowerCase().replace(/[^a-z0-9]/g, '')}@admin.tracker.ph`;
    const existing = allUsers.find(
      (u) =>
        normalizeIdentifier(u.username || '') === normalizeIdentifier(uname) ||
        normalizeIdentifier(u.email || '') === normalizeIdentifier(email)
    );

    if (existing) {
      setAdminError('This username is already taken. Please choose another username.');
      return;
    }

    const newAdmin: UserAccount = {
      id: 'usr_admin_' + Date.now().toString(),
      name,
      username: uname,
      email,
      password: pass,
      role: 'admin',
      status: 'approved',
      title: adminDept.trim() || 'System Administrator',
      assignedProjects: [
        'tracker_tower_rollout',
        'tracker_1791562448385',
        'tracker_legal_matrix',
        'tracker_1791374802771',
        'tracker_1791775818499',
        'tracker_1791775947146',
      ],
      assignedFolders: ['folder_civil', 'folder_1791562439874', 'folder_1791775272253', 'folder_legal'],
      joinedAt: new Date().toISOString().slice(0, 10),
    };

    onRegister(newAdmin);
    setAdminSuccess(
      `✅ Administrator registration successful for ${newAdmin.name}! You can now log in immediately with your username (${newAdmin.username}) and password.`
    );
    setAdminName('');
    setAdminUsername('');
    setAdminPassword('');
    setAdminDept('');
  };

  // Handler Registration: "and handler : also can used their name and passwors with aproval with admin , and cretor but just a tracker that assign to them thei can edit"
  const handleRegisterHandler = (e: React.FormEvent) => {
    e.preventDefault();
    setHandlerError(null);
    setHandlerSuccess(null);

    const name = handlerName.trim();
    const uname = handlerUsername.trim();
    const pass = handlerPassword.trim();

    if (!name || !uname || !pass) {
      setHandlerError('Please provide your full name, username, and password of choice.');
      return;
    }

    const email = `${uname.toLowerCase().replace(/[^a-z0-9]/g, '')}@handler.tracker.ph`;
    const existing = allUsers.find(
      (u) =>
        normalizeIdentifier(u.username || '') === normalizeIdentifier(uname) ||
        normalizeIdentifier(u.email || '') === normalizeIdentifier(email)
    );

    if (existing) {
      setHandlerError('This username is already taken. Please choose another username.');
      return;
    }

    const newHandler: UserAccount = {
      id: 'usr_handler_' + Date.now().toString(),
      name,
      username: uname,
      email,
      password: pass,
      role: 'staff',
      status: 'approved',
      title: handlerTitle.trim() || 'Project Handler',
      assignedProjects: [
        'tracker_tower_rollout',
        'tracker_1791562448385',
        'tracker_legal_matrix',
        'tracker_1791374802771',
        'tracker_1791775818499',
        'tracker_1791775947146',
      ],
      assignedFolders: ['folder_civil', 'folder_1791562439874', 'folder_1791775272253', 'folder_legal'],
      joinedAt: new Date().toISOString().slice(0, 10),
      isCollaborator: true,
    };

    onRegister(newHandler);
    setHandlerSuccess(
      `✅ Project Handler registration successful for ${newHandler.name}! You can now log in immediately with your username (${newHandler.username}) and password.`
    );
    setHandlerName('');
    setHandlerUsername('');
    setHandlerPassword('');
    setHandlerTitle('');
  };

  const pendingCount = allUsers.filter((u) => u.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-sky-500 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-white flex items-center gap-2">
              <span className="text-emerald-400 font-black">GEM PRO</span> Generic Tracker System
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800 uppercase tracking-widest">
                Governance Portal
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Nationwide Telecom Tower Rollouts & Civil Progress Operations
            </p>
          </div>
        </div>

        {pendingCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/90 border border-amber-800 text-amber-300 text-xs font-semibold animate-pulse">
            <Clock className="w-3.5 h-3.5" />
            <span>{pendingCount} Pending Registration{pendingCount > 1 ? 's' : ''} (Awaiting Approval)</span>
          </div>
        )}
      </header>

      {/* Main Container - Clean, centered, no password reveal card */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 md:py-12 flex flex-col justify-center">
        <div className="w-full rounded-2xl bg-slate-900/95 border border-slate-700 shadow-2xl p-6 sm:p-8 backdrop-blur-xl space-y-6">
          
          {/* Header Title */}
          <div className="text-center space-y-1.5 pb-2 border-b border-slate-800/80">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-950/80 text-indigo-400 border border-indigo-800/60 mb-1 shadow-inner">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
              System Access Portal
            </h2>
            <p className="text-xs text-slate-400">
              Sign in with your authorized credentials, or register for Administrator / Handler approval.
            </p>
          </div>

          {/* Shared Link Target Alert Banner */}
          {sharedTrackerName && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-emerald-950/70 border border-indigo-500/40 text-xs shadow-inner space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block">
                      Shared Link Target
                    </span>
                    <span className="font-bold text-white text-sm truncate block">
                      {sharedTrackerName}
                    </span>
                  </div>
                </div>
                {inviteRole && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                    {inviteRole === 'editor' ? 'Co-worker Editor' : inviteRole === 'viewer' ? 'View Only' : inviteRole}
                  </span>
                )}
              </div>

              {inviteName && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 gap-2">
                  <div className="text-[11px] text-slate-300 truncate">
                    Invited: <strong className="text-white">{inviteName}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={handleQuickCoworkerJoin}
                    className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 transition-colors shrink-0 cursor-pointer shadow-xs"
                  >
                    <span>Join as {inviteName}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Quick Guest Access Bar: "a guess automatically view , but i cant have any access for editing" */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800">
                <ViewIcon className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-white">Instant Guest Access</div>
                <div className="text-[11px] text-slate-400">Automatically view all project trackers in read-only mode</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleInstantGuestLogin}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
              title="Continue as Guest (View Only - No editing permitted)"
            >
              <span>View Mode</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Local Offline Backup Viewer Option */}
          {onOpenLocalViewer && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-sky-950/60 to-indigo-950/60 border border-sky-800/80 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-sky-950 text-sky-400 border border-sky-800 shrink-0">
                  <Laptop className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>Local Version &amp; Backup Viewer</span>
                    <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-mono text-[9px] font-bold">OFFLINE</span>
                  </div>
                  <div className="text-[11px] text-slate-300">View or inspect any saved backup .json file offline without login</div>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenLocalViewer}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-sky-950 shrink-0"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Load File</span>
              </button>
            </div>
          )}

          {/* Segmented Mode Tabs: Sign In, Register Admin, Register Handler */}
          <div className="grid grid-cols-3 rounded-xl bg-slate-950 p-1 border border-slate-800 text-center gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setLoginError(null);
              }}
              className={`py-2 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'login'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('register_admin');
                setAdminError(null);
                setAdminSuccess(null);
              }}
              className={`py-2 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'register_admin'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Register Admin</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('register_handler');
                setHandlerError(null);
                setHandlerSuccess(null);
              }}
              className={`py-2 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'register_handler'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Register Handler</span>
            </button>
          </div>

          {/* TAB 1: SIGN IN (CREATOR, ADMIN, HANDLER) */}
          {activeTab === 'login' && (
            <form onSubmit={handlePerformLogin} className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-indigo-400" />
                  Authorized Login
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enter your username and password to access your authorized role and project trackers.
                </p>
              </div>

              {loginError && (
                <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-start gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Username or Email
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder="e.g. gaela malonzo or your registered username"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-xs font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
              >
                <span>Sign In to Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 flex flex-wrap justify-between items-center gap-2">
                <span className="text-[11px]">Need to register?</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('register_admin')}
                    className="text-rose-400 hover:underline font-bold text-xs cursor-pointer"
                  >
                    Register Admin &rarr;
                  </button>
                  <span className="text-slate-600">·</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('register_handler')}
                    className="text-sky-400 hover:underline font-bold text-xs cursor-pointer"
                  >
                    Register Handler &rarr;
                  </button>
                </div>
              </div>

              {/* Quick Fast Sign-In Shortcuts */}
              <div className="pt-3 border-t border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Quick Fill Authorized Credentials:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginIdentifier('gaela malonzo');
                      setLoginPassword('gaela1989');
                      setLoginError(null);
                    }}
                    className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition-colors cursor-pointer"
                  >
                    <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                      <Crown className="w-3 h-3" />
                      <span>Platform Creator</span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">Gaela Malonzo</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLoginIdentifier('saqteamtracker');
                      setLoginPassword('tracker1989');
                      setLoginError(null);
                    }}
                    className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition-colors cursor-pointer"
                  >
                    <div className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      <span>Administrator</span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">saqteamtracker</div>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 2: REGISTER AS ADMINISTRATOR */}
          {activeTab === 'register_admin' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-rose-400" />
                    Register as Administrator
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 uppercase tracking-wider">
                    Needs Creator Approval
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Register using your name and password of choice. Administrator authority requires approval from the Creator (Gaela Malonzo).
                </p>
              </div>

              {adminError && (
                <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{adminError}</span>
                </div>
              )}

              {adminSuccess && (
                <div className="p-3 rounded-lg bg-emerald-950/70 border border-emerald-800 text-emerald-200 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{adminSuccess}</span>
                </div>
              )}

              <form onSubmit={handleRegisterAdmin} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Your Full Name</label>
                  <input
                    type="text"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="e.g. Engr. Marco Rivera"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:border-rose-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Username of Choice</label>
                  <input
                    type="text"
                    required
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="e.g. marcorivera"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:border-rose-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Password of Choice</label>
                  <div className="relative">
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Choose your administrator password"
                      className="w-full px-3 pr-10 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:border-rose-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Department / Organization (Optional)</label>
                  <input
                    type="text"
                    value={adminDept}
                    onChange={(e) => setAdminDept(e.target.value)}
                    placeholder="e.g. Telecom Civil Engineering Operations"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:border-rose-500 transition-colors"
                  />
                </div>

                <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-[11px] leading-relaxed">
                  <strong>🔒 Creator Approval Required:</strong> As specified in system governance, newly registered Administrators must be verified and approved by the Platform Creator (Gaela Malonzo) before accessing administrative tools.
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Submit Administrator Registration for Creator Approval</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: REGISTER AS HANDLER */}
          {activeTab === 'register_handler' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-sky-400" />
                    Register as Project Handler
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 uppercase tracking-wider">
                    Needs Admin / Creator Approval
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Register using your name and password of choice. Once approved by an Administrator or Creator, you can edit only the specific tracker(s) assigned to you.
                </p>
              </div>

              {handlerError && (
                <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{handlerError}</span>
                </div>
              )}

              {handlerSuccess && (
                <div className="p-3 rounded-lg bg-emerald-950/70 border border-emerald-800 text-emerald-200 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{handlerSuccess}</span>
                </div>
              )}

              <form onSubmit={handleRegisterHandler} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Your Full Name</label>
                  <input
                    type="text"
                    required
                    value={handlerName}
                    onChange={(e) => setHandlerName(e.target.value)}
                    placeholder="e.g. Engr. Alvin Cruz"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Username of Choice</label>
                  <input
                    type="text"
                    required
                    value={handlerUsername}
                    onChange={(e) => setHandlerUsername(e.target.value)}
                    placeholder="e.g. alvincruz"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Password of Choice</label>
                  <div className="relative">
                    <input
                      type={showHandlerPassword ? 'text' : 'password'}
                      required
                      value={handlerPassword}
                      onChange={(e) => setHandlerPassword(e.target.value)}
                      placeholder="Choose your password"
                      className="w-full px-3 pr-10 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowHandlerPassword(!showHandlerPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {showHandlerPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Designation / Role (Optional)</label>
                  <input
                    type="text"
                    value={handlerTitle}
                    onChange={(e) => setHandlerTitle(e.target.value)}
                    placeholder="e.g. SAQ Civil Site Rollout Engineer"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500 transition-colors"
                  />
                </div>

                <div className="p-2.5 rounded-lg bg-sky-950/40 border border-sky-800/60 text-sky-300 text-[11px] leading-relaxed">
                  <strong>🎯 Assigned Tracker Permission:</strong> Handlers can only edit the specific tracker project(s) assigned to them by an Administrator or Creator. Trackers not assigned to you will remain strictly view-only.
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Submit Handler Registration for Approval</span>
                </button>
              </form>
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 px-6 py-4 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Governance: Creator (Full Authority) · Admin (Approved by Creator) · Handlers (Assigned Trackers) · Guests (View Only)</span>
        </div>
        <div>
          <span>GEM PRO Generic Tracker System · Philippine Telecom Engineering</span>
        </div>
      </footer>
    </div>
  );
};
