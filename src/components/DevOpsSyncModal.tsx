import React, { useState, useEffect } from 'react';
import { Tracker } from '../types/tracker';
import {
  GitHubConfig,
  GitHubTestResult,
  getGitHubConfig,
  saveGitHubConfig,
  clearGitHubConfig,
  testGitHubConnection,
  pushTrackersToGitHub,
  pushTrackersWithVercelDeploy,
  pullTrackersFromGitHub,
  generateGitHubWorkflowYaml,
} from '../utils/githubClient';
import {
  VercelConfig,
  VercelTestResult,
  getVercelConfig,
  saveVercelConfig,
  clearVercelConfig,
  testVercelConnection,
  getVercelDeployUrl,
  triggerVercelDeployHook,
} from '../utils/vercelClient';
import {
  CloudflareConfig,
  CloudflareTestResult,
  getCloudflareConfig,
  saveCloudflareConfig,
  testCloudflareConnection,
  pushTrackersToCloudflare,
  loadTrackersFromCloudflare,
  getCloudflareWorkerTemplateCode,
  getCloudflareTeamCollaborationUrl,
  getCloudflareFreeShareLink,
} from '../utils/cloudflareClient';
import {
  GitBranch,
  Github,
  Globe,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Upload,
  Download,
  Key,
  FolderGit2,
  Share2,
  Zap,
  ShieldCheck,
  Code2,
  X,
  FileCode,
  Rocket,
  Layers,
  Sparkles,
  ArrowRight,
  Clock,
  Play,
} from 'lucide-react';

interface DevOpsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackers: Tracker[];
  onTrackersLoaded?: (trackers: Tracker[]) => void;
  defaultTab?: 'pipeline' | 'github' | 'vercel' | 'cloudflare';
}

export const DevOpsSyncModal: React.FC<DevOpsSyncModalProps> = ({
  isOpen,
  onClose,
  trackers,
  onTrackersLoaded,
  defaultTab = 'pipeline',
}) => {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'github' | 'vercel' | 'cloudflare'>(defaultTab);

  // GitHub State
  const [ghConfig, setGhConfig] = useState<GitHubConfig>(() => getGitHubConfig());
  const [ghTestResult, setGhTestResult] = useState<GitHubTestResult | null>(null);
  const [isGhTesting, setIsGhTesting] = useState(false);
  const [isGhPushing, setIsGhPushing] = useState(false);
  const [isGhPulling, setIsGhPulling] = useState(false);
  const [ghCommitMsg, setGhCommitMsg] = useState('');
  const [copiedWorkflow, setCopiedWorkflow] = useState(false);

  // Vercel State
  const [vcConfig, setVcConfig] = useState<VercelConfig>(() => getVercelConfig());
  const [vcTestResult, setVcTestResult] = useState<VercelTestResult | null>(null);
  const [isVcTesting, setIsVcTesting] = useState(false);

  // Cloudflare Free Sharing State
  const [cfConfig, setCfConfig] = useState<CloudflareConfig>(() => getCloudflareConfig());
  const [cfTestResult, setCfTestResult] = useState<CloudflareTestResult | null>(null);
  const [isCfTesting, setIsCfTesting] = useState(false);
  const [isCfPushing, setIsCfPushing] = useState(false);
  const [isCfPulling, setIsCfPulling] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [copiedWorkerCode, setCopiedWorkerCode] = useState(false);

  // Pipeline State (GitHub ➔ Vercel Auto-Deployment)
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<any>(null);
  const [isTestingHook, setIsTestingHook] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [isOAuthConnecting, setIsOAuthConnecting] = useState(false);
  const [copiedCallbackUrl, setCopiedCallbackUrl] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setGhConfig(getGitHubConfig());
      setVcConfig(getVercelConfig());
      setCfConfig(getCloudflareConfig());
      setActiveTab(defaultTab);
      setGhTestResult(null);
      setVcTestResult(null);
      setCfTestResult(null);
    }
  }, [isOpen, defaultTab]);

  // Listen for OAuth success or error messages from popup window
  useEffect(() => {
    const handleOAuthMessage = async (event: MessageEvent) => {
      // Validate origin is from AI Studio preview or localhost
      const origin = event.origin;
      if (origin && !origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.provider === 'github') {
        const token = event.data.token;
        const user = event.data.user;
        if (token) {
          const username = user?.login || user?.name || '';
          const avatar = user?.avatar_url || '';
          const updated = saveGitHubConfig({
            token,
            connectedUser: username,
            connectedUserAvatar: avatar,
            repoOwner: username || getGitHubConfig().repoOwner,
          });
          setGhConfig(updated);
          showToast(`Connected to GitHub as @${username}!`, 'success');
          // Automatically run test connection
          setIsGhTesting(true);
          try {
            const res = await testGitHubConnection(token, username, updated.repoName);
            setGhTestResult(res);
          } finally {
            setIsGhTesting(false);
          }
        }
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR' && event.data?.provider === 'github') {
        showToast(`GitHub connection error: ${event.data.error}`, 'error');
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleConnectGitHubOAuth = async () => {
    setIsOAuthConnecting(true);
    try {
      const res = await fetch('/api/auth/github/url');
      if (!res.ok) throw new Error('Could not fetch GitHub authorization endpoint');
      const data = await res.json();

      if (data.configured && data.url) {
        // Open OAuth Provider directly in popup window
        const popup = window.open(data.url, 'github_oauth_popup', 'width=620,height=720,menubar=no,toolbar=no');
        if (!popup) {
          showToast('Popup was blocked by your browser. Please allow popups to connect with GitHub.', 'error');
        } else {
          showToast('Opening GitHub authorization popup...', 'info');
        }
      } else {
        // Fallback to 1-click token creation directly on GitHub
        window.open(data.tokenCreationUrl || 'https://github.com/settings/tokens/new?scopes=repo,gist,read:user&description=GEM+PRO+Generic+Tracker', '_blank');
        showToast('Opened GitHub Token creator! Paste your generated token below to connect.', 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to start GitHub connection', 'error');
    } finally {
      setIsOAuthConnecting(false);
    }
  };

  const handleDisconnectGitHub = () => {
    clearGitHubConfig();
    const fresh = getGitHubConfig();
    setGhConfig(fresh);
    setGhTestResult(null);
    showToast('Disconnected from GitHub', 'info');
  };

  if (!isOpen) return null;

  // GitHub Handlers
  const handleTestGitHub = async () => {
    setIsGhTesting(true);
    setGhTestResult(null);
    try {
      const res = await testGitHubConnection(ghConfig.token, ghConfig.repoOwner, ghConfig.repoName);
      setGhTestResult(res);
      if (res.success) {
        saveGitHubConfig({
          ...ghConfig,
          connectedUser: res.username || ghConfig.connectedUser,
          connectedUserAvatar: res.avatarUrl || ghConfig.connectedUserAvatar,
        });
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
    } finally {
      setIsGhTesting(false);
    }
  };

  const handlePushGitHub = async () => {
    setIsGhPushing(true);
    try {
      const res = await pushTrackersToGitHub(ghConfig, trackers, ghCommitMsg.trim() || undefined);
      if (res.success) {
        setGhConfig(getGitHubConfig());
        setGhCommitMsg('');
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
    } finally {
      setIsGhPushing(false);
    }
  };

  const handlePullGitHub = async () => {
    setIsGhPulling(true);
    try {
      const res = await pullTrackersFromGitHub(ghConfig);
      if (res.success && res.data) {
        onTrackersLoaded?.(res.data);
        showToast(res.message, 'success');
      } else {
        showToast(res.message || 'Failed to pull from GitHub', 'error');
      }
    } finally {
      setIsGhPulling(false);
    }
  };

  const handleCopyWorkflow = () => {
    const yaml = generateGitHubWorkflowYaml();
    navigator.clipboard.writeText(yaml);
    setCopiedWorkflow(true);
    showToast('Copied GitHub Actions workflow YAML to clipboard!', 'success');
    setTimeout(() => setCopiedWorkflow(false), 3000);
  };

  // Pipeline (GitHub ➔ Vercel Auto-Deployment) Handlers
  const handleTestVercelHook = async () => {
    const hook = vcConfig.deployHookUrl || ghConfig.vercelDeployHookUrl;
    if (!hook) {
      showToast('Please enter a Vercel Deploy Hook URL first', 'error');
      return;
    }
    setIsTestingHook(true);
    try {
      const res = await triggerVercelDeployHook(hook);
      if (res.success) {
        showToast(res.message, 'success');
        setVcConfig(getVercelConfig());
      } else {
        showToast(res.message, 'error');
      }
    } finally {
      setIsTestingHook(false);
    }
  };

  const handleRunFullPipeline = async () => {
    if (!ghConfig.token) {
      showToast('Please enter your GitHub Personal Access Token in the GitHub tab first.', 'error');
      setActiveTab('github');
      return;
    }
    setIsPipelineRunning(true);
    setPipelineResult(null);
    try {
      const res = await pushTrackersWithVercelDeploy(
        ghConfig,
        trackers,
        `Pipeline Trigger: update ${trackers.length} sheets with Vercel deployment`,
        vcConfig.deployHookUrl || ghConfig.vercelDeployHookUrl
      );
      setPipelineResult(res);
      setGhConfig(getGitHubConfig());
      setVcConfig(getVercelConfig());
      if (res.success) {
        showToast('Successfully committed to GitHub & triggered Vercel!', 'success');
      } else {
        showToast(res.message, 'error');
      }
    } finally {
      setIsPipelineRunning(false);
    }
  };

  // Vercel Handlers
  const handleTestVercel = async () => {
    setIsVcTesting(true);
    setVcTestResult(null);
    try {
      const res = await testVercelConnection(vcConfig.accessToken, vcConfig.projectName, vcConfig.projectId);
      setVcTestResult(res);
      if (res.success) {
        setVcConfig(getVercelConfig());
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
    } finally {
      setIsVcTesting(false);
    }
  };

  // Cloudflare Handlers
  const handleTestCloudflare = async () => {
    setIsCfTesting(true);
    setCfTestResult(null);
    try {
      const res = await testCloudflareConnection(cfConfig.workerUrl, cfConfig.authToken);
      setCfTestResult(res);
      if (res.success) {
        saveCloudflareConfig(cfConfig);
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
    } finally {
      setIsCfTesting(false);
    }
  };

  const handlePushCloudflare = async () => {
    setIsCfPushing(true);
    try {
      const res = await pushTrackersToCloudflare(cfConfig, trackers, {
        userName: 'Team Coordinator',
      });
      if (res.success) {
        setCfConfig(getCloudflareConfig());
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
    } finally {
      setIsCfPushing(false);
    }
  };

  const handlePullCloudflare = async () => {
    setIsCfPulling(true);
    try {
      const res = await loadTrackersFromCloudflare(cfConfig);
      if (res.success && res.trackers) {
        onTrackersLoaded?.(res.trackers);
        showToast(res.message, 'success');
      } else {
        showToast(res.message || 'Failed to pull from Cloudflare', 'error');
      }
    } finally {
      setIsCfPulling(false);
    }
  };

  const handleCopyShareLink = () => {
    const url = getCloudflareTeamCollaborationUrl(cfConfig.workerUrl, cfConfig.authToken);
    if (!url) {
      showToast('Please configure your Cloudflare Worker URL first', 'error');
      return;
    }
    navigator.clipboard.writeText(url);
    setCopiedShareLink(true);
    showToast('Copied Cloudflare Free Team Sharing Link!', 'success');
    setTimeout(() => setCopiedShareLink(false), 3000);
  };

  const handleCopyWorkerCode = () => {
    const code = getCloudflareWorkerTemplateCode(cfConfig.authToken);
    navigator.clipboard.writeText(code);
    setCopiedWorkerCode(true);
    showToast('Copied 100% Free Cloudflare Worker Code Template!', 'success');
    setTimeout(() => setCopiedWorkerCode(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-950 to-slate-900 text-sky-400 border border-indigo-700/60 shrink-0">
              <Layers className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">DevOps &amp; Cloud Integrations</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-sky-950 text-sky-300 border border-sky-700">
                  CONNECTED
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Connect GitHub, deploy on Vercel, and enable 100% Free Cloudflare data sharing for your team.
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

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950 px-6 gap-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('pipeline')}
            className={`py-3 px-4 border-b-2 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'pipeline'
                ? 'border-emerald-500 text-emerald-300 bg-emerald-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4 text-emerald-400" />
            <span>Auto Pipeline (GitHub ➔ Vercel)</span>
            {(ghConfig.autoUpdateRealtime || ghConfig.autoCommitOnSave) && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                AUTO ON
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('github')}
            className={`py-3 px-4 border-b-2 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'github'
                ? 'border-indigo-500 text-indigo-300 bg-indigo-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Github className="w-4 h-4" />
            <span>GitHub Connected</span>
            {ghConfig.lastCommittedAt && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vercel')}
            className={`py-3 px-4 border-b-2 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'vercel'
                ? 'border-sky-500 text-sky-300 bg-sky-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Rocket className="w-4 h-4 text-sky-400" />
            <span>Vercel Deploy</span>
            {vcConfig.productionUrl && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cloudflare')}
            className={`py-3 px-4 border-b-2 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'cloudflare'
                ? 'border-orange-500 text-orange-300 bg-orange-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cloud className="w-4 h-4 text-orange-400" />
            <span>Cloudflare Free Sharing</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-orange-500/20 text-orange-300 border border-orange-500/40">
              FREE
            </span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* TAB 0: AUTO PIPELINE (GITHUB ➔ VERCEL) */}
          {activeTab === 'pipeline' && (
            <div className="space-y-4">
              {/* Pipeline Hero Card & Live Status */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-950 to-sky-950/40 border border-emerald-500/40 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <Zap className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm">
                          Automated Continuous Deployment Pipeline
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          GITHUB ➔ VERCEL
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Whenever your trackers are updated, changes are committed to GitHub and automatically deployed to Vercel global edge.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRunFullPipeline}
                    disabled={isPipelineRunning || !ghConfig.token}
                    className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-950 transition-all cursor-pointer shrink-0 active:scale-95"
                  >
                    <Play className={`w-3.5 h-3.5 fill-white ${isPipelineRunning ? 'animate-spin' : ''}`} />
                    <span>{isPipelineRunning ? 'Running Pipeline...' : 'Run Auto-Pipeline Now'}</span>
                  </button>
                </div>

                {/* Pipeline Flow Architecture Diagram */}
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-2.5 text-xs">
                  {/* Step 1 */}
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-300 text-[11px]">1. Tracker Data</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      {trackers.length} sheets · {trackers.reduce((acc, t) => acc + (t.rows ? t.rows.length : 0), 0)} site records
                    </p>
                    <span className="inline-block text-[9px] font-mono text-sky-400 bg-sky-950/60 px-1 py-0.5 rounded">
                      Local + Server
                    </span>
                  </div>

                  {/* Step 2 */}
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-300 text-[11px]">2. GitHub Commit</span>
                      {ghConfig.lastCommittedAt ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate leading-tight">
                      {ghConfig.repoOwner ? `${ghConfig.repoOwner}/${ghConfig.repoName}` : 'Configure Repo'}
                    </p>
                    <span className="inline-block text-[9px] font-mono text-emerald-400 bg-emerald-950/60 px-1 py-0.5 rounded">
                      {ghConfig.lastCommitSha ? `SHA: ${ghConfig.lastCommitSha}` : 'Ready to push'}
                    </span>
                  </div>

                  {/* Step 3 */}
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-300 text-[11px]">3. Vercel Trigger</span>
                      {vcConfig.deployHookUrl || vcConfig.accessToken ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                      ) : (
                        <GitBranch className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      {vcConfig.deployHookUrl ? 'Deploy Hook Webhook' : 'Native Git Push Build'}
                    </p>
                    <span className="inline-block text-[9px] font-mono text-sky-300 bg-sky-950/60 px-1 py-0.5 rounded">
                      {vcConfig.lastDeploymentStatus || 'READY'}
                    </span>
                  </div>

                  {/* Step 4 */}
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-300 text-[11px]">4. Production Edge</span>
                      <Rocket className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                    <p className="text-[10px] text-slate-400 truncate leading-tight">
                      {vcConfig.productionUrl ? vcConfig.productionUrl.replace('https://', '') : 'vercel.app'}
                    </p>
                    {vcConfig.productionUrl ? (
                      <a
                        href={vcConfig.productionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[9px] font-bold text-sky-300 bg-sky-900/60 px-1.5 py-0.5 rounded hover:bg-sky-800"
                      >
                        <span>Visit App</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    ) : (
                      <span className="inline-block text-[9px] text-slate-500">Auto Deploying</span>
                    )}
                  </div>
                </div>

                {/* Pipeline Run Result Feedback */}
                {pipelineResult && (
                  <div
                    className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                      pipelineResult.success
                        ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-200'
                        : 'bg-rose-950/60 border-rose-700/60 text-rose-200'
                    }`}
                  >
                    {pipelineResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1 min-w-0">
                      <span className="font-bold block">{pipelineResult.message}</span>
                      {pipelineResult.commitUrl && (
                        <a
                          href={pipelineResult.commitUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] underline text-sky-300 hover:text-white flex items-center gap-1"
                        >
                          <span>View commit on GitHub ({pipelineResult.commitSha?.slice(0, 7)})</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Pipeline Automation Rules */}
              <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Auto-Update Triggers &amp; Automation Rules</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Runs in browser with zero extra dependencies
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Trigger 1: Real-time on edit */}
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-white block">Auto-Update on Edit (Real-Time)</span>
                        <p className="text-[11px] text-slate-400">
                          Automatically commits to GitHub 15 seconds after typing or editing site records, SLAs, and costs.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={ghConfig.autoUpdateRealtime}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setGhConfig({ ...ghConfig, autoUpdateRealtime: val });
                          saveGitHubConfig({ autoUpdateRealtime: val });
                          showToast(val ? 'Real-Time Auto-Update turned ON' : 'Real-Time Auto-Update turned OFF', 'info');
                        }}
                        className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Trigger 2: Auto-commit on Save */}
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-white block">Auto-Commit on Save</span>
                        <p className="text-[11px] text-slate-400">
                          Commits to GitHub &amp; triggers Vercel whenever you hit the Save button or press Ctrl+S.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={ghConfig.autoCommitOnSave}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setGhConfig({ ...ghConfig, autoCommitOnSave: val });
                          saveGitHubConfig({ autoCommitOnSave: val });
                          showToast(val ? 'Auto-Commit on Save turned ON' : 'Auto-Commit on Save turned OFF', 'info');
                        }}
                        className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Trigger 3: Interval Schedule */}
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-white block">Periodic Interval Auto-Update</span>
                        <p className="text-[11px] text-slate-400">
                          Automatically pushes changes on a background timer.
                        </p>
                      </div>
                      <select
                        value={ghConfig.autoUpdateInterval}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setGhConfig({ ...ghConfig, autoUpdateInterval: val });
                          saveGitHubConfig({ autoUpdateInterval: val });
                          showToast(val > 0 ? `Interval set to every ${val} minutes` : 'Interval disabled', 'info');
                        }}
                        className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-hidden"
                      >
                        <option value={0}>Disabled</option>
                        <option value={5}>Every 5 minutes</option>
                        <option value={10}>Every 10 minutes</option>
                        <option value={15}>Every 15 minutes</option>
                        <option value={30}>Every 30 minutes</option>
                        <option value={60}>Every 1 hour</option>
                      </select>
                    </div>
                  </div>

                  {/* Trigger 4: Auto Deploy Vercel Hook */}
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-white block">Auto-Trigger Vercel on GitHub Push</span>
                        <p className="text-[11px] text-slate-400">
                          Instantly pings Vercel Deploy Hook whenever GitHub commit finishes.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={ghConfig.autoDeployVercelHook}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setGhConfig({ ...ghConfig, autoDeployVercelHook: val });
                          saveGitHubConfig({ autoDeployVercelHook: val });
                          setVcConfig({ ...vcConfig, autoDeployOnGitPush: val });
                          saveVercelConfig({ autoDeployOnGitPush: val });
                          showToast(val ? 'Vercel Auto-Trigger turned ON' : 'Vercel Auto-Trigger turned OFF', 'info');
                        }}
                        className="w-4 h-4 rounded text-sky-500 focus:ring-sky-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Vercel Deploy Hook Direct Configuration */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-sky-400" />
                    <span>Vercel Deploy Hook Webhook</span>
                  </span>
                  <a
                    href="https://vercel.com/docs/deployments/deploy-hooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
                  >
                    <span>Vercel Docs</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">
                    Vercel Deploy Hook URL (HTTP POST)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      placeholder="https://api.vercel.com/v1/integrations/deploy/prj_xxx/hook_xxx"
                      value={vcConfig.deployHookUrl || ghConfig.vercelDeployHookUrl || ''}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setVcConfig({ ...vcConfig, deployHookUrl: val });
                        saveVercelConfig({ deployHookUrl: val });
                        setGhConfig({ ...ghConfig, vercelDeployHookUrl: val });
                        saveGitHubConfig({ vercelDeployHookUrl: val });
                      }}
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono placeholder-slate-600 focus:outline-hidden focus:border-sky-500"
                    />
                    <button
                      type="button"
                      onClick={handleTestVercelHook}
                      disabled={isTestingHook || (!vcConfig.deployHookUrl && !ghConfig.vercelDeployHookUrl)}
                      className="px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTestingHook ? 'animate-spin' : ''}`} />
                      <span>{isTestingHook ? 'Testing...' : 'Test Webhook'}</span>
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Created in Vercel Dashboard &gt; Your Project &gt; Settings &gt; Git &gt; Deploy Hooks (Branch: <code>main</code>).
                  </span>
                </div>
              </div>

              {/* 30-Second Quick Setup Guide */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5 text-xs">
                <span className="font-bold text-white block uppercase tracking-wider text-[11px]">
                  How to Connect GitHub ➔ Vercel in 30 Seconds:
                </span>
                <ol className="space-y-1.5 text-slate-300 list-decimal list-inside text-[11px] leading-relaxed">
                  <li>
                    <strong>Push to GitHub:</strong> Enter your Personal Access Token in the <button type="button" onClick={() => setActiveTab('github')} className="text-indigo-400 underline font-semibold">GitHub tab</button> and test the connection.
                  </li>
                  <li>
                    <strong>Import to Vercel:</strong> Go to <a href="https://vercel.com/new" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline font-semibold">vercel.com/new</a> and select your GitHub repository. Vercel automatically detects the Vite SPA framework and builds on every push!
                  </li>
                  <li>
                    <strong>Create Deploy Hook:</strong> In your Vercel project Settings &gt; Git &gt; Deploy Hooks, create a hook and paste it above for instant, zero-latency trigger execution.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 1: GITHUB CONNECTED */}
          {activeTab === 'github' && (
            <div className="space-y-4">
              {/* GitHub Overview & Direct 1-Click Connect Card */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/40 border border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {ghConfig.connectedUserAvatar ? (
                      <img
                        src={ghConfig.connectedUserAvatar}
                        alt={ghConfig.connectedUser || 'GitHub User'}
                        className="w-12 h-12 rounded-xl border border-indigo-500/50 object-cover shrink-0"
                      />
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 text-white shrink-0">
                        <Github className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">GitHub Version Control &amp; Deployments</span>
                        {ghConfig.connectedUser ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            @{ghConfig.connectedUser} (CONNECTED)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-800 text-amber-300 border border-slate-700">
                            NOT CONNECTED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Connect your GitHub account to auto-commit snapshots, manage repositories, and trigger Vercel CI/CD pipelines.
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleConnectGitHubOAuth}
                      disabled={isOAuthConnecting}
                      className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-md shadow-indigo-950 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                    >
                      <Github className="w-4 h-4" />
                      <span>{isOAuthConnecting ? 'Connecting...' : ghConfig.connectedUser ? 'Re-Connect GitHub' : 'Connect to GitHub'}</span>
                    </button>

                    {ghConfig.connectedUser && (
                      <button
                        type="button"
                        onClick={handleDisconnectGitHub}
                        className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                        title="Disconnect current GitHub token & user"
                      >
                        Disconnect
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleTestGitHub}
                      disabled={isGhTesting || !ghConfig.token}
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors"
                      title="Verify token and repository permissions"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isGhTesting ? 'animate-spin' : ''}`} />
                      <span>{isGhTesting ? 'Verifying...' : 'Test'}</span>
                    </button>
                  </div>
                </div>

                {/* Connection helper buttons */}
                <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Requires <code>repo</code> and <code>gist</code> scopes for sheet backups &amp; commits.</span>
                  </div>

                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo,gist,read:user&description=GEM+PRO+Generic+Tracker"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 underline font-semibold text-[11px]"
                  >
                    <span>Create Pre-configured GitHub Token (1-Click)</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* OAuth Callback Configuration Helper (OAuth Skill Mandate) */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>OAuth Provider Settings (for OAuth App Creators)</span>
                  </span>
                  <a
                    href="https://github.com/settings/developers"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
                  >
                    <span>GitHub OAuth Apps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  If using a GitHub OAuth App, add this exact Authorization Callback URL to your GitHub Developer Settings:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value="https://ais-dev-2qtrkd3l54vk7xikqgdvkx-471160090687.asia-southeast1.run.app/auth/callback"
                    className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-sky-300 font-mono select-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('https://ais-dev-2qtrkd3l54vk7xikqgdvkx-471160090687.asia-southeast1.run.app/auth/callback');
                      setCopiedCallbackUrl(true);
                      showToast('Copied Callback URL to clipboard!', 'success');
                      setTimeout(() => setCopiedCallbackUrl(false), 2500);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedCallbackUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCallbackUrl ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Form Settings */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-indigo-400" />
                      <span>GitHub Personal Access Token (PAT)</span>
                    </label>
                    <input
                      type="password"
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      value={ghConfig.token}
                      onChange={async (e) => {
                        const val = e.target.value.trim();
                        setGhConfig({ ...ghConfig, token: val });
                        saveGitHubConfig({ token: val });
                        // Auto-test if pasted full token
                        if (val.length >= 30 && (val.startsWith('ghp_') || val.startsWith('github_pat_'))) {
                          setIsGhTesting(true);
                          try {
                            const res = await testGitHubConnection(val, ghConfig.repoOwner, ghConfig.repoName);
                            setGhTestResult(res);
                            if (res.success && res.username) {
                              const updated = saveGitHubConfig({
                                token: val,
                                connectedUser: res.username,
                                connectedUserAvatar: res.avatarUrl || '',
                                repoOwner: ghConfig.repoOwner || res.username,
                              });
                              setGhConfig(updated);
                              showToast(`Connected as @${res.username}!`, 'success');
                            }
                          } finally {
                            setIsGhTesting(false);
                          }
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono placeholder-slate-600 focus:outline-hidden focus:border-indigo-500"
                    />
                    <span className="text-[10px] text-slate-500 block">
                      Needs <code>repo</code> or <code>gist</code> scope from GitHub &gt; Settings &gt; Developer Settings &gt; Tokens.
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <FolderGit2 className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Repository Owner / Username</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., saqcivilteam"
                      value={ghConfig.repoOwner}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGhConfig({ ...ghConfig, repoOwner: val });
                        saveGitHubConfig({ repoOwner: val });
                      }}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">Repository Name</label>
                    <input
                      type="text"
                      placeholder="e.g., gem-pro-generic-tracker"
                      value={ghConfig.repoName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGhConfig({ ...ghConfig, repoName: val });
                        saveGitHubConfig({ repoName: val });
                      }}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">Target Branch &amp; Path</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="main"
                        value={ghConfig.branch}
                        onChange={(e) => {
                          const val = e.target.value;
                          setGhConfig({ ...ghConfig, branch: val });
                          saveGitHubConfig({ branch: val });
                        }}
                        className="px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                      />
                      <input
                        type="text"
                        placeholder="data/gem_pro_trackers.json"
                        value={ghConfig.filePath}
                        onChange={(e) => {
                          const val = e.target.value;
                          setGhConfig({ ...ghConfig, filePath: val });
                          saveGitHubConfig({ filePath: val });
                        }}
                        className="px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Gist Option */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={ghConfig.useGist}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setGhConfig({ ...ghConfig, useGist: val });
                        saveGitHubConfig({ useGist: val });
                      }}
                      className="rounded text-indigo-500 focus:ring-indigo-500"
                    />
                    <span className="font-semibold text-slate-300">
                      Sync as GitHub Gist instead of full repository (simpler, zero-config)
                    </span>
                  </label>
                </div>

                {/* Auto Update & Vercel Trigger Settings */}
                <div className="pt-2.5 border-t border-slate-800 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ghConfig.autoUpdateRealtime}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setGhConfig({ ...ghConfig, autoUpdateRealtime: val });
                          saveGitHubConfig({ autoUpdateRealtime: val });
                          showToast(val ? 'Auto-Update on Edit turned ON' : 'Auto-Update on Edit turned OFF', 'info');
                        }}
                        className="rounded text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="font-semibold text-slate-300">
                        ⚡ Auto-Update on Edit (debounced 15s push to GitHub)
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ghConfig.autoDeployVercelHook}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setGhConfig({ ...ghConfig, autoDeployVercelHook: val });
                          saveGitHubConfig({ autoDeployVercelHook: val });
                          showToast(val ? 'Auto-Deploy to Vercel turned ON' : 'Auto-Deploy to Vercel turned OFF', 'info');
                        }}
                        className="rounded text-sky-500 focus:ring-sky-500"
                      />
                      <span className="font-semibold text-sky-300">
                        ▲ Auto-Deploy to Vercel on Git Push
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Sync Controls */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Commit &amp; Restore Tracker Data
                  </span>
                  {ghConfig.lastCommittedAt && (
                    <span className="text-[10px] font-mono text-emerald-400">
                      Last commit: {new Date(ghConfig.lastCommittedAt).toLocaleString()} ({ghConfig.lastCommitSha})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Optional commit message (e.g., Update site rollouts & SLA targets)"
                    value={ghCommitMsg}
                    onChange={(e) => setGhCommitMsg(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handlePushGitHub}
                    disabled={isGhPushing || !ghConfig.token}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 shadow-md shadow-indigo-950 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isGhPushing ? 'Committing...' : 'Push to GitHub'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePullGitHub}
                    disabled={isGhPulling || !ghConfig.token}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-400" />
                    <span>{isGhPulling ? 'Pulling...' : 'Pull from GitHub'}</span>
                  </button>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
                  <button
                    type="button"
                    onClick={handleCopyWorkflow}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>{copiedWorkflow ? '✓ Copied Actions YAML' : 'Copy GitHub Actions CI/CD Workflow'}</span>
                  </button>
                  {ghConfig.repoOwner && ghConfig.repoName && (
                    <a
                      href={`https://github.com/${ghConfig.repoOwner}/${ghConfig.repoName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
                    >
                      <span>Open on GitHub</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VERCEL DEPLOY */}
          {activeTab === 'vercel' && (
            <div className="space-y-4">
              {/* Vercel Overview Card */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 text-white shrink-0">
                    <Rocket className="w-6 h-6 text-sky-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">Vercel Cloud Deployment</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-sky-950 text-sky-300 border border-sky-700">
                        1-CLICK DEPLOY
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Deploy GEM PRO on Vercel's global edge network with instant build updates and zero-config SPA routing.
                    </p>
                  </div>
                </div>

                {/* 1-Click Deploy Button */}
                <a
                  href={getVercelDeployUrl(
                    ghConfig.repoOwner && ghConfig.repoName
                      ? `https://github.com/${ghConfig.repoOwner}/${ghConfig.repoName}`
                      : undefined
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-200 text-slate-950 text-xs font-black flex items-center gap-2 shadow-lg transition-all active:scale-95 shrink-0"
                >
                  <Rocket className="w-4 h-4 text-slate-950 fill-slate-950" />
                  <span>Deploy to Vercel</span>
                  <ExternalLink className="w-3 h-3 text-slate-700" />
                </a>
              </div>

              {/* Vercel Status & Live URL */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-sky-400" />
                      <span>Production App URL</span>
                    </label>
                    <input
                      type="text"
                      placeholder="https://gem-pro-generic-tracker.vercel.app"
                      value={vcConfig.productionUrl}
                      onChange={(e) => {
                        const val = e.target.value;
                        setVcConfig({ ...vcConfig, productionUrl: val });
                        saveVercelConfig({ productionUrl: val });
                      }}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-sky-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">Vercel Personal Access Token (Optional)</label>
                    <input
                      type="password"
                      placeholder="Vercel Access Token for live status check"
                      value={vcConfig.accessToken}
                      onChange={(e) => {
                        const val = e.target.value;
                        setVcConfig({ ...vcConfig, accessToken: val });
                        saveVercelConfig({ accessToken: val });
                      }}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono placeholder-slate-600 focus:outline-hidden focus:border-sky-500"
                    />
                  </div>
                </div>

                {/* Vercel Deploy Hook Section */}
                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-sky-400" />
                      <span>Vercel Deploy Hook (Instant Webhook Build Trigger)</span>
                    </label>
                    <a
                      href="https://vercel.com/docs/deployments/deploy-hooks"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
                    >
                      <span>Vercel Docs</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      placeholder="https://api.vercel.com/v1/integrations/deploy/prj_xxx/hook_xxx"
                      value={vcConfig.deployHookUrl || ghConfig.vercelDeployHookUrl || ''}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setVcConfig({ ...vcConfig, deployHookUrl: val });
                        saveVercelConfig({ deployHookUrl: val });
                        setGhConfig({ ...ghConfig, vercelDeployHookUrl: val });
                        saveGitHubConfig({ vercelDeployHookUrl: val });
                      }}
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono placeholder-slate-600 focus:outline-hidden focus:border-sky-500"
                    />
                    <button
                      type="button"
                      onClick={handleTestVercelHook}
                      disabled={isTestingHook || (!vcConfig.deployHookUrl && !ghConfig.vercelDeployHookUrl)}
                      className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTestingHook ? 'animate-spin' : ''}`} />
                      <span>{isTestingHook ? 'Testing...' : 'Test Webhook'}</span>
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Copy from Vercel &gt; Settings &gt; Git &gt; Deploy Hooks. When Git pushes, this hook triggers an instant edge build.
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <div className="flex items-center gap-2">
                    {vcConfig.productionUrl && (
                      <a
                        href={vcConfig.productionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-sky-950 text-sky-300 border border-sky-800 hover:bg-sky-900 text-xs font-bold flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Visit Live App</span>
                      </a>
                    )}
                    <span className="text-xs text-slate-400">
                      Configuration includes <code>vercel.json</code> rewrite rules for SPA client routing.
                    </span>
                  </div>

                  {vcConfig.accessToken && (
                    <button
                      type="button"
                      onClick={handleTestVercel}
                      disabled={isVcTesting}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isVcTesting ? 'animate-spin' : ''}`} />
                      <span>{isVcTesting ? 'Checking...' : 'Check Vercel Status'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CLOUDFLARE FREE SHARING FOR DATA */}
          {activeTab === 'cloudflare' && (
            <div className="space-y-4">
              {/* Highlight Banner: 100% Free Data Sharing */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-orange-950/60 via-slate-900 to-amber-950/30 border border-orange-500/50 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/40 shrink-0">
                      <Cloud className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">Cloudflare Free Sharing for Data</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          100,000 REQS / DAY FREE
                        </span>
                      </div>
                      <p className="text-xs text-orange-200/90 mt-0.5">
                        Free real-time multi-account data sharing powered by Cloudflare Workers &amp; Edge KV. Zero cost forever.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 shrink-0 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5 text-slate-950" />
                    <span>{copiedShareLink ? '✓ Link Copied!' : 'Copy Free Share Link'}</span>
                  </button>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>No Paid Subscriptions:</strong> Teammates can view, sync, and pull live tracker data without signing up or paying for databases.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>Global Low Latency:</strong> Data is served from 300+ Cloudflare edge locations worldwide with &lt;50ms response times.</span>
                  </div>
                </div>
              </div>

              {/* Endpoint Settings */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">Cloudflare Worker URL</label>
                    <input
                      type="text"
                      placeholder="https://tracker-edge-db.your-subdomain.workers.dev"
                      value={cfConfig.workerUrl}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCfConfig({ ...cfConfig, workerUrl: val });
                        saveCloudflareConfig({ workerUrl: val });
                      }}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-orange-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">Security Token (Optional)</label>
                    <input
                      type="password"
                      placeholder="Secret bearer token"
                      value={cfConfig.authToken}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCfConfig({ ...cfConfig, authToken: val });
                        saveCloudflareConfig({ authToken: val });
                      }}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono placeholder-slate-600 focus:outline-hidden focus:border-orange-500"
                    />
                  </div>
                </div>

                {/* Push / Pull / Test Buttons */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePushCloudflare}
                      disabled={isCfPushing || !cfConfig.workerUrl}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isCfPushing ? 'Pushing...' : 'Push Data to Cloudflare'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePullCloudflare}
                      disabled={isCfPulling || !cfConfig.workerUrl}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-orange-400" />
                      <span>{isCfPulling ? 'Pulling...' : 'Pull Data from Cloudflare'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleTestCloudflare}
                      disabled={isCfTesting || !cfConfig.workerUrl}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isCfTesting ? 'animate-spin' : ''}`} />
                      <span>Test Edge Ping</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyWorkerCode}
                    className="text-xs text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>{copiedWorkerCode ? '✓ Copied Worker Code' : 'Copy Free Worker Code'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>All tokens and credentials are kept strictly local in your browser and never exposed.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Floating Toast Notification */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-60 px-4 py-2.5 rounded-xl border text-xs flex items-center gap-2 shadow-2xl animate-in slide-in-from-bottom duration-150 ${
          toast.type === 'success'
            ? 'bg-slate-900 border-emerald-500 text-emerald-200'
            : toast.type === 'error'
            ? 'bg-slate-900 border-rose-500 text-rose-200'
            : 'bg-slate-900 border-sky-500 text-sky-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
};
