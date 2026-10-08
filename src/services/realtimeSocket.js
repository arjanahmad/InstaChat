/**
 * INSTAChat Realtime Socket & Resilient Signaling Engine
 * Zero-quota, dual-mode communication engine supporting both high-speed
 * Socket.IO WebSockets and resilient HTTP long-polling / serverless fallback
 * for WebRTC Signaling, Chat, Typing Indicators, and Multiplayer Games.
 */

import { io } from 'socket.io-client';
import { api } from './api';

const rawSocketUrl = (import.meta.env.VITE_BACKEND_URL || (typeof window !== 'undefined' ? window.location.origin : '')).trim();
const SOCKET_SERVER_URL = rawSocketUrl ? rawSocketUrl.replace(/\/+$/, '') : '';

class RealtimeSocketManager {
  constructor() {
    this.socket = null;
    this.currentUserId = null;
    this.listeners = new Map(); // event -> Set of callbacks
    this.isConnected = false;
    this.pollTimer = null;
    this.heartbeatTimer = null;
    this.seenEventIds = new Set();
    this.isPolling = false;
  }

  init(userId) {
    if (!userId) return null;

    if (this.currentUserId === userId && (this.socket || this.pollTimer)) {
      return this;
    }

    this.disconnect();
    this.currentUserId = userId;

    // 1. Initialize Socket.IO connection if configured or same-origin
    try {
      this.socket = io(SOCKET_SERVER_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 5000,
        timeout: 8000,
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        console.log('[RealtimeSocket] Connected via Socket.IO with ID:', this.socket.id);
        if (this.currentUserId) {
          this.socket.emit('auth:register', { userId: this.currentUserId });
        }
      });

      this.socket.on('disconnect', (reason) => {
        this.isConnected = false;
        console.log('[RealtimeSocket] Socket.IO disconnected:', reason);
      });

      this.socket.on('connect_error', (err) => {
        this.isConnected = false;
        console.debug('[RealtimeSocket] Socket transport notice (falling back to signaling poll):', err.message);
      });

      // Bind all existing registered listeners to socket
      for (const [event, callbacks] of this.listeners.entries()) {
        this.socket.off(event);
        this.socket.on(event, (data) => {
          this.dispatchEvent(event, data);
        });
      }
    } catch (e) {
      console.warn('[RealtimeSocket] Socket.IO initialization notice:', e.message);
    }

    // 2. Continuous HTTP Signaling & Real-time Event Poller (1.2s cadence)
    // Ensures WebRTC signaling, friend requests, typing, and games work
    // unconditionally in serverless environments (Netlify) where WebSockets are unavailable.
    this.startEventPoller();

    // 3. Presence Heartbeat (every 12s)
    this.startHeartbeat();

    return this;
  }

  startEventPoller() {
    if (this.pollTimer) clearInterval(this.pollTimer);

    const pollOnce = async () => {
      if (!this.currentUserId || this.isPolling) return;
      this.isPolling = true;

      try {
        const res = await api.get(`/api/signaling/poll/${this.currentUserId}`);
        if (res && res.events && Array.isArray(res.events)) {
          for (const ev of res.events) {
            const evKey = ev.id || `${ev.event}_${JSON.stringify(ev.data).slice(0, 50)}`;
            if (!this.seenEventIds.has(evKey)) {
              this.seenEventIds.add(evKey);
              if (this.seenEventIds.size > 200) {
                const oldest = Array.from(this.seenEventIds).slice(0, 50);
                oldest.forEach((id) => this.seenEventIds.delete(id));
              }
              this.dispatchEvent(ev.event, ev.data);
            }
          }
        }
      } catch (_) {
        // Silently tolerate momentary network hiccups
      } finally {
        this.isPolling = false;
      }
    };

    // Immediate initial poll then periodic
    pollOnce();
    this.pollTimer = setInterval(pollOnce, 1200);
  }

  startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    const sendHeartbeat = async () => {
      if (!this.currentUserId) return;
      try {
        await api.post('/api/presence/heartbeat', { userId: this.currentUserId });
      } catch (_) {}
    };

    sendHeartbeat();
    this.heartbeatTimer = setInterval(sendHeartbeat, 12000);
  }

  dispatchEvent(event, data) {
    const cbs = this.listeners.get(event);
    if (cbs && cbs.size > 0) {
      cbs.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error(`Error in listener for ${event}:`, e);
        }
      });
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
      if (this.socket) {
        this.socket.on(event, (data) => {
          this.dispatchEvent(event, data);
        });
      }
    }
    this.listeners.get(event).add(callback);

    // Return unsubscribe function
    return () => {
      const cbs = this.listeners.get(event);
      if (cbs) {
        cbs.delete(callback);
        if (cbs.size === 0) {
          this.listeners.delete(event);
          if (this.socket) {
            this.socket.off(event);
          }
        }
      }
    };
  }

  emit(event, data = {}) {
    // 1. If Socket.IO is connected, emit through socket
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    }

    // 2. Dual-mode relay: Always relay signaling/typing/games through REST API
    // so receiver picks it up regardless of WebSocket connectivity
    let targetUserId = data.targetUserId;
    if (!targetUserId) {
      if (event === 'webrtc:call-answer') {
        targetUserId = data.callerId;
      } else if (event === 'game:accept') {
        targetUserId = data.senderId || data.senderUser?.userId || data.invitation?.senderUser?.userId;
      } else if (event === 'game:move') {
        targetUserId = data.nextPlayer || data.otherPlayerId || data.opponentId;
      } else {
        targetUserId =
          data.receiverId ||
          data.receiverUser?.userId ||
          data.receiverUser?.uid ||
          data.callerId ||
          data.otherUserId;
      }
    }

    if (targetUserId) {
      api.post('/api/signaling/send', {
        event,
        targetUserId,
        data,
      }).catch(() => {});
    }
  }

  disconnect() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentUserId = null;
    this.isConnected = false;
    this.seenEventIds.clear();
  }
}

export const realtimeSocket = new RealtimeSocketManager();
