/**
 * Robust Client-Side Persistent Storage for Google Drive Backups using IndexedDB.
 * Bypasses the 5MB localStorage quota to guarantee that full tracker datasets,
 * rows, columns, and SLA milestones are never truncated or lost.
 */

const DB_NAME = 'GEM_PRO_BACKUP_DB';
const DB_VERSION = 1;
const STORE_NAME = 'drive_backups';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface StoredBackupRecord {
  id: string;
  name: string;
  createdTime: string;
  modifiedTime: string;
  size: string;
  webViewLink?: string;
  note?: string;
  payload: any; // Complete intact backup payload
}

/**
 * Save or update a backup record in IndexedDB
 */
export async function saveBackupToIndexedDB(record: StoredBackupRecord): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Save backup failed:', err);
  }
}

/**
 * Retrieve all saved backup records from IndexedDB, ordered by modifiedTime desc
 */
export async function getAllBackupsFromIndexedDB(): Promise<StoredBackupRecord[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = (request.result || []) as StoredBackupRecord[];
        records.sort((a, b) => {
          return new Date(b.modifiedTime || b.createdTime).getTime() - new Date(a.modifiedTime || a.createdTime).getTime();
        });
        resolve(records);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Get all backups failed:', err);
    return [];
  }
}

/**
 * Retrieve a specific backup by ID or Name
 */
export async function getBackupFromIndexedDB(identifier: string): Promise<StoredBackupRecord | null> {
  try {
    const all = await getAllBackupsFromIndexedDB();
    const matched = all.find((b) => b.id === identifier || b.name === identifier);
    return matched || null;
  } catch (err) {
    console.warn('[IndexedDB] Get backup failed:', err);
    return null;
  }
}

/**
 * Delete a backup from IndexedDB
 */
export async function deleteBackupFromIndexedDB(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Delete backup failed:', err);
  }
}
