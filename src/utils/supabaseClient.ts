import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Tracker } from '../types/tracker';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  tableName: string;
  autoSync: boolean;
  lastSyncedAt?: string;
  isConnected: boolean;
}

const STORAGE_KEY = 'gt_supabase_config_v1';

export function getSupabaseConfig(): SupabaseConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        url: parsed.url || '',
        anonKey: parsed.anonKey || '',
        tableName: parsed.tableName || 'trackers',
        autoSync: parsed.autoSync !== false,
        lastSyncedAt: parsed.lastSyncedAt || undefined,
        isConnected: Boolean(parsed.isConnected),
      };
    }
  } catch (e) {
    console.warn('Failed to load Supabase config from localStorage:', e);
  }
  return {
    url: '',
    anonKey: '',
    tableName: 'trackers',
    autoSync: true,
    isConnected: false,
  };
}

export function saveSupabaseConfig(config: SupabaseConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save Supabase config to localStorage:', e);
  }
}

export function clearSupabaseConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}

let cachedClient: { client: SupabaseClient; url: string; key: string } | null = null;

export function getSupabaseClient(config?: SupabaseConfig): SupabaseClient | null {
  const cfg = config || getSupabaseConfig();
  if (!cfg.url || !cfg.anonKey) return null;

  const cleanUrl = cfg.url.trim().replace(/\/+$/, '');
  const cleanKey = cfg.anonKey.trim();

  if (cachedClient && cachedClient.url === cleanUrl && cachedClient.key === cleanKey) {
    return cachedClient.client;
  }

  try {
    const client = createClient(cleanUrl, cleanKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    cachedClient = { client, url: cleanUrl, key: cleanKey };
    return client;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  tableExists: boolean;
  rowCount?: number;
}

/**
 * Test connectivity with Supabase project URL and anon public key
 */
export async function testSupabaseConnection(
  url: string,
  anonKey: string,
  tableName: string = 'trackers'
): Promise<ConnectionTestResult> {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  const cleanKey = anonKey.trim();
  const cleanTable = (tableName.trim() || 'trackers').toLowerCase();

  if (!cleanUrl || !cleanKey) {
    return {
      success: false,
      message: 'Please provide both your Supabase Project URL and Public Anon Key.',
      tableExists: false,
    };
  }

  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    return {
      success: false,
      message: 'Project URL must start with https:// (e.g. https://your-project.supabase.co)',
      tableExists: false,
    };
  }

  try {
    const client = createClient(cleanUrl, cleanKey, {
      auth: { persistSession: false },
    });

    // Test querying the specified table
    const { data, count, error } = await client
      .from(cleanTable)
      .select('id', { count: 'exact', head: true });

    if (error) {
      // Check if table does not exist
      const isMissingTable =
        error.code === '42P01' ||
        error.code === 'PGRST205' ||
        error.code === 'PGRST204' ||
        error.message?.toLowerCase().includes('relation') ||
        error.message?.toLowerCase().includes('schema cache') ||
        error.message?.toLowerCase().includes('does not exist');

      if (isMissingTable) {
        return {
          success: true, // Credentials valid, but table needs creation
          message: `Connected to Supabase project! Table '${cleanTable}' not found in schema cache yet — please run the provided SQL script in your Supabase SQL Editor.`,
          tableExists: false,
        };
      }

      // Check RLS or permission issue
      if (error.code === '42501' || error.message?.toLowerCase().includes('permission denied')) {
        return {
          success: true,
          message: `Connected, but Row-Level Security (RLS) is blocking access to '${cleanTable}'. Run the RLS policy in the SQL script.`,
          tableExists: true,
        };
      }

      return {
        success: false,
        message: `Supabase Error (${error.code || 'API'}): ${error.message}`,
        tableExists: false,
      };
    }

    return {
      success: true,
      message: `Successfully connected to Supabase! Table '${cleanTable}' is active with ${count ?? 0} saved trackers.`,
      tableExists: true,
      rowCount: count ?? 0,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Connection failed: ${err.message || 'Could not reach Supabase endpoint'}`,
      tableExists: false,
    };
  }
}

/**
 * Upsert all trackers or single tracker to Supabase table
 */
export async function saveTrackersToSupabase(
  trackers: Tracker[],
  config?: SupabaseConfig
): Promise<{ success: boolean; count: number; error?: string }> {
  const cfg = config || getSupabaseConfig();
  const client = getSupabaseClient(cfg);

  if (!client) {
    return { success: false, count: 0, error: 'Supabase client not initialized or credentials missing.' };
  }

  const tableName = (cfg.tableName || 'trackers').trim().toLowerCase();

  try {
    const records = trackers.map((t) => ({
      id: t.id,
      name: t.name,
      folder_id: t.folderId || null,
      description: t.description || '',
      columns: t.columns || [],
      rows: t.rows || [],
      frozen_columns: t.frozenColumns ?? 2,
      status_options: t.statusOptions || [],
      dashboard_cards: t.dashboardCards || [],
      appearance: t.appearance || {},
      is_locked: Boolean(t.isLocked),
      require_admin_approval_for_edits: Boolean(t.requireAdminApprovalForEdits),
      created_at: t.createdAt || new Date().toISOString(),
      updated_at: t.updatedAt || new Date().toISOString(),
    }));

    const { error } = await client.from(tableName).upsert(records, {
      onConflict: 'id',
    });

    if (error) {
      const isMissingTable =
        error.code === 'PGRST205' ||
        error.code === '42P01' ||
        error.code === 'PGRST204' ||
        error.message?.toLowerCase().includes('schema cache') ||
        error.message?.toLowerCase().includes('relation') ||
        error.message?.toLowerCase().includes('does not exist');

      if (isMissingTable) {
        console.warn(`Supabase notice: Table '${tableName}' is not in the schema cache yet. Run the SQL schema script in your Supabase SQL Editor.`);
        return {
          success: false,
          count: 0,
          error: `Table '${tableName}' not found in Supabase schema cache. Run the SQL script in Supabase modal.`,
        };
      }

      console.warn('Supabase upsert notice:', error.message);
      return { success: false, count: 0, error: error.message };
    }

    // Update last synced at
    saveSupabaseConfig({
      ...cfg,
      lastSyncedAt: new Date().toISOString(),
      isConnected: true,
    });

    return { success: true, count: trackers.length };
  } catch (err: any) {
    console.warn('Supabase sync notice:', err?.message || err);
    return { success: false, count: 0, error: err?.message || 'Unknown network error' };
  }
}

/**
 * Pull trackers from Supabase
 */
export async function loadTrackersFromSupabase(
  config?: SupabaseConfig
): Promise<{ success: boolean; trackers: Tracker[]; error?: string }> {
  const cfg = config || getSupabaseConfig();
  const client = getSupabaseClient(cfg);

  if (!client) {
    return { success: false, trackers: [], error: 'Supabase is not configured.' };
  }

  const tableName = (cfg.tableName || 'trackers').trim().toLowerCase();

  try {
    const { data, error } = await client
      .from(tableName)
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      return { success: false, trackers: [], error: error.message };
    }

    if (!Array.isArray(data)) {
      return { success: true, trackers: [] };
    }

    const parsedTrackers: Tracker[] = data.map((item: any) => ({
      id: item.id,
      name: item.name || 'Untitled Tracker',
      folderId: item.folder_id || 'folder_civil',
      description: item.description || 'Customizable Excel-style tracker with SLA and document management.',
      columns: Array.isArray(item.columns) ? item.columns : [],
      rows: Array.isArray(item.rows) ? item.rows : [],
      frozenColumns: typeof item.frozen_columns === 'number' ? item.frozen_columns : 2,
      statusOptions: Array.isArray(item.status_options)
        ? item.status_options
        : [
            { label: 'Site Hunting', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' },
            { label: 'Under Review', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
            { label: 'Pre-Con', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
            { label: 'Completed', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
            { label: 'Delayed / Critical', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
          ],
      dashboardCards: Array.isArray(item.dashboard_cards) ? item.dashboard_cards : [],
      appearance: item.appearance || undefined,
      isLocked: Boolean(item.is_locked),
      requireAdminApprovalForEdits: Boolean(item.require_admin_approval_for_edits),
      createdAt: item.created_at || new Date().toISOString(),
      updatedAt: item.updated_at || new Date().toISOString(),
    }));

    return { success: true, trackers: parsedTrackers };
  } catch (err: any) {
    return { success: false, trackers: [], error: err.message || 'Failed to pull from Supabase' };
  }
}

/**
 * Generate copy-ready SQL schema for the user's Supabase SQL Editor
 */
export function getSupabaseSqlSchema(tableName: string = 'trackers'): string {
  const table = (tableName.trim() || 'trackers').toLowerCase();
  return `-- ==========================================
-- GEM PRO Tracker System - Supabase Schema
-- Copy and run this in your Supabase SQL Editor:
-- ==========================================

-- 1. Create table for storing tracker sheets and rows
create table if not exists public.${table} (
  id text primary key,
  name text not null,
  folder_id text,
  description text default '',
  columns jsonb not null default '[]'::jsonb,
  rows jsonb not null default '[]'::jsonb,
  frozen_columns integer default 2,
  status_options jsonb default '[]'::jsonb,
  dashboard_cards jsonb default '[]'::jsonb,
  appearance jsonb default '{}'::jsonb,
  is_locked boolean default false,
  require_admin_approval_for_edits boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Enable Row Level Security (RLS)
alter table public.${table} enable row level security;

-- 3. Policy: Allow read & write access for authenticated & anonymous web sessions
drop policy if exists "Allow public access to ${table}" on public.${table};
create policy "Allow public access to ${table}"
  on public.${table}
  for all
  using (true)
  with check (true);

-- 4. Enable real-time replication (optional, for Supabase Realtime broadcast)
alter publication supabase_realtime add table public.${table};
`;
}
