import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Tracker, TrackerFolder, UserAccount, SiteVisitRecord } from '../types/tracker';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  tableName: string;
  autoSync: boolean;
  autoUploadFiles: boolean;
  storageBucket: string;
  backupBucket: string;
  lastSyncedAt?: string;
  isConnected: boolean;
}

export interface SupabaseBackupRecord {
  id: string;
  name: string;
  note?: string;
  file_size?: string;
  total_trackers: number;
  total_rows: number;
  storage_path?: string;
  public_url?: string;
  payload?: any;
  created_at: string;
}

export interface SupabaseFileRecord {
  id: string;
  file_name: string;
  file_type: 'image' | 'pdf';
  mime_type: string;
  file_size?: string;
  storage_path?: string;
  public_url?: string;
  data_url?: string;
  tracker_id?: string;
  tracker_name?: string;
  row_id?: string;
  site_name?: string;
  col_id?: string;
  source?: string;
  uploaded_at: string;
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
        autoUploadFiles: parsed.autoUploadFiles !== false,
        storageBucket: parsed.storageBucket || 'tracker-files',
        backupBucket: parsed.backupBucket || 'tracker-backups',
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
    autoUploadFiles: true,
    storageBucket: 'tracker-files',
    backupBucket: 'tracker-backups',
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
  backupsTableExists?: boolean;
  filesTableExists?: boolean;
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

    const { count, error } = await client
      .from(cleanTable)
      .select('id', { count: 'exact', head: true });

    const { error: backupsErr } = await client
      .from('tracker_backups')
      .select('id', { count: 'exact', head: true });

    const { error: filesErr } = await client
      .from('tracker_files')
      .select('id', { count: 'exact', head: true });

    if (error) {
      const isMissingTable =
        error.code === '42P01' ||
        error.code === 'PGRST205' ||
        error.code === 'PGRST204' ||
        error.message?.toLowerCase().includes('relation') ||
        error.message?.toLowerCase().includes('schema cache') ||
        error.message?.toLowerCase().includes('does not exist');

      if (isMissingTable) {
        return {
          success: true,
          message: `Connected to Supabase project! Please run the 1-Click SQL Script in the "SQL & Bucket Setup" tab to create tables & file storage.`,
          tableExists: false,
          backupsTableExists: !backupsErr,
          filesTableExists: !filesErr,
        };
      }

      if (error.code === '42501' || error.message?.toLowerCase().includes('permission denied')) {
        return {
          success: true,
          message: `Connected, but Row-Level Security (RLS) is blocking access to '${cleanTable}'. Run the RLS policy in the SQL script.`,
          tableExists: true,
          backupsTableExists: !backupsErr,
          filesTableExists: !filesErr,
        };
      }

      return {
        success: false,
        message: `Supabase Error (${error.code || 'API'}): ${error.message}`,
        tableExists: false,
      };
    }

    const extraMissing: string[] = [];
    if (backupsErr) extraMissing.push('tracker_backups');
    if (filesErr) extraMissing.push('tracker_files');

    return {
      success: true,
      message:
        extraMissing.length > 0
          ? `Connected to Supabase (${count ?? 0} trackers). Run the updated SQL script to enable ${extraMissing.join(' & ')}.`
          : `Successfully connected to Supabase! Trackers (${count ?? 0}), Backups & Auto File Storage (JPEG/JPG/PDF) are active.`,
      tableExists: true,
      backupsTableExists: !backupsErr,
      filesTableExists: !filesErr,
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
        return {
          success: false,
          count: 0,
          error: `Table '${tableName}' not found in Supabase. Run the SQL script in the SQL & Bucket Setup tab.`,
        };
      }

      return { success: false, count: 0, error: error.message };
    }

    saveSupabaseConfig({
      ...cfg,
      lastSyncedAt: new Date().toISOString(),
      isConnected: true,
    });

    return { success: true, count: trackers.length };
  } catch (err: any) {
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

// =========================================================================
// BACKUP FILES PUSH & PULL (JSON SNAPSHOTS -> SUPABASE STORAGE + POSTGRES)
// =========================================================================

function formatFileBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Push a full backup snapshot (.json) to Supabase (Storage bucket + tracker_backups table)
 */
export async function pushBackupToSupabase(
  backupData: {
    trackers: Tracker[];
    folders?: TrackerFolder[];
    users?: UserAccount[];
    visits?: SiteVisitRecord[];
  },
  options?: {
    fileName?: string;
    note?: string;
    rawPayload?: any;
  },
  config?: SupabaseConfig
): Promise<{ success: boolean; backup?: SupabaseBackupRecord; error?: string }> {
  const cfg = config || getSupabaseConfig();
  const client = getSupabaseClient(cfg);
  if (!client) {
    return { success: false, error: 'Supabase is not connected. Enter your URL & Anon Key first.' };
  }

  const now = new Date();
  const timestampSlug = now.toISOString().replace(/[:.]/g, '-');
  const fileName = options?.fileName || `GEM_PRO_Backup_${timestampSlug}.json`;
  const id = `bkp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const payload = options?.rawPayload || {
    version: '1.4.0',
    exportedAt: now.toISOString(),
    generator: 'GEM PRO Generic Tracker System (Supabase Backup)',
    note: options?.note || '',
    data: {
      trackers: backupData.trackers || [],
      folders: backupData.folders || [],
      users: backupData.users || [],
      visits: backupData.visits || [],
    },
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const fileSize = formatFileBytes(blob.size);
  const totalTrackers = backupData.trackers?.length || 0;
  const totalRows = (backupData.trackers || []).reduce(
    (sum, t) => sum + (Array.isArray(t.rows) ? t.rows.length : 0),
    0
  );

  // 1. Try uploading binary JSON file to Supabase Storage bucket (`tracker-backups`)
  let storagePath: string | undefined;
  let publicUrl: string | undefined;
  const backupBucket = (cfg.backupBucket || 'tracker-backups').trim();

  try {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `backups/${Date.now()}_${safeName}`;
    const { error: uploadErr } = await client.storage.from(backupBucket).upload(path, blob, {
      contentType: 'application/json',
      upsert: true,
    });
    if (!uploadErr) {
      storagePath = path;
      const { data: urlData } = client.storage.from(backupBucket).getPublicUrl(path);
      publicUrl = urlData?.publicUrl;
    }
  } catch {
    // Storage bucket optional; Postgres table handles backup reliably
  }

  // 2. Save metadata + full JSON payload in `tracker_backups` table
  const record: SupabaseBackupRecord = {
    id,
    name: fileName,
    note: options?.note || `${totalTrackers} sheets · ${totalRows} rows`,
    file_size: fileSize,
    total_trackers: totalTrackers,
    total_rows: totalRows,
    storage_path: storagePath,
    public_url: publicUrl,
    payload,
    created_at: now.toISOString(),
  };

  try {
    const { error } = await client.from('tracker_backups').upsert(record, { onConflict: 'id' });
    if (error) {
      return {
        success: false,
        error: error.message.includes('tracker_backups')
          ? 'Table "tracker_backups" not found. Run the SQL script in the "SQL & Bucket Setup" tab.'
          : error.message,
      };
    }

    saveSupabaseConfig({
      ...cfg,
      lastSyncedAt: now.toISOString(),
      isConnected: true,
    });

    return { success: true, backup: record };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to push backup to Supabase' };
  }
}

/**
 * List all backup files stored in Supabase
 */
export async function listSupabaseBackups(
  config?: SupabaseConfig
): Promise<{ success: boolean; backups: SupabaseBackupRecord[]; error?: string }> {
  const cfg = config || getSupabaseConfig();
  const client = getSupabaseClient(cfg);
  if (!client) {
    return { success: false, backups: [], error: 'Supabase is not configured.' };
  }

  try {
    const { data, error } = await client
      .from('tracker_backups')
      .select('id, name, note, file_size, total_trackers, total_rows, storage_path, public_url, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return { success: false, backups: [], error: error.message };
    }
    return { success: true, backups: (data as SupabaseBackupRecord[]) || [] };
  } catch (err: any) {
    return { success: false, backups: [], error: err?.message || 'Failed to fetch backups' };
  }
}

/**
 * Pull a specific backup snapshot from Supabase and extract trackers/folders/users/visits
 */
export async function pullBackupFromSupabase(
  backupId: string,
  config?: SupabaseConfig
): Promise<{
  success: boolean;
  data?: {
    trackers: Tracker[];
    folders: TrackerFolder[];
    users: UserAccount[];
    visits: SiteVisitRecord[];
  };
  rawPayload?: any;
  name?: string;
  error?: string;
}> {
  const cfg = config || getSupabaseConfig();
  const client = getSupabaseClient(cfg);
  if (!client) {
    return { success: false, error: 'Supabase is not configured.' };
  }

  try {
    const { data: row, error } = await client
      .from('tracker_backups')
      .select('*')
      .eq('id', backupId)
      .single();

    if (error || !row) {
      return { success: false, error: error?.message || 'Backup record not found in Supabase.' };
    }

    let parsed = row.payload;

    // Fallback: download from storage bucket if payload column was empty
    if (!parsed && row.storage_path) {
      const backupBucket = (cfg.backupBucket || 'tracker-backups').trim();
      const { data: blob, error: dlErr } = await client.storage.from(backupBucket).download(row.storage_path);
      if (!dlErr && blob) {
        const text = await blob.text();
        parsed = JSON.parse(text);
      }
    }

    if (!parsed) {
      return { success: false, error: 'Backup payload is empty.' };
    }

    let trackers: Tracker[] = [];
    let folders: TrackerFolder[] = [];
    let users: UserAccount[] = [];
    let visits: SiteVisitRecord[] = [];

    if (parsed?.data && Array.isArray(parsed.data.trackers)) {
      trackers = parsed.data.trackers;
      folders = Array.isArray(parsed.data.folders) ? parsed.data.folders : [];
      users = Array.isArray(parsed.data.users) ? parsed.data.users : [];
      visits = Array.isArray(parsed.data.visits) ? parsed.data.visits : [];
    } else if (Array.isArray(parsed?.trackers)) {
      trackers = parsed.trackers;
      folders = Array.isArray(parsed.folders) ? parsed.folders : [];
      users = Array.isArray(parsed.users) ? parsed.users : [];
      visits = Array.isArray(parsed.visits) ? parsed.visits : [];
    } else if (Array.isArray(parsed)) {
      trackers = parsed;
    }

    if (!trackers || trackers.length === 0) {
      return { success: false, error: 'No tracker sheets found inside backup file.' };
    }

    return {
      success: true,
      data: { trackers, folders, users, visits },
      rawPayload: parsed,
      name: row.name,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to pull backup from Supabase' };
  }
}

/**
 * Delete a backup file from Supabase
 */
export async function deleteSupabaseBackup(
  backupId: string,
  storagePath?: string,
  config?: SupabaseConfig
): Promise<{ success: boolean; error?: string }> {
  const cfg = config || getSupabaseConfig();
  const client = getSupabaseClient(cfg);
  if (!client) return { success: false, error: 'Supabase not configured.' };

  try {
    if (storagePath) {
      const backupBucket = (cfg.backupBucket || 'tracker-backups').trim();
      await client.storage.from(backupBucket).remove([storagePath]).catch(() => {});
    }
    const { error } = await client.from('tracker_backups').delete().eq('id', backupId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Delete failed' };
  }
}

// =========================================================================
// AUTOMATIC UPLOADED FILES (JPEG, JPG, PNG, PDF) -> SUPABASE STORAGE + DB
// =========================================================================

function dataUrlToBlob(dataUrl: string, fallbackMime: string = 'application/octet-stream'): Blob {
  const parts = dataUrl.split(',');
  if (parts.length < 2) {
    return new Blob([dataUrl], { type: fallbackMime });
  }
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : fallbackMime;
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export interface UploadFileParams {
  file?: File | Blob;
  dataUrl?: string;
  fileName: string;
  mimeType?: string;
  fileSize?: string;
  trackerId?: string;
  trackerName?: string;
  rowId?: string;
  siteName?: string;
  colId?: string;
  source?: string;
  force?: boolean;
}

/**
 * Automatically save any uploaded JPEG, JPG, PNG, or PDF file to Supabase Storage & `tracker_files` table
 */
export async function uploadFileToSupabase(
  params: UploadFileParams,
  config?: SupabaseConfig
): Promise<{ success: boolean; record?: SupabaseFileRecord; publicUrl?: string; error?: string }> {
  const cfg = config || getSupabaseConfig();
  if (!cfg.url || !cfg.anonKey) {
    return { success: false, error: 'Supabase account not connected.' };
  }
  if (!params.force && cfg.autoUploadFiles === false) {
    return { success: false, error: 'Auto-upload files is turned off.' };
  }

  const client = getSupabaseClient(cfg);
  if (!client) {
    return { success: false, error: 'Supabase client could not initialize.' };
  }

  const fileName = params.fileName || 'uploaded_file.jpg';
  const lower = fileName.toLowerCase();
  const isPdf = lower.endsWith('.pdf') || params.mimeType === 'application/pdf' || params.dataUrl?.startsWith('data:application/pdf');
  const fileType: 'image' | 'pdf' = isPdf ? 'pdf' : 'image';
  const mimeType =
    params.mimeType ||
    (isPdf ? 'application/pdf' : lower.endsWith('.png') ? 'image/png' : 'image/jpeg');

  let blob: Blob | null = null;
  if (params.file) {
    blob = params.file;
  } else if (params.dataUrl && params.dataUrl.startsWith('data:')) {
    blob = dataUrlToBlob(params.dataUrl, mimeType);
  }

  const sizeBytes = blob ? blob.size : 0;
  const fileSize = params.fileSize || formatFileBytes(sizeBytes);
  const bucket = (cfg.storageBucket || 'tracker-files').trim();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `uploads/${params.trackerId || 'general'}/${Date.now()}_${safeName}`;

  let publicUrl: string | undefined;

  // 1. Upload binary file to Supabase Storage bucket (`tracker-files`)
  if (blob) {
    try {
      const { error: uploadErr } = await client.storage.from(bucket).upload(storagePath, blob, {
        contentType: mimeType,
        upsert: true,
      });
      if (!uploadErr) {
        const { data: urlData } = client.storage.from(bucket).getPublicUrl(storagePath);
        publicUrl = urlData?.publicUrl;
      }
    } catch {
      // Fallback to data_url in Postgres table if bucket isn't ready yet
    }
  }

  // 2. Record file entry in `tracker_files` Postgres table
  const id = `file_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const shouldStoreInlineDataUrl = Boolean(params.dataUrl && (!publicUrl || params.dataUrl.length < 1_800_000));

  const record: SupabaseFileRecord = {
    id,
    file_name: fileName,
    file_type: fileType,
    mime_type: mimeType,
    file_size: fileSize,
    storage_path: publicUrl ? storagePath : undefined,
    public_url: publicUrl,
    data_url: shouldStoreInlineDataUrl ? params.dataUrl : undefined,
    tracker_id: params.trackerId || '',
    tracker_name: params.trackerName || '',
    row_id: params.rowId || '',
    site_name: params.siteName || '',
    col_id: params.colId || '',
    source: params.source || 'Upload',
    uploaded_at: new Date().toISOString(),
  };

  try {
    const { error } = await client.from('tracker_files').upsert(record, { onConflict: 'id' });
    if (error) {
      return {
        success: false,
        publicUrl,
        error: error.message.includes('tracker_files')
          ? 'Table "tracker_files" not found. Run the SQL script in SQL & Bucket Setup.'
          : error.message,
      };
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('supabase-file-uploaded', { detail: record }));
    }

    return { success: true, record, publicUrl };
  } catch (err: any) {
    return { success: false, publicUrl, error: err?.message || 'Failed to save file to Supabase' };
  }
}

/**
 * List all uploaded JPEG, JPG, PNG, and PDF files stored in Supabase
 */
export async function listSupabaseUploadedFiles(
  config?: SupabaseConfig
): Promise<{ success: boolean; files: SupabaseFileRecord[]; error?: string }> {
  const cfg = config || getSupabaseConfig();
  const client = getSupabaseClient(cfg);
  if (!client) {
    return { success: false, files: [], error: 'Supabase is not configured.' };
  }

  try {
    const { data, error } = await client
      .from('tracker_files')
      .select('*')
      .order('uploaded_at', { ascending: false })
      .limit(200);

    if (error) {
      return { success: false, files: [], error: error.message };
    }
    return { success: true, files: (data as SupabaseFileRecord[]) || [] };
  } catch (err: any) {
    return { success: false, files: [], error: err?.message || 'Failed to fetch uploaded files' };
  }
}

/**
 * Delete a saved uploaded file from Supabase
 */
export async function deleteSupabaseUploadedFile(
  fileId: string,
  storagePath?: string,
  config?: SupabaseConfig
): Promise<{ success: boolean; error?: string }> {
  const cfg = config || getSupabaseConfig();
  const client = getSupabaseClient(cfg);
  if (!client) return { success: false, error: 'Supabase not configured.' };

  try {
    if (storagePath) {
      const bucket = (cfg.storageBucket || 'tracker-files').trim();
      await client.storage.from(bucket).remove([storagePath]).catch(() => {});
    }
    const { error } = await client.from('tracker_files').delete().eq('id', fileId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete file' };
  }
}

/**
 * Scan all trackers and push ALL existing uploaded JPEG, JPG, PNG, and PDF files to Supabase
 */
export async function pushAllExistingFilesToSupabase(
  trackers: Tracker[],
  onProgress?: (current: number, total: number, fileName: string) => void,
  config?: SupabaseConfig
): Promise<{ success: boolean; uploadedCount: number; failedCount: number; totalFound: number; error?: string }> {
  const cfg = config || getSupabaseConfig();
  const client = getSupabaseClient(cfg);
  if (!client) {
    return { success: false, uploadedCount: 0, failedCount: 0, totalFound: 0, error: 'Supabase is not connected.' };
  }

  const itemsToUpload: UploadFileParams[] = [];
  const seenKeys = new Set<string>();

  for (const tracker of trackers) {
    for (const row of tracker.rows || []) {
      const siteName = String(row.values?.site_name || row.siteId || 'Site');

      // 1. Cell values (Image / PDF columns)
      for (const [colId, val] of Object.entries(row.values || {})) {
        if (val && typeof val === 'object' && typeof (val as any).url === 'string') {
          const fileVal = val as any;
          const url = fileVal.url as string;
          const name = fileVal.name || `${siteName}_${colId}.${fileVal.type === 'pdf' ? 'pdf' : 'jpg'}`;
          const key = `${tracker.id}_${row.id}_${name}`;
          if ((url.startsWith('data:') || url.startsWith('http')) && !seenKeys.has(key)) {
            seenKeys.add(key);
            itemsToUpload.push({
              dataUrl: url.startsWith('data:') ? url : undefined,
              fileName: name,
              fileSize: fileVal.size,
              trackerId: tracker.id,
              trackerName: tracker.name,
              rowId: row.id,
              siteName,
              colId,
              source: `Grid Cell (${colId})`,
              force: true,
            });
          }
        }
      }

      // 2. Phase 1 documents
      for (const doc of row.documents || []) {
        if (doc.url && doc.url.startsWith('data:')) {
          const key = `${tracker.id}_${row.id}_${doc.name}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            itemsToUpload.push({
              dataUrl: doc.url,
              fileName: doc.name,
              fileSize: doc.fileSize,
              trackerId: tracker.id,
              trackerName: tracker.name,
              rowId: row.id,
              siteName,
              colId: doc.tag || 'documents',
              source: 'Site Data 1',
              force: true,
            });
          }
        }
      }

      // 3. Phase 2 documents
      for (const doc of row.siteData2?.documents || []) {
        if (doc.url && doc.url.startsWith('data:')) {
          const key = `${tracker.id}_${row.id}_${doc.name}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            itemsToUpload.push({
              dataUrl: doc.url,
              fileName: doc.name,
              fileSize: doc.fileSize,
              trackerId: tracker.id,
              trackerName: tracker.name,
              rowId: row.id,
              siteName,
              colId: doc.tag || 'siteData2',
              source: 'Site Data 2',
              force: true,
            });
          }
        }
      }

      // 4. Legal & Regulatory checklist attachments
      for (const item of row.legalChecklist || []) {
        if (item.fileAttachment?.url && item.fileAttachment.url.startsWith('data:')) {
          const key = `${tracker.id}_${row.id}_${item.fileAttachment.name}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            itemsToUpload.push({
              dataUrl: item.fileAttachment.url,
              fileName: item.fileAttachment.name,
              fileSize: item.fileAttachment.size,
              trackerId: tracker.id,
              trackerName: tracker.name,
              rowId: row.id,
              siteName,
              colId: item.requirement,
              source: 'Legal & Regulatory Checklist',
              force: true,
            });
          }
        }
      }
    }
  }

  let uploadedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < itemsToUpload.length; i++) {
    const item = itemsToUpload[i];
    onProgress?.(i + 1, itemsToUpload.length, item.fileName);
    const res = await uploadFileToSupabase(item, cfg);
    if (res.success) uploadedCount++;
    else failedCount++;
  }

  return {
    success: failedCount === 0 || uploadedCount > 0,
    uploadedCount,
    failedCount,
    totalFound: itemsToUpload.length,
  };
}

/**
 * Generate copy-ready SQL schema for Trackers, Backup Push/Pull, Uploaded JPEG/JPG/PDF Files, & Storage Buckets
 */
export function getSupabaseSqlSchema(tableName: string = 'trackers'): string {
  const table = (tableName.trim() || 'trackers').toLowerCase();
  return `-- ==========================================
-- GEM PRO Tracker System - Full Supabase Backup & File Storage Schema
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

-- 2. Create table for Push & Pull JSON Backup Snapshots
create table if not exists public.tracker_backups (
  id text primary key,
  name text not null,
  note text default '',
  file_size text default '',
  total_trackers integer default 0,
  total_rows integer default 0,
  storage_path text,
  public_url text,
  payload jsonb,
  created_at timestamptz default now()
);

-- 3. Create table for Automatically Saved Uploaded Files (JPEG, JPG, PNG, PDF)
create table if not exists public.tracker_files (
  id text primary key,
  file_name text not null,
  file_type text not null,
  mime_type text not null,
  file_size text default '',
  storage_path text,
  public_url text,
  data_url text,
  tracker_id text default '',
  tracker_name text default '',
  row_id text default '',
  site_name text default '',
  col_id text default '',
  source text default '',
  uploaded_at timestamptz default now()
);

-- 4. Enable Row Level Security (RLS) & Policies
alter table public.${table} enable row level security;
alter table public.tracker_backups enable row level security;
alter table public.tracker_files enable row level security;

drop policy if exists "Allow public access to ${table}" on public.${table};
create policy "Allow public access to ${table}"
  on public.${table} for all using (true) with check (true);

drop policy if exists "Allow public access to tracker_backups" on public.tracker_backups;
create policy "Allow public access to tracker_backups"
  on public.tracker_backups for all using (true) with check (true);

drop policy if exists "Allow public access to tracker_files" on public.tracker_files;
create policy "Allow public access to tracker_files"
  on public.tracker_files for all using (true) with check (true);

-- 5. Create Public Supabase Storage Buckets for JPEG/JPG/PDF Files & Backups
insert into storage.buckets (id, name, public)
values ('tracker-files', 'tracker-files', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('tracker-backups', 'tracker-backups', true)
on conflict (id) do nothing;

drop policy if exists "Public access tracker-files" on storage.objects;
create policy "Public access tracker-files"
  on storage.objects for all
  using (bucket_id in ('tracker-files', 'tracker-backups'))
  with check (bucket_id in ('tracker-files', 'tracker-backups'));
`;
}
