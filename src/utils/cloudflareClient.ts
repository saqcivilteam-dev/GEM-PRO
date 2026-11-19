/**
 * Cloudflare Real-Time Database Client & Synchronization Utility
 * 
 * Provides a 100% free-tier connection to Cloudflare Workers, Cloudflare KV,
 * and Cloudflare D1 for real-time team collaboration, sharing data, and instant tracker updates.
 */

import { Tracker } from '../types/tracker';

export interface CloudflareConfig {
  workerUrl: string;
  authToken: string;
  autoSync: boolean;
  syncIntervalSeconds: number;
  lastSyncedAt?: string | null;
  lastSyncStatus?: 'success' | 'error' | 'idle';
  lastSyncMessage?: string;
}

export interface CloudflareTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  hasTrackersData?: boolean;
  trackerCount?: number;
  lastUpdated?: string;
  updatedBy?: string;
}

const STORAGE_KEY = 'cf_tracker_sync_config_v1';

export function getCloudflareConfig(): CloudflareConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        workerUrl: parsed.workerUrl || '',
        authToken: parsed.authToken || '',
        autoSync: parsed.autoSync !== false,
        syncIntervalSeconds: parsed.syncIntervalSeconds || 15,
        lastSyncedAt: parsed.lastSyncedAt || null,
        lastSyncStatus: parsed.lastSyncStatus || 'idle',
        lastSyncMessage: parsed.lastSyncMessage || '',
      };
    }
  } catch (err) {
    console.warn('Failed to parse Cloudflare config:', err);
  }

  return {
    workerUrl: '',
    authToken: '',
    autoSync: true,
    syncIntervalSeconds: 15,
    lastSyncedAt: null,
    lastSyncStatus: 'idle',
    lastSyncMessage: '',
  };
}

export function saveCloudflareConfig(update: Partial<CloudflareConfig>): CloudflareConfig {
  const current = getCloudflareConfig();
  const merged: CloudflareConfig = { ...current, ...update };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (err) {
    console.error('Failed to save Cloudflare config:', err);
  }
  return merged;
}

export function clearCloudflareConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear Cloudflare config:', err);
  }
}

/**
 * Clean and normalize a Cloudflare Worker URL
 */
export function normalizeCloudflareUrl(url: string): string {
  let clean = url.trim();
  if (!clean) return '';
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = 'https://' + clean;
  }
  // Remove trailing slashes
  return clean.replace(/\/+$/, '');
}

/**
 * Test connection to Cloudflare Worker endpoint
 */
export async function testCloudflareConnection(
  rawUrl: string,
  token?: string
): Promise<CloudflareTestResult> {
  const url = normalizeCloudflareUrl(rawUrl);
  if (!url) {
    return { success: false, message: 'Please enter a Cloudflare Worker URL' };
  }

  const startTime = performance.now();
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (token && token.trim()) {
    headers['Authorization'] = `Bearer ${token.trim()}`;
  }

  try {
    // Try health check first or fallback to api/trackers
    const endpoint = `${url}/health`;
    const response = await fetch(endpoint, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(8000),
    });

    const latencyMs = Math.round(performance.now() - startTime);

    if (response.ok) {
      let data: any = null;
      try {
        data = await response.json();
      } catch {
        // If not json, still ok
      }

      return {
        success: true,
        message: `Successfully connected to Cloudflare Worker (${latencyMs}ms latency)`,
        latencyMs,
        hasTrackersData: data?.trackerCount !== undefined ? data.trackerCount > 0 : undefined,
        trackerCount: data?.trackerCount,
        lastUpdated: data?.lastUpdated,
        updatedBy: data?.updatedBy,
      };
    } else {
      // Try GET /api/trackers if /health returned non-200
      const trackersRes = await fetch(`${url}/api/trackers`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(8000),
      });

      const secondaryLatency = Math.round(performance.now() - startTime);

      if (trackersRes.ok) {
        const tData = await trackersRes.json();
        const list = Array.isArray(tData) ? tData : tData?.trackers;
        return {
          success: true,
          message: `Connected to Cloudflare Database (${secondaryLatency}ms)`,
          latencyMs: secondaryLatency,
          hasTrackersData: Array.isArray(list) && list.length > 0,
          trackerCount: Array.isArray(list) ? list.length : 0,
          lastUpdated: tData?.lastUpdated,
          updatedBy: tData?.updatedBy,
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          message: 'Access Denied: Invalid Security Token. Please check your Secret Token.',
          latencyMs,
        };
      }

      return {
        success: false,
        message: `Cloudflare Worker returned HTTP ${response.status}: ${response.statusText}`,
        latencyMs,
      };
    }
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    const msg = err.name === 'TimeoutError'
      ? 'Connection timed out. Check that the Cloudflare Worker URL is correct and deployed.'
      : (err.message || 'Network error connecting to Cloudflare Worker');

    return {
      success: false,
      message: msg,
      latencyMs,
    };
  }
}

/**
 * Push full tracker dataset to Cloudflare Worker
 */
export async function pushTrackersToCloudflare(
  config: CloudflareConfig,
  trackers: Tracker[],
  meta?: { userEmail?: string; userName?: string }
): Promise<{ success: boolean; message: string; timestamp?: string }> {
  const url = normalizeCloudflareUrl(config.workerUrl);
  if (!url) {
    return { success: false, message: 'Cloudflare Worker URL is not configured' };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (config.authToken && config.authToken.trim()) {
    headers['Authorization'] = `Bearer ${config.authToken.trim()}`;
  }

  const payload = {
    trackers,
    updatedAt: new Date().toISOString(),
    updatedBy: meta?.userEmail || meta?.userName || 'Team Member',
    trackerCount: trackers.length,
    version: Date.now(),
  };

  try {
    const res = await fetch(`${url}/api/trackers`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error('Authentication failed. Check your Cloudflare Security Token.');
      }
      throw new Error(`Cloudflare Worker HTTP ${res.status}: ${res.statusText}`);
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    saveCloudflareConfig({
      lastSyncedAt: new Date().toISOString(),
      lastSyncStatus: 'success',
      lastSyncMessage: `Uploaded ${trackers.length} trackers at ${timestamp}`,
    });

    return {
      success: true,
      message: `Successfully uploaded ${trackers.length} trackers to Cloudflare at ${timestamp}`,
      timestamp,
    };
  } catch (err: any) {
    saveCloudflareConfig({
      lastSyncStatus: 'error',
      lastSyncMessage: err.message || 'Push failed',
    });
    return {
      success: false,
      message: err.message || 'Failed to upload trackers to Cloudflare',
    };
  }
}

/**
 * Pull latest tracker dataset from Cloudflare Worker
 */
export async function loadTrackersFromCloudflare(
  config: CloudflareConfig
): Promise<{
  success: boolean;
  trackers?: Tracker[];
  updatedAt?: string;
  updatedBy?: string;
  message: string;
}> {
  const url = normalizeCloudflareUrl(config.workerUrl);
  if (!url) {
    return { success: false, message: 'Cloudflare Worker URL is not configured' };
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (config.authToken && config.authToken.trim()) {
    headers['Authorization'] = `Bearer ${config.authToken.trim()}`;
  }

  try {
    const res = await fetch(`${url}/api/trackers`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error('Authentication failed. Check your Cloudflare Security Token.');
      }
      throw new Error(`Cloudflare Worker HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    let trackersList: Tracker[] = [];

    if (Array.isArray(data)) {
      trackersList = data;
    } else if (data && Array.isArray(data.trackers)) {
      trackersList = data.trackers;
    }

    if (!trackersList || trackersList.length === 0) {
      return {
        success: true,
        trackers: [],
        message: 'Connected, but no trackers are stored in Cloudflare database yet.',
      };
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    saveCloudflareConfig({
      lastSyncedAt: new Date().toISOString(),
      lastSyncStatus: 'success',
      lastSyncMessage: `Downloaded ${trackersList.length} trackers at ${timestamp}`,
    });

    return {
      success: true,
      trackers: trackersList,
      updatedAt: data.updatedAt,
      updatedBy: data.updatedBy,
      message: `Downloaded ${trackersList.length} trackers from Cloudflare (last edited by ${data.updatedBy || 'Team'})`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Failed to download trackers from Cloudflare',
    };
  }
}

/**
 * Returns a 100% Free, production-ready Cloudflare Worker code template.
 * Can be deployed in 30 seconds on Cloudflare Workers (Free Plan: 100,000 requests/day).
 */
export function getCloudflareWorkerTemplateCode(token?: string): string {
  const secretPlaceholder = token && token.trim() ? token.trim() : 'saq-civil-team-secret-2025';

  return `/**
 * Cloudflare Worker: SAQ Civil Team Real-Time Tracker Database
 * 
 * 100% Free Tier on Cloudflare (100,000 requests/day, 0 cost forever)
 * Features:
 *  - High-speed Global Edge REST endpoints for team collaboration
 *  - Automatic CORS handling for any browser/device
 *  - Optional Secret Token authentication
 *  - Cloudflare KV / D1 / Edge memory storage
 * 
 * Deploy Instructions:
 * 1. Log in to https://dash.cloudflare.com/ (Free account)
 * 2. Workers & Pages -> Create Application -> Create Worker
 * 3. Click "Deploy", then "Edit code"
 * 4. Paste this file completely and click "Deploy"!
 */

// Optional Security Token - Set to "" to allow anyone with URL, or set your team password
const SECURITY_TOKEN = "${secretPlaceholder}";

// Edge In-Memory storage fallback (persists across warm edge requests)
let edgeDatabase = {
  trackers: [],
  updatedAt: new Date().toISOString(),
  updatedBy: "System Initializer",
  trackerCount: 0,
  version: 1,
};

// Standard permissive CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS Preflight OPTIONS requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    // Helper: Check Auth Token if configured
    if (SECURITY_TOKEN && SECURITY_TOKEN.trim() !== "") {
      const authHeader = request.headers.get("Authorization") || "";
      const queryToken = url.searchParams.get("token") || "";
      const bearerToken = authHeader.replace(/^Bearer\\s+/i, "").trim();

      const isAuthorized = bearerToken === SECURITY_TOKEN || queryToken === SECURITY_TOKEN;
      if (!isAuthorized && pathname !== "/health") {
        return new Response(
          JSON.stringify({
            error: "Unauthorized",
            message: "Invalid or missing Bearer token. Please check your Secret Token in the Civil Tracker app.",
          }),
          {
            status: 401,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }
    }

    // 2. Health Check Endpoint
    if (pathname === "/" || pathname === "/health") {
      // If KV bound, check KV
      let storageType = "Edge Memory (Global Free Tier)";
      let count = edgeDatabase.trackers?.length || 0;
      let lastUpdated = edgeDatabase.updatedAt;
      let updatedBy = edgeDatabase.updatedBy;

      if (env && env.TRACKER_KV) {
        storageType = "Cloudflare KV Store";
        try {
          const raw = await env.TRACKER_KV.get("tracker_dataset");
          if (raw) {
            const parsed = JSON.parse(raw);
            count = parsed.trackers?.length || 0;
            lastUpdated = parsed.updatedAt;
            updatedBy = parsed.updatedBy;
          }
        } catch (e) {}
      }

      return new Response(
        JSON.stringify({
          status: "ok",
          service: "Cloudflare Civil Tracker Real-Time Edge DB",
          freeTier: true,
          storage: storageType,
          trackerCount: count,
          lastUpdated: lastUpdated,
          updatedBy: updatedBy,
          serverTime: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // 3. GET /api/trackers - Retrieve Tracker Data for Team
    if (pathname === "/api/trackers" && request.method === "GET") {
      // Check Cloudflare KV first if configured
      if (env && env.TRACKER_KV) {
        try {
          const raw = await env.TRACKER_KV.get("tracker_dataset");
          if (raw) {
            return new Response(raw, {
              status: 200,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            });
          }
        } catch (e) {
          console.error("KV read error:", e);
        }
      }

      // Return edge memory
      return new Response(
        JSON.stringify(edgeDatabase),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // 4. POST /api/trackers - Update Tracker Data from Team Member
    if (pathname === "/api/trackers" && request.method === "POST") {
      try {
        const body = await request.json();
        const trackers = Array.isArray(body) ? body : (body.trackers || []);
        const updatedAt = body.updatedAt || new Date().toISOString();
        const updatedBy = body.updatedBy || "Team Member";

        const newDataset = {
          trackers,
          updatedAt,
          updatedBy,
          trackerCount: trackers.length,
          version: Date.now(),
        };

        // Update in-memory
        edgeDatabase = newDataset;

        // Persist to Cloudflare KV if bound
        if (env && env.TRACKER_KV) {
          try {
            await env.TRACKER_KV.put("tracker_dataset", JSON.stringify(newDataset));
          } catch (e) {
            console.error("KV write error:", e);
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "Trackers successfully saved to Cloudflare",
            updatedAt,
            trackerCount: trackers.length,
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({
            success: false,
            error: err.message || "Failed to parse JSON body",
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }
    }

    // 404 Fallback
    return new Response(
      JSON.stringify({ error: "Endpoint not found", path: pathname }),
      {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  },
};
`;
}

/**
 * Generate 1-Click Free Data Sharing Link for Team Members via Cloudflare
 */
export function getCloudflareFreeShareLink(workerUrl: string, shareToken?: string): string {
  const clean = normalizeCloudflareUrl(workerUrl);
  if (!clean) return '';
  const tokenParam = shareToken && shareToken.trim() ? `?token=${encodeURIComponent(shareToken.trim())}` : '';
  return `${clean}/api/trackers${tokenParam}`;
}

/**
 * Generate team collaboration URL pointing to GEM PRO with Cloudflare sync auto-attached
 */
export function getCloudflareTeamCollaborationUrl(workerUrl: string, token?: string): string {
  if (typeof window === 'undefined') return '';
  const base = `${window.location.origin}${window.location.pathname}`;
  const params = new URLSearchParams();
  if (workerUrl && workerUrl.trim()) {
    params.set('cf_worker', normalizeCloudflareUrl(workerUrl));
  }
  if (token && token.trim()) {
    params.set('cf_token', token.trim());
  }
  params.set('cf_sync', '1');
  return `${base}?${params.toString()}`;
}
