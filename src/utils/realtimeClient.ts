import { Tracker, TrackerFolder, UserAccount, SiteVisitRecord, ExecutiveDeck, ChangeRequest, TrackerRow } from '../types/tracker';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface OnlineUser {
  id: string;
  name: string;
  email: string;
  role: string;
  activeTrackerId?: string;
  connectedAt: string;
  clientId: string;
}

export interface RealtimeMessage {
  type: string;
  payload?: any;
}

class RealtimeClient {
  private socket: WebSocket | null = null;
  private status: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 20;
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private pollingTimer: any = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private currentUser: UserAccount | null = null;
  private currentActiveTrackerId: string = '';
  private clientId: string = '';
  private lastInitPayload: any = null;
  private lastSeenServerTimestamp: string = '';
  private lastSelfPushTimestamp: number = 0;
  private enabled: boolean = true;

  constructor() {
    this.clientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    try {
      const saved = localStorage.getItem('gt_server_sync_enabled');
      if (saved !== null) {
        this.enabled = saved === 'true';
      }
    } catch (e) {}
    this.initBroadcastChannel();
    if (this.enabled) {
      this.init();
      this.startSmartPolling();
    }
  }

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('gt_tracker_collab_bus');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.type) {
            // Ignore messages originating from self
            if (event.data.payload?.senderId && event.data.payload.senderId === this.clientId) return;
            this.handleIncomingMessage(event.data);
          }
        };
      } catch (e) {
        console.warn('[RealtimeClient] BroadcastChannel not supported or restricted:', e);
      }
    }
  }

  private startSmartPolling() {
    if (typeof window === 'undefined') return;
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    if (!this.enabled) return;

    // Watchdog check every 2.5 seconds to detect coworker edits even if WebSocket drops
    this.pollingTimer = setInterval(async () => {
      if (!this.enabled) return;
      // Don't pull immediately if we just pushed changes in the last 1500ms
      if (Date.now() - this.lastSelfPushTimestamp < 1500) return;

      try {
        const res = await fetch('/api/version');
        if (!res.ok) return;
        const info = await res.json();
        if (info && info.lastUpdated) {
          if (!this.lastSeenServerTimestamp) {
            this.lastSeenServerTimestamp = info.lastUpdated;
            return;
          }

          if (info.lastUpdated !== this.lastSeenServerTimestamp) {
            this.lastSeenServerTimestamp = info.lastUpdated;
            // Fetch updated authoritative state from server
            const fullState = await this.fetchServerState();
            if (fullState) {
              this.emit('state_updated', {
                state: fullState,
                senderId: 'server_poll',
                userName: 'Co-worker Cloud',
              });
            }
          }
        }
      } catch (err) {
        // Silent network transient catch
      }
    }, 2500);
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    try {
      localStorage.setItem('gt_server_sync_enabled', String(enabled));
    } catch (e) {}

    if (!enabled) {
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      if (this.pollingTimer) clearInterval(this.pollingTimer);
      this.stopHeartbeat();
      if (this.socket) {
        try {
          this.socket.close();
        } catch (e) {}
        this.socket = null;
      }
      this.setStatus('disconnected');
    } else {
      this.connect();
      this.startSmartPolling();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getLastInitPayload(): any {
    return this.lastInitPayload;
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public getClientId(): string {
    return this.clientId;
  }

  public init() {
    if (typeof window === 'undefined') return;
    if (this.enabled) {
      this.connect();
    }
  }

  public setUser(user: UserAccount, activeTrackerId?: string) {
    this.currentUser = user;
    if (activeTrackerId) this.currentActiveTrackerId = activeTrackerId;

    // Send via WebSocket if open
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.send({
        type: 'JOIN',
        payload: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
          activeTrackerId: this.currentActiveTrackerId,
        },
      });
    }

    // Also register REST presence for bulletproof online user list
    fetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        activeTrackerId: this.currentActiveTrackerId,
      }),
    }).catch(() => {});
  }

  public setActiveTracker(trackerId: string) {
    this.currentActiveTrackerId = trackerId;
    if (this.currentUser) {
      this.setUser(this.currentUser, trackerId);
    }
  }

  private connect() {
    if (!this.enabled) return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus('connecting');

    try {
      const isHttps = window.location.protocol === 'https:';
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      const wsHost = window.location.host;
      const wsUrl = `${wsProtocol}//${wsHost}/ws`;

      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.setStatus('connected');
        this.reconnectAttempts = 0;
        this.startHeartbeat();

        if (this.currentUser) {
          this.setUser(this.currentUser, this.currentActiveTrackerId);
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const msg: RealtimeMessage = JSON.parse(event.data);
          this.handleIncomingMessage(msg);
        } catch (e) {
          console.warn('[RealtimeClient] Failed to parse message:', e);
        }
      };

      this.socket.onclose = () => {
        this.setStatus('disconnected');
        this.stopHeartbeat();
        this.scheduleReconnect();
      };

      this.socket.onerror = (err) => {
        console.warn('[RealtimeClient] WebSocket error:', err);
        this.setStatus('error');
      };
    } catch (err) {
      console.warn('[RealtimeClient] Connection error:', err);
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.send({ type: 'PING' });
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect() {
    if (!this.enabled) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[RealtimeClient] Max reconnect attempts reached, will retry on user action');
      return;
    }

    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  public retryConnection() {
    this.reconnectAttempts = 0;
    this.connect();
  }

  private setStatus(s: ConnectionStatus) {
    if (this.status !== s) {
      this.status = s;
      this.emit('status', s);
    }
  }

  private handleIncomingMessage(msg: RealtimeMessage) {
    switch (msg.type) {
      case 'INIT': {
        this.clientId = msg.payload?.clientId || '';
        this.lastInitPayload = msg.payload;
        this.emit('init', msg.payload);
        break;
      }
      case 'PRESENCE_UPDATE': {
        this.emit('presence', msg.payload?.onlineUsers || []);
        break;
      }
      case 'TRACKER_UPDATED':
      case 'UPDATE_TRACKER': {
        this.emit('tracker_updated', msg.payload);
        break;
      }
      case 'ROW_UPDATED':
      case 'UPDATE_ROW': {
        this.emit('row_updated', msg.payload);
        break;
      }
      case 'ROW_DELETED':
      case 'DELETE_ROW': {
        this.emit('row_deleted', msg.payload);
        break;
      }
      case 'STATE_UPDATED':
      case 'UPDATE_STATE': {
        this.emit('state_updated', msg.payload);
        break;
      }
      case 'FOLDERS_UPDATED':
      case 'UPDATE_FOLDERS': {
        this.emit('folders_updated', msg.payload?.folders || msg.payload);
        break;
      }
      case 'USERS_UPDATED':
      case 'UPDATE_USERS': {
        this.emit('users_updated', msg.payload?.users || msg.payload);
        break;
      }
      case 'VISITS_UPDATED':
      case 'UPDATE_VISITS': {
        this.emit('visits_updated', msg.payload?.siteVisits || msg.payload);
        break;
      }
      case 'DECKS_UPDATED':
      case 'UPDATE_DECKS': {
        this.emit('decks_updated', msg.payload?.decks || msg.payload);
        break;
      }
      case 'REQUESTS_UPDATED':
      case 'UPDATE_REQUESTS': {
        this.emit('requests_updated', msg.payload?.changeRequests || msg.payload);
        break;
      }
    }
  }

  public send(msg: RealtimeMessage) {
    if (!this.enabled) return;
    this.lastSelfPushTimestamp = Date.now();
    // 1. Send via WebSocket if open
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    }

    // 2. Broadcast across tabs in the same browser session
    if (this.broadcastChannel) {
      try {
        const enriched = {
          ...msg,
          payload: {
            ...msg.payload,
            senderId: this.clientId,
            userName: this.currentUser?.name || 'Co-worker',
            timestamp: new Date().toISOString(),
          },
        };
        this.broadcastChannel.postMessage(enriched);
      } catch (e) {}
    }
  }

  // Helper sync methods with dual-channel HTTP REST auto-persistence
  public updateTracker(tracker: Tracker) {
    if (!this.enabled) return;
    this.send({
      type: 'UPDATE_TRACKER',
      payload: { tracker, trackerId: tracker.id },
    });
    // REST fallback persistence to Cloud Run container
    fetch('/api/trackers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tracker }),
    }).catch(() => {});
  }

  public updateRow(trackerId: string, row: TrackerRow) {
    if (!this.enabled) return;
    this.send({
      type: 'UPDATE_ROW',
      payload: { trackerId, row },
    });
    // REST fallback persistence for row
    fetch('/api/rows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trackerId,
        row,
        userName: this.currentUser?.name || 'Co-worker',
      }),
    }).catch(() => {});
  }

  public deleteRow(trackerId: string, rowId: string) {
    if (!this.enabled) return;
    this.send({
      type: 'DELETE_ROW',
      payload: { trackerId, rowId },
    });
  }

  public updateFullState(state: {
    trackers?: Tracker[];
    folders?: TrackerFolder[];
    users?: UserAccount[];
    siteVisits?: SiteVisitRecord[];
    decks?: ExecutiveDeck[];
    changeRequests?: ChangeRequest[];
  }) {
    if (!this.enabled) return;
    this.send({
      type: 'UPDATE_STATE',
      payload: { state },
    });
    fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
    }).catch(() => {});
  }

  public updateFolders(folders: TrackerFolder[]) {
    if (!this.enabled) return;
    this.send({
      type: 'UPDATE_FOLDERS',
      payload: { folders },
    });
  }

  public updateUsers(users: UserAccount[]) {
    if (!this.enabled) return;
    this.send({
      type: 'UPDATE_USERS',
      payload: { users },
    });
    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users }),
    }).catch(() => {});
  }

  public updateVisits(siteVisits: SiteVisitRecord[]) {
    if (!this.enabled) return;
    this.send({
      type: 'UPDATE_VISITS',
      payload: { siteVisits },
    });
  }

  public updateDecks(decks: ExecutiveDeck[]) {
    if (!this.enabled) return;
    this.send({
      type: 'UPDATE_DECKS',
      payload: { decks },
    });
  }

  public updateChangeRequests(changeRequests: ChangeRequest[]) {
    if (!this.enabled) return;
    this.send({
      type: 'UPDATE_REQUESTS',
      payload: { changeRequests },
    });
  }

  // Event listener subscription with replay
  public on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // If subscribed to status, immediately notify with current status
    if (event === 'status') {
      try {
        callback(this.status);
      } catch (err) {}
    }

    // If subscribed to init and we already received the server init payload, immediately replay!
    if (event === 'init' && this.lastInitPayload) {
      try {
        callback(this.lastInitPayload);
      } catch (err) {
        console.error('[RealtimeClient] Error in replayed init listener:', err);
      }
    }

    return () => this.off(event, callback);
  }

  public off(event: string, callback: (data: any) => void) {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
    }
  }

  private emit(event: string, data: any) {
    const set = this.listeners.get(event);
    if (set) {
      for (const cb of set) {
        try {
          cb(data);
        } catch (err) {
          console.error(`[RealtimeClient] Error in listener for ${event}:`, err);
        }
      }
    }
  }

  // REST API fallbacks
  public async fetchServerState() {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('[RealtimeClient] Failed to fetch REST state:', e);
    }
    return null;
  }

  public async fetchServerHealth() {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}
    return null;
  }
}

export const realtimeClient = new RealtimeClient();
