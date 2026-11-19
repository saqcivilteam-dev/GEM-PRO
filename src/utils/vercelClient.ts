/**
 * Vercel Deployment & Cloud Edge Integration Utility
 *
 * Provides 1-click deployment configuration, live deployment status checks,
 * and edge data synchronization for Vercel.
 */

import { Tracker } from '../types/tracker';

export interface VercelConfig {
  projectName: string;
  projectId?: string;
  teamId?: string;
  accessToken: string;
  productionUrl: string;
  deployHookUrl?: string;
  lastDeployedAt?: string | null;
  lastDeployHookTriggeredAt?: string | null;
  lastDeploymentStatus?: 'READY' | 'BUILDING' | 'ERROR' | 'QUEUED' | 'UNKNOWN';
  autoSyncWithVercelEdge: boolean;
  autoDeployOnGitPush: boolean;
}

export interface VercelTestResult {
  success: boolean;
  message: string;
  project?: {
    id: string;
    name: string;
    framework: string;
    latestDeployment?: {
      url: string;
      readyState: string;
      createdAt: number;
    };
  };
}

const STORAGE_KEY = 'vercel_sync_config_v1';

export function getVercelConfig(): VercelConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        projectName: parsed.projectName || 'gem-pro-generic-tracker',
        projectId: parsed.projectId || '',
        teamId: parsed.teamId || '',
        accessToken: parsed.accessToken || '',
        productionUrl: parsed.productionUrl || '',
        deployHookUrl: parsed.deployHookUrl || '',
        lastDeployedAt: parsed.lastDeployedAt || null,
        lastDeployHookTriggeredAt: parsed.lastDeployHookTriggeredAt || null,
        lastDeploymentStatus: parsed.lastDeploymentStatus || 'UNKNOWN',
        autoSyncWithVercelEdge: Boolean(parsed.autoSyncWithVercelEdge),
        autoDeployOnGitPush: parsed.autoDeployOnGitPush !== undefined ? Boolean(parsed.autoDeployOnGitPush) : true,
      };
    }
  } catch (err) {
    console.warn('Failed to parse Vercel config:', err);
  }

  return {
    projectName: 'gem-pro-generic-tracker',
    projectId: '',
    teamId: '',
    accessToken: '',
    productionUrl: '',
    deployHookUrl: '',
    lastDeployedAt: null,
    lastDeployHookTriggeredAt: null,
    lastDeploymentStatus: 'UNKNOWN',
    autoSyncWithVercelEdge: false,
    autoDeployOnGitPush: true,
  };
}

export function saveVercelConfig(update: Partial<VercelConfig>): VercelConfig {
  const current = getVercelConfig();
  const merged: VercelConfig = { ...current, ...update };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (err) {
    console.error('Failed to save Vercel config:', err);
  }
  return merged;
}

export function clearVercelConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear Vercel config:', err);
  }
}

/**
 * Generate 1-Click Vercel Deploy URL
 */
export function getVercelDeployUrl(repoUrl?: string): string {
  const base = 'https://vercel.com/new/clone';
  const targetRepo = repoUrl && repoUrl.trim()
    ? encodeURIComponent(repoUrl.trim())
    : encodeURIComponent('https://github.com/saqcivilteam/gem-pro-generic-tracker');

  return `${base}?repository-url=${targetRepo}&project-name=gem-pro-generic-tracker&framework=vite`;
}

/**
 * Verify Vercel API token and inspect project status
 */
export async function testVercelConnection(
  token: string,
  projectName?: string,
  projectId?: string
): Promise<VercelTestResult> {
  const cleanToken = token.trim();
  if (!cleanToken) {
    return { success: false, message: 'Please enter a Vercel Personal Access Token' };
  }

  try {
    // 1. Verify user / token
    const userRes = await fetch('https://api.vercel.com/v2/user', {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!userRes.ok) {
      if (userRes.status === 403 || userRes.status === 401) {
        return { success: false, message: 'Invalid Vercel Access Token. Check your token in Vercel Account Settings.' };
      }
      return { success: false, message: `Vercel API returned HTTP ${userRes.status}: ${userRes.statusText}` };
    }

    const userData = await userRes.json();
    const userName = userData.user?.name || userData.user?.username || 'Vercel User';

    // 2. If project name or ID provided, fetch project status
    const targetProject = (projectId && projectId.trim()) || (projectName && projectName.trim());
    if (targetProject) {
      const projRes = await fetch(`https://api.vercel.com/v9/projects/${targetProject}`, {
        headers: {
          Authorization: `Bearer ${cleanToken}`,
        },
        signal: AbortSignal.timeout(8000),
      });

      if (projRes.ok) {
        const projData = await projRes.json();
        const latestDep = projData.targets?.production || projData.latestDeployments?.[0];
        const prodUrl = latestDep?.url ? `https://${latestDep.url}` : '';

        saveVercelConfig({
          projectId: projData.id,
          projectName: projData.name,
          productionUrl: prodUrl || undefined,
          lastDeploymentStatus: latestDep?.readyState || 'READY',
          lastDeployedAt: latestDep?.createdAt ? new Date(latestDep.createdAt).toISOString() : undefined,
        });

        return {
          success: true,
          message: `Connected to Vercel Project "${projData.name}" (Status: ${latestDep?.readyState || 'Ready'})!`,
          project: {
            id: projData.id,
            name: projData.name,
            framework: projData.framework || 'vite',
            latestDeployment: latestDep ? {
              url: prodUrl,
              readyState: latestDep.readyState,
              createdAt: latestDep.createdAt,
            } : undefined,
          },
        };
      }
    }

    return {
      success: true,
      message: `Authenticated with Vercel account "${userName}". Ready for 1-click deployments!`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.name === 'TimeoutError'
        ? 'Connection to Vercel API timed out.'
        : (err.message || 'Network error connecting to Vercel API'),
    };
  }
}

/**
 * Trigger an instant automated production deployment via Vercel Deploy Hook.
 *
 * Deploy hooks are created in Vercel Dashboard > Project Settings > Git > Deploy Hooks.
 * When triggered via HTTP POST, Vercel pulls the latest commit from GitHub and builds the app.
 */
export async function triggerVercelDeployHook(deployHookUrl: string): Promise<{
  success: boolean;
  message: string;
  jobId?: string;
  createdAt?: string;
}> {
  const cleanUrl = deployHookUrl.trim();
  if (!cleanUrl) {
    return { success: false, message: 'Please enter a valid Vercel Deploy Hook URL' };
  }

  if (!cleanUrl.startsWith('https://api.vercel.com/v1/integrations/deploy/')) {
    return {
      success: false,
      message: 'Invalid Deploy Hook URL. Must start with https://api.vercel.com/v1/integrations/deploy/...',
    };
  }

  try {
    const res = await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok || res.status === 201 || res.status === 200) {
      let data: any = {};
      try {
        data = await res.json();
      } catch {}

      const jobId = data?.job?.id || data?.id || 'job_' + Date.now().toString(36);
      const nowIso = new Date().toISOString();

      saveVercelConfig({
        deployHookUrl: cleanUrl,
        lastDeployHookTriggeredAt: nowIso,
        lastDeploymentStatus: 'BUILDING',
      });

      return {
        success: true,
        message: 'Successfully triggered Vercel build! Production deployment queued.',
        jobId,
        createdAt: nowIso,
      };
    }

    const errText = await res.text().catch(() => '');
    return {
      success: false,
      message: `Vercel Deploy Hook returned HTTP ${res.status}: ${errText || res.statusText}`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.name === 'TimeoutError'
        ? 'Vercel Deploy Hook request timed out'
        : (err.message || 'Failed to trigger Vercel Deploy Hook'),
    };
  }
}
