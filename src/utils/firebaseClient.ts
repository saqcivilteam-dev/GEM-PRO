import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  Unsubscribe,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  Tracker,
  TrackerFolder,
  UserAccount,
  SiteVisitRecord,
  ExecutiveDeck,
  ChangeRequest,
  TrackerRow,
} from '../types/tracker';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    if (getApps().length > 0) {
      app = getApp();
    } else {
      app = initializeApp(firebaseConfig);
    }
  }
  return app;
}

export function getFirestoreDb(): Firestore {
  if (!db) {
    const fApp = getFirebaseApp();
    const databaseId = (firebaseConfig as any).firestoreDatabaseId || undefined;
    db = databaseId ? getFirestore(fApp, databaseId) : getFirestore(fApp);
  }
  return db;
}

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig && firebaseConfig.projectId && firebaseConfig.apiKey);
}

export function getFirebaseConfigInfo() {
  return {
    projectId: firebaseConfig.projectId,
    databaseId: (firebaseConfig as any).firestoreDatabaseId || '(default)',
    authDomain: firebaseConfig.authDomain,
    storageBucket: firebaseConfig.storageBucket,
    isConfigured: isFirebaseConfigured(),
  };
}

/**
 * CRITICAL: Firestore rejects JavaScript `undefined` field values.
 * This deep sanitization converts undefined to omitted properties, preventing
 * "Function setDoc() called with invalid data. Unsupported field value: undefined" errors.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined || data === null) {
    return data;
  }
  return JSON.parse(JSON.stringify(data));
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  let authInfo = {
    userId: null as string | null | undefined,
    email: null as string | null | undefined,
    emailVerified: null as boolean | null | undefined,
    isAnonymous: null as boolean | null | undefined,
    tenantId: null as string | null | undefined,
    providerInfo: [] as { providerId?: string | null; email?: string | null }[],
  };

  try {
    const auth = getAuth(getFirebaseApp());
    const user = auth.currentUser;
    if (user) {
      authInfo = {
        userId: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        isAnonymous: user.isAnonymous,
        tenantId: user.tenantId,
        providerInfo: user.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
      };
    }
  } catch {}

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo,
  };
  console.error('[Firebase Error]:', JSON.stringify(errInfo));
  return errInfo;
}

/**
 * Test connectivity to Firestore
 */
export async function testFirestoreConnection(): Promise<{ success: boolean; latencyMs?: number; error?: string }> {
  const start = performance.now();
  try {
    const firestore = getFirestoreDb();
    const testDoc = doc(firestore, 'meta', 'connection_test');
    await setDoc(
      testDoc,
      {
        lastPing: new Date().toISOString(),
        client: 'ai-studio-web',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    const latencyMs = Math.round(performance.now() - start);
    return { success: true, latencyMs };
  } catch (err: any) {
    console.warn('[Firebase] Connection test failed:', err);
    return { success: false, error: err.message || 'Failed to connect to Firestore' };
  }
}

export interface TrackerChangeInfo {
  type: 'added' | 'modified' | 'removed';
  tracker: Tracker;
  isLocalWrite: boolean;
}

/**
 * Real-time listener for all trackers in the shared cloud Firestore database.
 * Notifies when any teammate or coworker creates, updates, or deletes tracker rows.
 */
export function subscribeToTrackers(
  onUpdate: (trackers: Tracker[], changes?: TrackerChangeInfo[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  try {
    const firestore = getFirestoreDb();
    const trackersCol = collection(firestore, 'trackers');

    return onSnapshot(
      trackersCol,
      { includeMetadataChanges: true },
      (snapshot) => {
        const loadedTrackers: Tracker[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && data.id) {
            loadedTrackers.push(data as Tracker);
          }
        });

        const changes: TrackerChangeInfo[] = [];
        snapshot.docChanges().forEach((change) => {
          const docData = change.doc.data() as Tracker;
          const isLocalWrite = change.doc.metadata.hasPendingWrites;
          if (docData && docData.id) {
            changes.push({
              type: change.type,
              tracker: docData,
              isLocalWrite,
            });
          }
        });

        if (loadedTrackers.length > 0) {
          onUpdate(loadedTrackers, changes);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'trackers');
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    console.warn('[Firebase] Failed to setup trackers listener:', err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Save a single tracker to Firestore with full sanitization.
 */
export async function saveTrackerToFirestore(tracker: Tracker): Promise<boolean> {
  try {
    const firestore = getFirestoreDb();
    const trackerDoc = doc(firestore, 'trackers', tracker.id);
    const payload = sanitizeForFirestore({
      ...tracker,
      updatedAt: new Date().toISOString(),
    });

    await setDoc(trackerDoc, payload, { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `trackers/${tracker.id}`);
    return false;
  }
}

/**
 * Save a single row update in a tracker to Firestore with full sanitization.
 */
export async function saveRowToFirestore(
  trackerId: string,
  row: TrackerRow,
  currentTracker?: Tracker
): Promise<boolean> {
  try {
    const firestore = getFirestoreDb();
    const trackerDoc = doc(firestore, 'trackers', trackerId);

    let updatedRows: TrackerRow[] = [];
    if (currentTracker && Array.isArray(currentTracker.rows)) {
      updatedRows = currentTracker.rows.map((r) => (r.id === row.id ? row : r));
      if (!updatedRows.some((r) => r.id === row.id)) {
        updatedRows.push(row);
      }
    } else {
      // Fallback: fetch current doc if currentTracker not provided
      const snap = await getDoc(trackerDoc);
      if (snap.exists()) {
        const existingData = snap.data();
        const rows: TrackerRow[] = existingData.rows || [];
        updatedRows = rows.map((r) => (r.id === row.id ? row : r));
        if (!updatedRows.some((r) => r.id === row.id)) {
          updatedRows.push(row);
        }
      } else {
        updatedRows = [row];
      }
    }

    const payload = sanitizeForFirestore({
      id: trackerId,
      rows: updatedRows,
      updatedAt: new Date().toISOString(),
    });

    await setDoc(trackerDoc, payload, { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `trackers/${trackerId}`);
    return false;
  }
}

/**
 * Delete a single row from a tracker in Firestore.
 */
export async function deleteRowFromFirestore(
  trackerId: string,
  rowId: string,
  currentTracker?: Tracker
): Promise<boolean> {
  try {
    const firestore = getFirestoreDb();
    const trackerDoc = doc(firestore, 'trackers', trackerId);

    let updatedRows: TrackerRow[] = [];
    if (currentTracker && Array.isArray(currentTracker.rows)) {
      updatedRows = currentTracker.rows.filter((r) => r.id !== rowId);
    } else {
      const snap = await getDoc(trackerDoc);
      if (snap.exists()) {
        const rows: TrackerRow[] = snap.data().rows || [];
        updatedRows = rows.filter((r) => r.id !== rowId);
      }
    }

    const payload = sanitizeForFirestore({
      id: trackerId,
      rows: updatedRows,
      updatedAt: new Date().toISOString(),
    });

    await setDoc(trackerDoc, payload, { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `trackers/${trackerId}`);
    return false;
  }
}

/**
 * Delete an entire tracker from Firestore.
 */
export async function deleteTrackerFromFirestore(trackerId: string): Promise<boolean> {
  try {
    const firestore = getFirestoreDb();
    const trackerDoc = doc(firestore, 'trackers', trackerId);
    await deleteDoc(trackerDoc);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `trackers/${trackerId}`);
    return false;
  }
}

/**
 * Push all trackers to Firestore
 */
export async function syncAllTrackersToFirestore(
  trackers: Tracker[]
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const firestore = getFirestoreDb();
    let count = 0;
    for (const tracker of trackers) {
      const trackerDoc = doc(firestore, 'trackers', tracker.id);
      const sanitized = sanitizeForFirestore({
        ...tracker,
        updatedAt: tracker.updatedAt || new Date().toISOString(),
      });
      await setDoc(trackerDoc, sanitized, { merge: true });
      count++;
    }

    // Update system metadata doc
    const metaDoc = doc(firestore, 'meta', 'system_state');
    await setDoc(
      metaDoc,
      {
        totalTrackers: count,
        lastSyncedAt: new Date().toISOString(),
        syncedBy: 'web_client',
      },
      { merge: true }
    );

    return { success: true, count };
  } catch (err: any) {
    console.error('[Firebase] Error syncing all trackers:', err);
    return { success: false, count: 0, error: err.message };
  }
}

/**
 * Pull all trackers from Firestore
 */
export async function loadTrackersFromFirestore(): Promise<Tracker[] | null> {
  try {
    const firestore = getFirestoreDb();
    const trackersCol = collection(firestore, 'trackers');
    const snapshot = await getDocs(trackersCol);

    const loadedTrackers: Tracker[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.id) {
        loadedTrackers.push(data as Tracker);
      }
    });

    return loadedTrackers.length > 0 ? loadedTrackers : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'trackers');
    return null;
  }
}

/**
 * Sync and Subscribe Folders
 */
export function subscribeToFolders(
  onUpdate: (folders: TrackerFolder[]) => void
): Unsubscribe {
  try {
    const firestore = getFirestoreDb();
    return onSnapshot(collection(firestore, 'folders'), (snapshot) => {
      const list: TrackerFolder[] = [];
      snapshot.forEach((d) => {
        const item = d.data();
        if (item && item.id) list.push(item as TrackerFolder);
      });
      if (list.length > 0) onUpdate(list);
    });
  } catch {
    return () => {};
  }
}

export async function syncFoldersToFirestore(folders: TrackerFolder[]): Promise<boolean> {
  try {
    const firestore = getFirestoreDb();
    for (const folder of folders) {
      const folderDoc = doc(firestore, 'folders', folder.id);
      await setDoc(folderDoc, sanitizeForFirestore(folder), { merge: true });
    }
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'folders');
    return false;
  }
}

/**
 * Sync and Subscribe Users
 */
export function subscribeToUsers(
  onUpdate: (users: UserAccount[]) => void
): Unsubscribe {
  try {
    const firestore = getFirestoreDb();
    return onSnapshot(collection(firestore, 'users'), (snapshot) => {
      const list: UserAccount[] = [];
      snapshot.forEach((d) => {
        const item = d.data();
        if (item && item.id) list.push(item as UserAccount);
      });
      if (list.length > 0) onUpdate(list);
    });
  } catch {
    return () => {};
  }
}

export async function syncUsersToFirestore(users: UserAccount[]): Promise<boolean> {
  try {
    const firestore = getFirestoreDb();
    for (const user of users) {
      const userDoc = doc(firestore, 'users', user.id);
      await setDoc(userDoc, sanitizeForFirestore(user), { merge: true });
    }
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'users');
    return false;
  }
}

export async function saveUserToFirestore(user: UserAccount): Promise<boolean> {
  try {
    const firestore = getFirestoreDb();
    const userDoc = doc(firestore, 'users', user.id);
    await setDoc(userDoc, sanitizeForFirestore(user), { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${user.id}`);
    return false;
  }
}

/**
 * Sync Site Visits
 */
export async function syncSiteVisitsToFirestore(visits: SiteVisitRecord[]): Promise<boolean> {
  try {
    const firestore = getFirestoreDb();
    for (const visit of visits) {
      const visitDoc = doc(firestore, 'siteVisits', visit.id);
      await setDoc(visitDoc, sanitizeForFirestore(visit), { merge: true });
    }
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'siteVisits');
    return false;
  }
}

export function subscribeToSiteVisits(
  onUpdate: (visits: SiteVisitRecord[]) => void
): Unsubscribe {
  try {
    const firestore = getFirestoreDb();
    return onSnapshot(collection(firestore, 'siteVisits'), (snapshot) => {
      const list: SiteVisitRecord[] = [];
      snapshot.forEach((d) => {
        const item = d.data();
        if (item && item.id) list.push(item as SiteVisitRecord);
      });
      if (list.length > 0) onUpdate(list);
    });
  } catch {
    return () => {};
  }
}

/**
 * Sync Executive Decks
 */
export async function syncDecksToFirestore(decks: ExecutiveDeck[]): Promise<boolean> {
  try {
    const firestore = getFirestoreDb();
    for (const deck of decks) {
      const deckDoc = doc(firestore, 'decks', deck.id);
      await setDoc(deckDoc, sanitizeForFirestore(deck), { merge: true });
    }
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'decks');
    return false;
  }
}

/**
 * Sync Change Requests
 */
export async function syncChangeRequestsToFirestore(requests: ChangeRequest[]): Promise<boolean> {
  try {
    const firestore = getFirestoreDb();
    for (const req of requests) {
      const reqDoc = doc(firestore, 'changeRequests', req.id);
      await setDoc(reqDoc, sanitizeForFirestore(req), { merge: true });
    }
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'changeRequests');
    return false;
  }
}
