import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, onSnapshot, deleteDoc } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure persistent data directory exists
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'tracker_store.json');
const SEED_FILE = path.join(DATA_DIR, 'default_seed.json');
const FIREBASE_CONFIG_FILE = path.join(__dirname, 'firebase-applet-config.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-Memory Authoritative Server State
interface ServerState {
  trackers: any[];
  folders: any[];
  users: any[];
  siteVisits: any[];
  decks: any[];
  changeRequests: any[];
  lastUpdated: string;
}

let serverState: ServerState = {
  trackers: [],
  folders: [],
  users: [],
  siteVisits: [],
  decks: [],
  changeRequests: [],
  lastUpdated: new Date().toISOString(),
};

// Firestore DB instance for server
let firestoreDb: any = null;

// Deep sanitize helper to prevent Firestore "Unsupported field value: undefined" errors
function sanitizeData<T>(data: T): T {
  if (data === undefined || data === null) return data;
  return JSON.parse(JSON.stringify(data));
}

// Load saved data from disk if available or pre-seed from seed file
function loadPersistedState(): void {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.trackers) && parsed.trackers.length > 0) {
        serverState = {
          trackers: parsed.trackers || [],
          folders: parsed.folders || [],
          users: parsed.users || [],
          siteVisits: parsed.siteVisits || [],
          decks: parsed.decks || [],
          changeRequests: parsed.changeRequests || [],
          lastUpdated: parsed.lastUpdated || new Date().toISOString(),
        };
        console.log(`[Real-Time Server] Loaded ${serverState.trackers.length} trackers from persistent disk.`);
        return;
      }
    }
  } catch (err) {
    console.warn('[Real-Time Server] Could not read disk store:', err);
  }

  // Pre-seed with default portfolio from seed file if present
  try {
    if (fs.existsSync(SEED_FILE)) {
      const raw = fs.readFileSync(SEED_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.trackers) && parsed.trackers.length > 0) {
        serverState = {
          trackers: parsed.trackers || [],
          folders: parsed.folders || [],
          users: parsed.users || [],
          siteVisits: parsed.siteVisits || [],
          decks: parsed.decks || [],
          changeRequests: parsed.changeRequests || [],
          lastUpdated: new Date().toISOString(),
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(serverState, null, 2), 'utf-8');
        console.log('[Real-Time Server] Initialized and saved initial portfolio to disk from seed file.');
        return;
      }
    }
  } catch (err) {
    console.warn('[Real-Time Server] Could not read seed file:', err);
  }

  serverState = {
    trackers: [],
    folders: [],
    users: [],
    siteVisits: [],
    decks: [],
    changeRequests: [],
    lastUpdated: new Date().toISOString(),
  };
}

// Persist data to disk
let saveTimeout: NodeJS.Timeout | null = null;
function persistStateDebounced(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      serverState.lastUpdated = new Date().toISOString();
      fs.writeFileSync(DATA_FILE, JSON.stringify(serverState, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Real-Time Server] Error saving state to disk:', err);
    }
  }, 300);
}

loadPersistedState();

// Initialize Firestore for cross-container / cross-pod real-time database sync
function initFirestoreSync() {
  try {
    if (fs.existsSync(FIREBASE_CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(FIREBASE_CONFIG_FILE, 'utf-8'));
      if (cfg && cfg.projectId) {
        const fApp = getApps().length > 0 ? getApps()[0] : initializeApp(cfg);
        firestoreDb = cfg.firestoreDatabaseId ? getFirestore(fApp, cfg.firestoreDatabaseId) : getFirestore(fApp);
        console.log(`[Real-Time Server] Connected to Firestore (${cfg.projectId} / ${cfg.firestoreDatabaseId || 'default'})`);

        // Initial fetch from Firestore
        getDocs(collection(firestoreDb, 'trackers'))
          .then((snapshot) => {
            const cloudTrackers: any[] = [];
            snapshot.forEach((d) => {
              const data = d.data();
              if (data && data.id) cloudTrackers.push(data);
            });
            if (cloudTrackers.length > 0) {
              serverState.trackers = cloudTrackers;
              serverState.lastUpdated = new Date().toISOString();
              persistStateDebounced();
              console.log(`[Real-Time Server] Seeded ${cloudTrackers.length} trackers directly from Firestore.`);
            }
          })
          .catch((err) => console.warn('[Real-Time Server] Firestore initial load warning:', err.message));

        // Live snapshot subscriptions: sync remote updates into server state and forward to all WebSocket clients
        onSnapshot(
          collection(firestoreDb, 'trackers'),
          (snapshot) => {
            const updatedTrackers: any[] = [];
            snapshot.forEach((d) => {
              const data = d.data();
              if (data && data.id) updatedTrackers.push(data);
            });

            if (updatedTrackers.length > 0) {
              serverState.trackers = updatedTrackers;
              serverState.lastUpdated = new Date().toISOString();
              persistStateDebounced();

              // Broadcast update to all connected WebSocket clients
              broadcastToClients({
                type: 'STATE_UPDATED',
                payload: {
                  state: serverState,
                  senderId: 'cloud_sync',
                  userName: 'Cloud Sync',
                },
              });
            }
          },
          (err) => console.warn('[Real-Time Server] Firestore trackers subscription warning:', err.message)
        );

        onSnapshot(
          collection(firestoreDb, 'users'),
          (snapshot) => {
            const updatedUsers: any[] = [];
            snapshot.forEach((d) => {
              const data = d.data();
              if (data && data.id) updatedUsers.push(data);
            });

            if (updatedUsers.length > 0) {
              serverState.users = updatedUsers;
              serverState.lastUpdated = new Date().toISOString();
              persistStateDebounced();

              broadcastToClients({
                type: 'USERS_UPDATED',
                payload: {
                  users: updatedUsers,
                  senderId: 'cloud_sync',
                  userName: 'Cloud Sync',
                },
              });
            }
          },
          (err) => console.warn('[Real-Time Server] Firestore users subscription warning:', err.message)
        );

        onSnapshot(
          collection(firestoreDb, 'folders'),
          (snapshot) => {
            const updatedFolders: any[] = [];
            snapshot.forEach((d) => {
              const data = d.data();
              if (data && data.id) updatedFolders.push(data);
            });

            if (updatedFolders.length > 0) {
              serverState.folders = updatedFolders;
              persistStateDebounced();

              broadcastToClients({
                type: 'FOLDERS_UPDATED',
                payload: {
                  folders: updatedFolders,
                  senderId: 'cloud_sync',
                  userName: 'Cloud Sync',
                },
              });
            }
          },
          (err) => console.warn('[Real-Time Server] Firestore folders subscription warning:', err.message)
        );
      }
    }
  } catch (err: any) {
    console.warn('[Real-Time Server] Could not init Firestore:', err.message);
  }
}

initFirestoreSync();

// Active Presence Management
interface ConnectedClient {
  id: string;
  ws: WebSocket;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  activeTrackerId?: string;
  connectedAt: string;
  lastPing: number;
}

const connectedClients = new Map<string, ConnectedClient>();

function getOnlineUsersList() {
  const usersMap = new Map<string, any>();
  for (const client of connectedClients.values()) {
    if (client.user) {
      usersMap.set(client.user.id || client.user.email, {
        ...client.user,
        activeTrackerId: client.activeTrackerId,
        connectedAt: client.connectedAt,
        clientId: client.id,
      });
    }
  }
  return Array.from(usersMap.values());
}

function broadcastToClients(message: any, excludeClientId?: string) {
  const json = JSON.stringify(message);
  for (const [clientId, client] of connectedClients.entries()) {
    if (excludeClientId && clientId === excludeClientId) continue;
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(json);
    }
  }
}

// Setup WebSocket Server
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

wss.on('connection', (ws: WebSocket) => {
  const clientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  const clientInfo: ConnectedClient = {
    id: clientId,
    ws,
    connectedAt: new Date().toISOString(),
    lastPing: Date.now(),
  };

  connectedClients.set(clientId, clientInfo);

  // Send initial handshake with current state and online users
  ws.send(
    JSON.stringify({
      type: 'INIT',
      payload: {
        clientId,
        state: serverState,
        onlineUsers: getOnlineUsersList(),
        serverTime: new Date().toISOString(),
      },
    })
  );

  ws.on('message', (data: Buffer | string) => {
    try {
      const msg = JSON.parse(data.toString());
      clientInfo.lastPing = Date.now();

      switch (msg.type) {
        case 'JOIN': {
          clientInfo.user = msg.payload?.user;
          clientInfo.activeTrackerId = msg.payload?.activeTrackerId;
          const onlineUsers = getOnlineUsersList();
          broadcastToClients({
            type: 'PRESENCE_UPDATE',
            payload: { onlineUsers },
          });
          break;
        }

        case 'PING': {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          break;
        }

        case 'UPDATE_STATE': {
          if (msg.payload?.state) {
            serverState = {
              ...serverState,
              ...msg.payload.state,
              lastUpdated: new Date().toISOString(),
            };
            persistStateDebounced();
            broadcastToClients(
              {
                type: 'STATE_UPDATED',
                payload: {
                  state: serverState,
                  senderId: clientId,
                  userName: clientInfo.user?.name || 'Teammate',
                },
              },
              clientId
            );
          }
          break;
        }

        case 'UPDATE_TRACKER': {
          const tracker = msg.payload?.tracker;
          if (tracker && tracker.id) {
            const idx = serverState.trackers.findIndex((t) => t.id === tracker.id);
            if (idx >= 0) {
              serverState.trackers[idx] = tracker;
            } else {
              serverState.trackers.push(tracker);
            }
            serverState.lastUpdated = new Date().toISOString();
            persistStateDebounced();

            if (firestoreDb) {
              try {
                const sanitized = sanitizeData({
                  ...tracker,
                  updatedAt: serverState.lastUpdated,
                });
                setDoc(doc(firestoreDb, 'trackers', tracker.id), sanitized, { merge: true }).catch(() => {});
              } catch (e) {}
            }

            broadcastToClients(
              {
                type: 'TRACKER_UPDATED',
                payload: {
                  tracker,
                  trackerId: tracker.id,
                  senderId: clientId,
                  userName: clientInfo.user?.name || 'Teammate',
                  timestamp: new Date().toISOString(),
                },
              },
              clientId
            );
          }
          break;
        }

        case 'UPDATE_ROW': {
          const { trackerId, row } = msg.payload || {};
          if (trackerId && row) {
            const tracker = serverState.trackers.find((t) => t.id === trackerId);
            if (tracker) {
              const rIdx = tracker.rows.findIndex((r: any) => r.id === row.id);
              if (rIdx >= 0) {
                tracker.rows[rIdx] = row;
              } else {
                tracker.rows.push(row);
              }
              tracker.updatedAt = new Date().toISOString();
              serverState.lastUpdated = new Date().toISOString();
              persistStateDebounced();

              if (firestoreDb) {
                try {
                  const sanitized = sanitizeData({
                    rows: tracker.rows,
                    updatedAt: tracker.updatedAt,
                  });
                  setDoc(doc(firestoreDb, 'trackers', trackerId), sanitized, { merge: true }).catch(() => {});
                } catch (e) {}
              }

              broadcastToClients(
                {
                  type: 'ROW_UPDATED',
                  payload: {
                    trackerId,
                    row,
                    senderId: clientId,
                    userName: clientInfo.user?.name || 'Teammate',
                    timestamp: new Date().toISOString(),
                  },
                },
                clientId
              );
            }
          }
          break;
        }

        case 'DELETE_ROW': {
          const { trackerId, rowId } = msg.payload || {};
          if (trackerId && rowId) {
            const tracker = serverState.trackers.find((t) => t.id === trackerId);
            if (tracker) {
              tracker.rows = tracker.rows.filter((r: any) => r.id !== rowId);
              tracker.updatedAt = new Date().toISOString();
              serverState.lastUpdated = new Date().toISOString();
              persistStateDebounced();

              if (firestoreDb) {
                try {
                  const sanitized = sanitizeData({
                    rows: tracker.rows,
                    updatedAt: tracker.updatedAt,
                  });
                  setDoc(doc(firestoreDb, 'trackers', trackerId), sanitized, { merge: true }).catch(() => {});
                } catch (e) {}
              }

              broadcastToClients(
                {
                  type: 'ROW_DELETED',
                  payload: {
                    trackerId,
                    rowId,
                    senderId: clientId,
                    userName: clientInfo.user?.name || 'Teammate',
                    timestamp: new Date().toISOString(),
                  },
                },
                clientId
              );
            }
          }
          break;
        }

        case 'UPDATE_FOLDERS': {
          if (Array.isArray(msg.payload?.folders)) {
            serverState.folders = msg.payload.folders;
            persistStateDebounced();
            broadcastToClients(
              {
                type: 'FOLDERS_UPDATED',
                payload: {
                  folders: serverState.folders,
                  senderId: clientId,
                  userName: clientInfo.user?.name || 'Teammate',
                },
              },
              clientId
            );
          }
          break;
        }

        case 'UPDATE_USERS': {
          if (Array.isArray(msg.payload?.users)) {
            serverState.users = msg.payload.users;
            persistStateDebounced();
            broadcastToClients(
              {
                type: 'USERS_UPDATED',
                payload: {
                  users: serverState.users,
                  senderId: clientId,
                  userName: clientInfo.user?.name || 'Teammate',
                },
              },
              clientId
            );
          }
          break;
        }

        case 'UPDATE_VISITS': {
          if (Array.isArray(msg.payload?.siteVisits)) {
            serverState.siteVisits = msg.payload.siteVisits;
            persistStateDebounced();
            broadcastToClients(
              {
                type: 'VISITS_UPDATED',
                payload: {
                  siteVisits: serverState.siteVisits,
                  senderId: clientId,
                  userName: clientInfo.user?.name || 'Teammate',
                },
              },
              clientId
            );
          }
          break;
        }

        case 'UPDATE_DECKS': {
          if (Array.isArray(msg.payload?.decks)) {
            serverState.decks = msg.payload.decks;
            persistStateDebounced();
            broadcastToClients(
              {
                type: 'DECKS_UPDATED',
                payload: {
                  decks: serverState.decks,
                  senderId: clientId,
                  userName: clientInfo.user?.name || 'Teammate',
                },
              },
              clientId
            );
          }
          break;
        }

        case 'UPDATE_REQUESTS': {
          if (Array.isArray(msg.payload?.changeRequests)) {
            serverState.changeRequests = msg.payload.changeRequests;
            persistStateDebounced();
            broadcastToClients(
              {
                type: 'REQUESTS_UPDATED',
                payload: {
                  changeRequests: serverState.changeRequests,
                  senderId: clientId,
                  userName: clientInfo.user?.name || 'Teammate',
                },
              },
              clientId
            );
          }
          break;
        }
      }
    } catch (err) {
      console.warn('[Real-Time Server] WebSocket message parse error:', err);
    }
  });

  ws.on('close', () => {
    connectedClients.delete(clientId);
    broadcastToClients({
      type: 'PRESENCE_UPDATE',
      payload: { onlineUsers: getOnlineUsersList() },
    });
  });

  ws.on('error', (err) => {
    console.warn('[Real-Time Server] WebSocket client error:', err);
    connectedClients.delete(clientId);
  });
});

// Clean up stale client connections every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [clientId, client] of connectedClients.entries()) {
    if (now - client.lastPing > 90000) {
      try {
        client.ws.terminate();
      } catch (e) {}
      connectedClients.delete(clientId);
    }
  }
}, 30000);

// REST API Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    connectedClients: connectedClients.size,
    onlineUsersCount: getOnlineUsersList().length,
    serverTime: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    serverType: 'Free Cloud Run Container Server',
    realTimeProtocol: 'WebSocket (ws/wss) + REST JSON Store',
  });
});

// Helper for GitHub OAuth Redirect URI
function getGitHubRedirectUri(req: express.Request): string {
  const envUrl = process.env.APP_URL;
  if (envUrl && envUrl.trim() && !envUrl.includes('MY_APP_URL')) {
    return `${envUrl.trim().replace(/\/+$/, '')}/auth/callback`;
  }
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  return `${protocol}://${host}/auth/callback`;
}

// 1. GitHub OAuth URL Endpoint (popup-based flow adhering to OAuth skill)
app.get('/api/auth/github/url', (req, res) => {
  const clientId = (process.env.GITHUB_CLIENT_ID || process.env.CLIENT_ID || '').trim();
  const redirectUri = getGitHubRedirectUri(req);
  const configured = Boolean(clientId && clientId !== 'MY_CLIENT_ID');
  const scopes = 'repo,gist,read:user';

  const authUrl = configured
    ? `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=gem_pro_${Date.now()}`
    : `https://github.com/settings/tokens/new?scopes=repo,gist,read:user&description=GEM+PRO+Generic+Tracker`;

  res.json({
    configured,
    clientId: configured ? clientId : '',
    redirectUri,
    scopes,
    url: authUrl,
    tokenCreationUrl: 'https://github.com/settings/tokens/new?scopes=repo,gist,read:user&description=GEM+PRO+Generic+Tracker',
    appUrls: {
      devUrl: 'https://ais-dev-2qtrkd3l54vk7xikqgdvkx-471160090687.asia-southeast1.run.app/auth/callback',
      sharedUrl: 'https://ais-pre-2qtrkd3l54vk7xikqgdvkx-471160090687.asia-southeast1.run.app/auth/callback',
    },
  });
});

// 2. GitHub OAuth Callback Route (popup callback handler with postMessage)
app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
  const code = req.query.code as string | undefined;
  const error = req.query.error as string | undefined;
  const clientId = (process.env.GITHUB_CLIENT_ID || process.env.CLIENT_ID || '').trim();
  const clientSecret = (process.env.GITHUB_CLIENT_SECRET || process.env.CLIENT_SECRET || '').trim();
  const redirectUri = getGitHubRedirectUri(req);

  if (error) {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>GitHub Auth</title></head>
        <body style="font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;padding:28px;border:1px solid #334155;border-radius:16px;background:#1e293b;max-width:440px;">
            <h3 style="color:#f43f5e;margin:0 0 10px;">GitHub Authorization Canceled</h3>
            <p style="font-size:13px;color:#94a3b8;margin:0 0 16px;">${String(error)}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', provider: 'github', error: ${JSON.stringify(error)} }, '*');
                setTimeout(() => window.close(), 1000);
              }
            </script>
          </div>
        </body>
      </html>
    `);
  }

  if (!code) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <body style="font-family:sans-serif;background:#0f172a;color:#fff;padding:24px;">
          <h3>No authorization code received</h3>
          <p>Please close this window and try again.</p>
        </body>
      </html>
    `);
  }

  try {
    // Exchange code for GitHub access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData: any = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error(tokenData.error_description || tokenData.error || 'Failed to exchange authorization code for access token');
    }

    // Fetch GitHub User Profile
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${accessToken}`,
        'User-Agent': 'GEM-PRO-Generic-Tracker',
      },
    });

    const userData: any = userRes.ok ? await userRes.json() : { login: 'github_user' };

    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>GitHub Connected</title></head>
        <body style="font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;padding:28px;border:1px solid #10b981;border-radius:16px;background:#1e293b;max-width:440px;box-shadow:0 10px 25px rgba(0,0,0,0.5);">
            <div style="font-size:32px;margin-bottom:10px;">🎉</div>
            <h3 style="color:#10b981;margin:0 0 8px;">Successfully Connected to GitHub!</h3>
            <p style="font-size:13px;color:#94a3b8;margin:0 0 16px;">Authenticated as <strong>@${userData.login}</strong>.</p>
            <p style="font-size:12px;color:#64748b;">Closing popup and loading your repository...</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: 'OAUTH_AUTH_SUCCESS',
                  provider: 'github',
                  token: ${JSON.stringify(accessToken)},
                  user: ${JSON.stringify({
                    login: userData.login,
                    name: userData.name || userData.login,
                    avatar_url: userData.avatar_url,
                  })}
                }, '*');
                setTimeout(() => window.close(), 600);
              } else {
                window.location.href = '/?tab=github';
              }
            </script>
          </div>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error('[GitHub OAuth Error]:', err);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head><title>GitHub Connection Error</title></head>
        <body style="font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;padding:28px;border:1px solid #f43f5e;border-radius:16px;background:#1e293b;max-width:440px;">
            <h3 style="color:#f43f5e;margin:0 0 10px;">GitHub OAuth Exchange Failed</h3>
            <p style="font-size:13px;color:#94a3b8;margin:0 0 16px;">${err.message || 'Token exchange failed'}</p>
            <p style="font-size:11px;color:#64748b;">If CLIENT_SECRET is not configured, you can connect directly with a Personal Access Token in the app.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', provider: 'github', error: ${JSON.stringify(err.message)} }, '*');
              }
            </script>
          </div>
        </body>
      </html>
    `);
  }
});

app.get('/api/state', (req, res) => {
  res.json({
    ...serverState,
    onlineUsers: getOnlineUsersList(),
    serverTime: new Date().toISOString(),
  });
});

app.post('/api/state', (req, res) => {
  const { state } = req.body;
  if (state) {
    serverState = {
      ...serverState,
      ...state,
      lastUpdated: new Date().toISOString(),
    };
    persistStateDebounced();
    broadcastToClients({
      type: 'STATE_UPDATED',
      payload: { state: serverState, userName: 'Admin/API' },
    });
    res.json({ success: true, serverState });
  } else {
    res.status(400).json({ error: 'Missing state body' });
  }
});

app.post('/api/trackers', (req, res) => {
  const { tracker } = req.body;
  if (!tracker || !tracker.id) {
    return res.status(400).json({ error: 'Invalid tracker object' });
  }

  const idx = serverState.trackers.findIndex((t) => t.id === tracker.id);
  if (idx >= 0) {
    serverState.trackers[idx] = tracker;
  } else {
    serverState.trackers.push(tracker);
  }
  serverState.lastUpdated = new Date().toISOString();
  persistStateDebounced();

  if (firestoreDb) {
    try {
      const sanitized = sanitizeData({
        ...tracker,
        updatedAt: serverState.lastUpdated,
      });
      setDoc(doc(firestoreDb, 'trackers', tracker.id), sanitized, { merge: true }).catch(() => {});
    } catch (e) {}
  }

  broadcastToClients({
    type: 'TRACKER_UPDATED',
    payload: { tracker, trackerId: tracker.id, userName: 'Team Sync' },
  });

  res.json({ success: true, tracker });
});

app.post('/api/users', (req, res) => {
  const { users } = req.body;
  if (!Array.isArray(users)) {
    return res.status(400).json({ error: 'Expected users array' });
  }

  serverState.users = users;
  serverState.lastUpdated = new Date().toISOString();
  persistStateDebounced();

  if (firestoreDb) {
    try {
      for (const u of users) {
        if (u && u.id) {
          setDoc(doc(firestoreDb, 'users', u.id), sanitizeData(u), { merge: true }).catch(() => {});
        }
      }
    } catch (e) {}
  }

  broadcastToClients({
    type: 'USERS_UPDATED',
    payload: { users, senderId: 'server_api', userName: 'User Sync' },
  });

  res.json({ success: true, count: users.length });
});

// Lightweight version polling endpoint (returns in ~2ms for rapid delta sync)
app.get('/api/version', (req, res) => {
  res.json({
    lastUpdated: serverState.lastUpdated,
    trackersCount: serverState.trackers.length,
    onlineUsersCount: getOnlineUsersList().length,
    serverTime: new Date().toISOString(),
  });
});

// Row-level rapid sync endpoint
app.post('/api/rows', (req, res) => {
  const { trackerId, row, userName } = req.body;
  if (!trackerId || !row || !row.id) {
    return res.status(400).json({ error: 'Missing trackerId or row object' });
  }

  const tracker = serverState.trackers.find((t) => t.id === trackerId);
  if (tracker) {
    const rIdx = tracker.rows.findIndex((r: any) => r.id === row.id);
    if (rIdx >= 0) {
      tracker.rows[rIdx] = row;
    } else {
      tracker.rows.push(row);
    }
    tracker.updatedAt = new Date().toISOString();
    serverState.lastUpdated = new Date().toISOString();
    persistStateDebounced();

    if (firestoreDb) {
      try {
        const sanitized = sanitizeData({
          rows: tracker.rows,
          updatedAt: tracker.updatedAt,
        });
        setDoc(doc(firestoreDb, 'trackers', trackerId), sanitized, { merge: true }).catch(() => {});
      } catch (e) {}
    }

    broadcastToClients({
      type: 'ROW_UPDATED',
      payload: {
        trackerId,
        row,
        userName: userName || 'Co-worker',
        timestamp: new Date().toISOString(),
      },
    });

    return res.json({ success: true, row });
  }

  return res.status(404).json({ error: 'Tracker not found' });
});

app.get('/api/presence', (req, res) => {
  res.json({
    onlineUsers: getOnlineUsersList(),
    totalConnected: connectedClients.size,
  });
});

app.post('/api/presence', (req, res) => {
  const { user, activeTrackerId } = req.body;
  if (user && user.name) {
    const clientKey = 'rest_' + (user.id || user.email || user.name);
    connectedClients.set(clientKey, {
      id: clientKey,
      ws: { readyState: 0 } as any,
      user,
      activeTrackerId,
      connectedAt: new Date().toISOString(),
      lastPing: Date.now(),
    });
  }
  res.json({ success: true, onlineUsers: getOnlineUsersList() });
});

// Vite Integration (Dev Middleware or Production Static Serving)
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Real-Time Server] 🚀 Free collaborative tracker server running on http://0.0.0.0:${PORT}`);
    console.log(`[Real-Time Server] 📡 Real-time WebSocket listening on ws://0.0.0.0:${PORT}/ws`);
  });
}

startServer().catch((err) => {
  console.error('[Real-Time Server] Failed to initialize server:', err);
  process.exit(1);
});
