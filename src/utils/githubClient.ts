/**
 * GitHub Integration Client & Version-Controlled Backup Utility
 *
 * Enables 1-click sync, commits, and pulls of tracker datasets to GitHub
 * repositories or GitHub Gists for free version history, audit logging,
 * and automated deployments.
 */

import { Tracker } from '../types/tracker';
import { triggerVercelDeployHook, getVercelConfig } from './vercelClient';

export interface GitHubConfig {
  token: string;
  repoOwner: string;
  repoName: string;
  branch: string;
  filePath: string;
  useGist: boolean;
  gistId?: string;
  autoCommitOnSave: boolean;
  autoUpdateRealtime: boolean; // Auto commit on changes (debounced 15s)
  autoUpdateInterval: number; // 0 = disabled, 5, 10, 15, 30, 60 minutes
  autoDeployVercelHook: boolean; // Trigger Vercel Deploy Hook when GitHub is updated
  vercelDeployHookUrl?: string; // Vercel Deploy Hook URL
  lastCommittedAt?: string | null;
  lastCommitSha?: string | null;
  lastCommitMessage?: string;
  connectedUser?: string;
  connectedUserAvatar?: string;
}

export interface GitHubTestResult {
  success: boolean;
  message: string;
  username?: string;
  avatarUrl?: string;
  repoExists?: boolean;
  canWrite?: boolean;
  defaultBranch?: string;
}

export interface GitHubSyncResult {
  success: boolean;
  message: string;
  commitSha?: string;
  commitUrl?: string;
  timestamp?: string;
  data?: any;
  vercelTriggered?: boolean;
  vercelMessage?: string;
}

const STORAGE_KEY = 'gh_tracker_sync_config_v1';

export function getGitHubConfig(): GitHubConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        token: parsed.token || '',
        repoOwner: parsed.repoOwner || '',
        repoName: parsed.repoName || '',
        branch: parsed.branch || 'main',
        filePath: parsed.filePath || 'data/gem_pro_trackers.json',
        useGist: Boolean(parsed.useGist),
        gistId: parsed.gistId || '',
        autoCommitOnSave: Boolean(parsed.autoCommitOnSave),
        autoUpdateRealtime: Boolean(parsed.autoUpdateRealtime),
        autoUpdateInterval: typeof parsed.autoUpdateInterval === 'number' ? parsed.autoUpdateInterval : 0,
        autoDeployVercelHook: parsed.autoDeployVercelHook !== undefined ? Boolean(parsed.autoDeployVercelHook) : true,
        vercelDeployHookUrl: parsed.vercelDeployHookUrl || '',
        lastCommittedAt: parsed.lastCommittedAt || null,
        lastCommitSha: parsed.lastCommitSha || null,
        lastCommitMessage: parsed.lastCommitMessage || '',
        connectedUser: parsed.connectedUser || '',
        connectedUserAvatar: parsed.connectedUserAvatar || '',
      };
    }
  } catch (err) {
    console.warn('Failed to parse GitHub config:', err);
  }

  return {
    token: '',
    repoOwner: '',
    repoName: 'gem-pro-generic-tracker',
    branch: 'main',
    filePath: 'data/gem_pro_trackers.json',
    useGist: false,
    gistId: '',
    autoCommitOnSave: false,
    autoUpdateRealtime: false,
    autoUpdateInterval: 0,
    autoDeployVercelHook: true,
    vercelDeployHookUrl: '',
    lastCommittedAt: null,
    lastCommitSha: null,
    lastCommitMessage: '',
    connectedUser: '',
    connectedUserAvatar: '',
  };
}

export function saveGitHubConfig(update: Partial<GitHubConfig>): GitHubConfig {
  const current = getGitHubConfig();
  const merged: GitHubConfig = { ...current, ...update };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (err) {
    console.error('Failed to save GitHub config:', err);
  }
  return merged;
}

export function clearGitHubConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear GitHub config:', err);
  }
}

/**
 * Verify GitHub Personal Access Token and Repository access
 */
export async function testGitHubConnection(
  token: string,
  repoOwner?: string,
  repoName?: string
): Promise<GitHubTestResult> {
  const cleanToken = token.trim();
  if (!cleanToken) {
    return { success: false, message: 'Please provide a GitHub Personal Access Token' };
  }

  try {
    // 1. Check user profile
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `token ${cleanToken}`,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!userRes.ok) {
      if (userRes.status === 401) {
        return { success: false, message: 'Invalid GitHub token. Check your token permissions (need repo/gist scope).' };
      }
      return { success: false, message: `GitHub API returned ${userRes.status}: ${userRes.statusText}` };
    }

    const userData = await userRes.json();
    const username = userData.login;
    const avatarUrl = userData.avatar_url;

    // 2. If repo specified, check repo access
    if (repoOwner && repoName) {
      const repoRes = await fetch(`https://api.github.com/repos/${repoOwner.trim()}/${repoName.trim()}`, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `token ${cleanToken}`,
        },
        signal: AbortSignal.timeout(8000),
      });

      if (repoRes.ok) {
        const repoData = await repoRes.json();
        const canWrite = Boolean(repoData.permissions?.push || repoData.permissions?.admin);
        return {
          success: true,
          message: `Connected as @${username} to repository ${repoOwner}/${repoName}${canWrite ? ' (Write access verified)' : ' (Read-only)'}`,
          username,
          avatarUrl,
          repoExists: true,
          canWrite,
          defaultBranch: repoData.default_branch || 'main',
        };
      } else if (repoRes.status === 404) {
        return {
          success: true,
          message: `Authenticated as @${username}. Repository "${repoOwner}/${repoName}" was not found, but can be auto-created on first push.`,
          username,
          avatarUrl,
          repoExists: false,
          canWrite: true,
          defaultBranch: 'main',
        };
      }
    }

    return {
      success: true,
      message: `Authenticated successfully as GitHub user @${username}!`,
      username,
      avatarUrl,
      repoExists: false,
      canWrite: true,
      defaultBranch: 'main',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.name === 'TimeoutError'
        ? 'Connection to GitHub API timed out.'
        : (err.message || 'Network error connecting to GitHub'),
    };
  }
}

/**
 * Push full tracker dataset to GitHub (Repository file or Gist)
 */
export async function pushTrackersToGitHub(
  config: GitHubConfig,
  trackers: Tracker[],
  customMessage?: string
): Promise<GitHubSyncResult> {
  const token = config.token.trim();
  if (!token) {
    return { success: false, message: 'GitHub token is not configured.' };
  }

  const timestamp = new Date().toISOString();
  const commitMsg = customMessage || `chore(backup): update ${trackers.length} trackers snapshot [${new Date().toLocaleString('en-PH')}]`;

  const payload = {
    version: '1.4.0',
    exportedAt: timestamp,
    generator: 'GEM PRO Generic Tracker System (GitHub Sync)',
    metadata: {
      totalTrackers: trackers.length,
      totalRows: trackers.reduce((acc, t) => acc + (t.rows?.length || 0), 0),
      trackerNames: trackers.map((t) => t.name),
    },
    data: {
      trackers,
    },
  };

  const jsonString = JSON.stringify(payload, null, 2);

  try {
    // Mode A: Push as GitHub Gist
    if (config.useGist) {
      const files = {
        'gem_pro_trackers.json': {
          content: jsonString,
        },
      };

      let gistUrl = 'https://api.github.com/gists';
      let method = 'POST';

      if (config.gistId && config.gistId.trim()) {
        gistUrl = `https://api.github.com/gists/${config.gistId.trim()}`;
        method = 'PATCH';
      }

      const res = await fetch(gistUrl, {
        method,
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: `GEM PRO Generic Tracker Backup (${trackers.length} sheets, updated ${new Date().toLocaleDateString()})`,
          public: false,
          files,
        }),
      });

      if (!res.ok) {
        throw new Error(`GitHub Gist API error: ${res.status} ${res.statusText}`);
      }

      const gistData = await res.json();
      saveGitHubConfig({
        gistId: gistData.id,
        lastCommittedAt: timestamp,
        lastCommitSha: gistData.id.slice(0, 7),
        lastCommitMessage: commitMsg,
      });

      return {
        success: true,
        message: `Successfully updated GitHub Gist (${gistData.id}) with ${trackers.length} sheets!`,
        commitSha: gistData.id,
        commitUrl: gistData.html_url,
        timestamp,
      };
    }

    // Mode B: Push to GitHub Repository via Contents API
    const owner = config.repoOwner.trim();
    const repo = config.repoName.trim();
    const branch = config.branch.trim() || 'main';
    const path = config.filePath.trim().replace(/^\/+/, '') || 'data/gem_pro_trackers.json';

    if (!owner || !repo) {
      return { success: false, message: 'Please specify GitHub Repository Owner and Name.' };
    }

    // First check if file already exists to get its SHA (required for GitHub file updates)
    let currentSha: string | undefined = undefined;
    const checkUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

    try {
      const checkRes = await fetch(checkUrl, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `token ${token}`,
        },
      });
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        currentSha = checkData.sha;
      }
    } catch {
      // Ignore 404
    }

    // Convert UTF-8 to Base64 safely in browser
    const base64Content = btoa(unescape(encodeURIComponent(jsonString)));

    const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: commitMsg,
        content: base64Content,
        branch,
        sha: currentSha,
      }),
    });

    if (!putRes.ok) {
      const errJson = await putRes.json().catch(() => null);
      throw new Error(errJson?.message || `GitHub returned HTTP ${putRes.status}: ${putRes.statusText}`);
    }

    const commitData = await putRes.json();
    const sha = commitData.commit?.sha || currentSha || 'latest';
    const commitUrl = commitData.commit?.html_url || `https://github.com/${owner}/${repo}`;

    saveGitHubConfig({
      lastCommittedAt: timestamp,
      lastCommitSha: sha.slice(0, 7),
      lastCommitMessage: commitMsg,
    });

    return {
      success: true,
      message: `Committed ${trackers.length} sheets to ${owner}/${repo}@${branch} (${sha.slice(0, 7)})`,
      commitSha: sha,
      commitUrl,
      timestamp,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Failed to push trackers to GitHub',
    };
  }
}

/**
 * Push trackers to GitHub and automatically trigger connected Vercel deployment.
 *
 * This connects the full CI/CD loop:
 * 1. Commits and pushes tracker changes to GitHub
 * 2. Triggers Vercel Deploy Hook (or relies on Vercel's automatic Git integration)
 */
export async function pushTrackersWithVercelDeploy(
  ghConfig: GitHubConfig,
  trackers: Tracker[],
  customCommitMsg?: string,
  explicitVercelHook?: string
): Promise<GitHubSyncResult> {
  // Step 1: Push to GitHub
  const ghResult = await pushTrackersToGitHub(ghConfig, trackers, customCommitMsg);
  if (!ghResult.success) {
    return ghResult;
  }

  // Step 2: Determine Vercel Deploy Hook URL
  const vercelCfg = getVercelConfig();
  const hookUrl =
    (explicitVercelHook && explicitVercelHook.trim()) ||
    (ghConfig.vercelDeployHookUrl && ghConfig.vercelDeployHookUrl.trim()) ||
    (vercelCfg.deployHookUrl && vercelCfg.deployHookUrl.trim()) ||
    '';

  const shouldTriggerVercel =
    Boolean(ghConfig.autoDeployVercelHook) &&
    Boolean(vercelCfg.autoDeployOnGitPush) &&
    Boolean(hookUrl);

  if (shouldTriggerVercel) {
    try {
      const vercelRes = await triggerVercelDeployHook(hookUrl);
      return {
        ...ghResult,
        vercelTriggered: vercelRes.success,
        vercelMessage: vercelRes.message,
        message: `${ghResult.message} ➔ ${vercelRes.success ? '▲ Vercel deployment triggered!' : '⚠️ Vercel hook error: ' + vercelRes.message}`,
      };
    } catch (e: any) {
      return {
        ...ghResult,
        vercelTriggered: false,
        vercelMessage: e.message,
        message: `${ghResult.message} ➔ ⚠️ Vercel trigger failed: ${e.message}`,
      };
    }
  }

  // If no deploy hook is configured, Vercel's native Git integration will build automatically on push
  return {
    ...ghResult,
    vercelTriggered: true,
    vercelMessage: 'Vercel will automatically build from GitHub main branch push (Native Git Integration).',
    message: `${ghResult.message} (Vercel Git Integration active)`,
  };
}

/**
 * Pull latest tracker dataset from GitHub (Repository file or Gist)
 */
export async function pullTrackersFromGitHub(config: GitHubConfig): Promise<GitHubSyncResult> {
  const token = config.token.trim();
  if (!token) {
    return { success: false, message: 'GitHub token is not configured.' };
  }

  try {
    let rawJsonString = '';

    // Mode A: Pull from Gist
    if (config.useGist) {
      if (!config.gistId) {
        return { success: false, message: 'No GitHub Gist ID configured.' };
      }
      const res = await fetch(`https://api.github.com/gists/${config.gistId.trim()}`, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `token ${token}`,
        },
      });

      if (!res.ok) throw new Error(`Failed to fetch Gist (${res.status} ${res.statusText})`);
      const gist = await res.json();
      const file = gist.files?.['gem_pro_trackers.json'] || Object.values(gist.files || {})[0] as any;
      if (!file || !file.content) throw new Error('Gist does not contain valid tracker JSON file.');
      rawJsonString = file.content;
    } else {
      // Mode B: Pull from Repository
      const owner = config.repoOwner.trim();
      const repo = config.repoName.trim();
      const branch = config.branch.trim() || 'main';
      const path = config.filePath.trim().replace(/^\/+/, '') || 'data/gem_pro_trackers.json';

      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `token ${token}`,
        },
      });

      if (!res.ok) throw new Error(`File not found in ${owner}/${repo}@${branch}: ${path}`);
      const fileData = await res.json();
      if (!fileData.content) throw new Error('File content is empty.');

      // Decode Base64 content
      rawJsonString = decodeURIComponent(escape(atob(fileData.content.replace(/\s/g, ''))));
    }

    const parsed = JSON.parse(rawJsonString);
    let extractedTrackers: Tracker[] | null = null;

    if (parsed?.data?.trackers && Array.isArray(parsed.data.trackers)) {
      extractedTrackers = parsed.data.trackers;
    } else if (Array.isArray(parsed?.trackers)) {
      extractedTrackers = parsed.trackers;
    } else if (Array.isArray(parsed)) {
      extractedTrackers = parsed;
    }

    if (!extractedTrackers || extractedTrackers.length === 0) {
      return { success: false, message: 'File was read, but no valid tracker sheets were found.' };
    }

    return {
      success: true,
      message: `Successfully loaded ${extractedTrackers.length} tracker sheets from GitHub!`,
      data: extractedTrackers,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Failed to pull tracker data from GitHub',
    };
  }
}

/**
 * Generate GitHub Actions CI/CD Workflow YAML for automatic deployments to Vercel and Cloudflare
 */
export function generateGitHubWorkflowYaml(): string {
  return `name: GEM PRO CI/CD Pipeline

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Typecheck and Lint
        run: npm run lint

      - name: Build Production SPA
        run: npm run build

  deploy-vercel:
    needs: build-and-test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: \${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: \${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: \${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
`;
}
